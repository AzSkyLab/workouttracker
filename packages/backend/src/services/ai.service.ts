import { prisma } from '../lib/prisma.js';
import {
  GenerateWorkoutPlanDto,
  GenerateWorkoutPlanResponse,
  AiRawWorkoutPlan,
  AiRawWorkoutDay,
  AiRawExercise,
} from '@workout-tracker/shared';

interface ExerciseRecord {
  id: string;
  name: string;
  type: string;
  muscleGroup: string | null;
  category: string | null;
  aliases: string[];
}

interface MappedExercise {
  exerciseId: string;
  name: string;
  type: string;
  sets: number;
  reps?: number;
  durationMinutes?: number;
  restSeconds?: number;
  notes?: string;
}

interface MappedDay {
  dayName: string;
  description: string;
  exercises: MappedExercise[];
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama.home.lab:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:32b';

// Day colors for generated templates
const DAY_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export class AiService {
  async generateWorkoutPlan(
    userId: string,
    preferences: GenerateWorkoutPlanDto
  ): Promise<GenerateWorkoutPlanResponse> {
    // 1. Fetch available exercises
    const exercises = await this.getExerciseLibrary(userId);

    // 2. Filter by available equipment
    const filtered = this.filterByEquipment(exercises, preferences.availableEquipment);

    // 3. Build prompt
    const prompt = this.buildPrompt(preferences, filtered);

    // 4. Call Ollama
    const rawPlan = await this.callOllama(prompt);

    // 5. Map AI exercise names to real exercise IDs
    const { mappedDays, warnings } = this.mapExercisesToIds(rawPlan.days, exercises);

    // 6. Create templates in database
    const templates = await this.createTemplates(userId, rawPlan.planName, mappedDays);

    return {
      planName: rawPlan.planName,
      templates,
      warnings,
    };
  }

  async getExerciseLibrary(userId: string): Promise<ExerciseRecord[]> {
    const exercises = await prisma.exercise.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
      },
      include: {
        muscleGroup: true,
        category: true,
      },
    });

    return exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      type: ex.type,
      muscleGroup: ex.muscleGroup?.name ?? null,
      category: ex.category?.name ?? null,
      aliases: ex.aliases ? JSON.parse(ex.aliases) : [],
    }));
  }

  filterByEquipment(exercises: ExerciseRecord[], equipment: string[]): ExerciseRecord[] {
    if (!equipment.length) return exercises;

    // Equipment names map to category names (e.g., "Barbell", "Dumbbell", "Bodyweight")
    const equipmentLower = equipment.map((e) => e.toLowerCase());

    return exercises.filter((ex) => {
      if (!ex.category) return true; // Include exercises without a category
      return equipmentLower.includes(ex.category.toLowerCase());
    });
  }

  buildPrompt(
    preferences: GenerateWorkoutPlanDto,
    exercises: ExerciseRecord[]
  ): { system: string; user: string } {
    const exerciseList = exercises.map((ex) => ({
      name: ex.name,
      muscle: ex.muscleGroup,
      category: ex.category,
      type: ex.type,
    }));

    const system = `You are a certified personal trainer creating workout programs. Respond with ONLY valid JSON matching the exact schema provided. Select exercises ONLY from the provided exercise list using their EXACT names. Do not invent exercises.`;

    const user = `Create a ${preferences.daysPerWeek}-day workout split for someone with the following profile:
- Goal: ${preferences.goal}
- Experience Level: ${preferences.experienceLevel}
- Session Duration: ${preferences.sessionDurationMinutes} minutes
- Focus Areas: ${preferences.focusAreas.length ? preferences.focusAreas.join(', ') : 'General'}
- Include Cardio: ${preferences.includeCardio ? 'Yes' : 'No'}

AVAILABLE EXERCISES (use EXACT names from this list):
${JSON.stringify(exerciseList, null, 0)}

RESPONSE FORMAT — return ONLY this JSON structure, no other text:
{
  "planName": "Name of the Plan",
  "days": [
    {
      "dayName": "Day 1 - Chest & Triceps",
      "description": "Brief description of this day's focus",
      "exercises": [
        {
          "name": "Exact Exercise Name From List",
          "sets": 3,
          "reps": 10,
          "restSeconds": 90,
          "notes": "Optional form cue"
        }
      ]
    }
  ]
}

RULES:
- For STRENGTH exercises: include "sets" and "reps". ${
      preferences.experienceLevel === 'BEGINNER'
        ? 'Use 2-3 sets, 10-15 reps.'
        : preferences.experienceLevel === 'INTERMEDIATE'
        ? 'Use 3-4 sets, 8-12 reps.'
        : 'Use 4-5 sets, 5-8 reps for compounds, 8-12 for isolation.'
    }
- For CARDIO exercises: include "sets": 1 and "durationMinutes" instead of "reps".
- Each day should have 4-8 exercises depending on session duration.
- Make sure exercise selection aligns with the stated focus areas.
- Use a logical workout split (e.g., push/pull/legs, upper/lower, full body).
- Include warm-up and compound movements first, isolation movements last.`;

    return { system, user };
  }

  async callOllama(prompt: { system: string; user: string }): Promise<AiRawWorkoutPlan> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Ollama returned ${response.status}: ${text}`);
      }

      const data: any = await response.json();
      let content: string = data.choices?.[0]?.message?.content ?? '';

      // Strip markdown code blocks if present
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

      const parsed = JSON.parse(content) as AiRawWorkoutPlan;

      // Basic validation
      if (!parsed.planName || !Array.isArray(parsed.days) || parsed.days.length === 0) {
        throw new Error('Invalid plan structure from AI');
      }

      return parsed;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw Object.assign(new Error('Ollama request timed out after 120 seconds'), {
          statusCode: 504,
        });
      }
      if (error instanceof SyntaxError) {
        throw Object.assign(new Error('AI returned invalid JSON'), { statusCode: 502 });
      }
      if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
        throw Object.assign(new Error('Cannot connect to Ollama. Is it running?'), {
          statusCode: 503,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  mapExercisesToIds(
    days: AiRawWorkoutDay[],
    exercises: ExerciseRecord[]
  ): { mappedDays: MappedDay[]; warnings: string[] } {
    const warnings: string[] = [];

    // Build lookup maps
    const byNameLower = new Map<string, ExerciseRecord>();
    const byAlias = new Map<string, ExerciseRecord>();

    for (const ex of exercises) {
      byNameLower.set(ex.name.toLowerCase(), ex);
      for (const alias of ex.aliases) {
        byAlias.set(alias.toLowerCase(), ex);
      }
    }

    const mappedDays: MappedDay[] = days.map((day) => {
      const mappedExercises: MappedExercise[] = [];

      for (const rawEx of day.exercises) {
        const nameLower = rawEx.name.toLowerCase().trim();

        // Tier 1: Exact name match
        let match = byNameLower.get(nameLower);

        // Tier 2: Alias match
        if (!match) {
          match = byAlias.get(nameLower);
        }

        // Tier 3: Fuzzy match
        if (!match) {
          match = this.fuzzyMatch(nameLower, exercises);
          if (match) {
            warnings.push(`Matched "${rawEx.name}" to "${match.name}" (fuzzy match)`);
          }
        }

        if (match) {
          mappedExercises.push({
            exerciseId: match.id,
            name: match.name,
            type: match.type,
            sets: rawEx.sets,
            reps: rawEx.reps,
            durationMinutes: rawEx.durationMinutes,
            restSeconds: rawEx.restSeconds,
            notes: rawEx.notes,
          });
        } else {
          warnings.push(`Skipped "${rawEx.name}" — no matching exercise found`);
        }
      }

      return {
        dayName: day.dayName,
        description: day.description,
        exercises: mappedExercises,
      };
    });

    return { mappedDays, warnings };
  }

  fuzzyMatch(name: string, exercises: ExerciseRecord[]): ExerciseRecord | undefined {
    let bestMatch: ExerciseRecord | undefined = undefined;
    let bestDistance = Infinity;

    for (const ex of exercises) {
      const d = levenshtein(name, ex.name.toLowerCase());
      // Threshold: allow up to 30% of the longer string's length
      const maxLen = Math.max(name.length, ex.name.length);
      const threshold = Math.ceil(maxLen * 0.3);

      if (d < bestDistance && d <= threshold) {
        bestDistance = d;
        bestMatch = ex;
      }
    }

    return bestMatch;
  }

  async createTemplates(
    userId: string,
    planName: string,
    mappedDays: MappedDay[]
  ): Promise<GenerateWorkoutPlanResponse['templates']> {
    return prisma.$transaction(async (tx) => {
      const templates: GenerateWorkoutPlanResponse['templates'] = [];

      for (let i = 0; i < mappedDays.length; i++) {
        const day = mappedDays[i];

        const template = await tx.workoutTemplate.create({
          data: {
            userId,
            name: day.dayName,
            description: day.description,
            color: DAY_COLORS[i % DAY_COLORS.length],
            templateExercises: {
              create: day.exercises.map((ex, idx) => ({
                exerciseId: ex.exerciseId,
                orderIndex: idx,
                targetSets: ex.type === 'STRENGTH' ? ex.sets : (ex.sets || 1),
                targetReps: ex.type === 'STRENGTH' ? (ex.reps ?? 10) : null,
                targetDurationMinutes: ex.type === 'CARDIO' ? (ex.durationMinutes ?? null) : null,
                restBetweenSets: ex.restSeconds ?? 90,
                notes: ex.notes ?? null,
              })),
            },
          },
          include: {
            templateExercises: {
              include: {
                exercise: {
                  select: { id: true, name: true, type: true },
                },
              },
              orderBy: { orderIndex: 'asc' },
            },
          },
        });

        templates.push(template);
      }

      return templates;
    });
  }
}

// Simple Levenshtein distance (no external dependency)
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

export const aiService = new AiService();
