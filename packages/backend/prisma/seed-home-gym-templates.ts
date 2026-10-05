import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ExerciseData {
  name: string;
  description: string;
  muscleGroup: string | null;
  category: string | null;
  type: 'STRENGTH' | 'CARDIO';
  metValue: number | null;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null;
  force: 'PUSH' | 'PULL' | 'STATIC' | null;
  mechanic: 'COMPOUND' | 'ISOLATION' | null;
  secondaryMuscles: string[] | null;
  specificMuscle: string | null;
  videoUrl: string | null;
  aliases: string[] | null;
  instructions: string | null;
}

// Exercises this plan needs that weren't in the library before. Definitions live in
// exercise-data.json so a full `npm run prisma:seed` keeps them; this script pulls
// them from the same file so it stays runnable on its own.
const NEW_EXERCISE_NAMES = [
  'Dumbbell Romanian Deadlift',
  'Band Lat Pulldown',
];

interface TemplateExerciseInput {
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  restBetweenSets: number;
  restAfterExercise: number;
  tempo: string | null;
  notes: string | null;
  targetDurationMinutes?: number;
}

// From diet_and_home_gym_routine_final_v3.html: two alternating full-body sessions,
// 4 working sets on the primary squat/lunge and hinge, 3 on everything else, then
// 15 min moderate bike. Rest: ~2 min for compounds, 60-90 sec for smaller lifts.
const templates: { name: string; description: string; color: string; exercises: TemplateExerciseInput[] }[] = [
  {
    name: 'Home Gym — Workout A',
    description: 'Full body, alternate with Workout B (Week A: A/B/A, Week B: B/A/B). Warm up 5 min easy bike first. Leave 2-3 good reps in every set.',
    color: '#f59e0b',
    exercises: [
      { exerciseName: 'Goblet Squat', targetSets: 4, targetReps: 10, restBetweenSets: 120, restAfterExercise: 120, tempo: null, notes: 'SQUAT — 8-12 reps' },
      { exerciseName: 'Dumbbell Romanian Deadlift', targetSets: 4, targetReps: 10, restBetweenSets: 120, restAfterExercise: 120, tempo: null, notes: 'HINGE — 8-12 reps' },
      { exerciseName: 'Barbell Bench Press', targetSets: 3, targetReps: 10, restBetweenSets: 120, restAfterExercise: 120, tempo: null, notes: 'PUSH — 8-12 reps. Only with a stable bench and safeties set; never bench alone without them' },
      { exerciseName: 'Dumbbell Row', targetSets: 3, targetReps: 10, restBetweenSets: 120, restAfterExercise: 120, tempo: null, notes: 'PULL — one arm, 8-12 per side' },
      { exerciseName: 'Overhead Press', targetSets: 3, targetReps: 10, restBetweenSets: 120, restAfterExercise: 90, tempo: null, notes: 'SHOULDERS — standing barbell, 8-12 reps' },
      { exerciseName: 'EZ-Bar Curl', targetSets: 3, targetReps: 12, restBetweenSets: 75, restAfterExercise: 75, tempo: null, notes: 'ARMS — 10-15 reps' },
      { exerciseName: 'Dead Bug', targetSets: 3, targetReps: 10, restBetweenSets: 60, restAfterExercise: 120, tempo: null, notes: 'CORE — 8-12 per side' },
      { exerciseName: 'Cycling', targetSets: 1, targetReps: 1, restBetweenSets: 0, restAfterExercise: 0, tempo: null, notes: 'NordicTrack, moderate 5-6/10 — can talk, not sing', targetDurationMinutes: 15 },
    ],
  },
  {
    name: 'Home Gym — Workout B',
    description: 'Full body, alternate with Workout A (Week A: A/B/A, Week B: B/A/B). Warm up 5 min easy bike first. Leave 2-3 good reps in every set.',
    color: '#0ea5e9',
    exercises: [
      { exerciseName: 'Split Squat', targetSets: 4, targetReps: 10, restBetweenSets: 120, restAfterExercise: 120, tempo: null, notes: 'SQUAT — 8-10 per leg, dumbbells' },
      { exerciseName: 'Romanian Deadlift', targetSets: 4, targetReps: 10, restBetweenSets: 120, restAfterExercise: 120, tempo: null, notes: 'HINGE — barbell, 8-12 reps' },
      { exerciseName: 'Push-ups', targetSets: 3, targetReps: 12, restBetweenSets: 90, restAfterExercise: 120, tempo: null, notes: 'PUSH — 8-15 reps, knees if needed' },
      { exerciseName: 'Band Lat Pulldown', targetSets: 3, targetReps: 12, restBetweenSets: 90, restAfterExercise: 90, tempo: null, notes: 'PULL — 10-15 reps. Needs a secure high anchor; otherwise swap for one-arm dumbbell row' },
      { exerciseName: 'Lateral Raises', targetSets: 3, targetReps: 12, restBetweenSets: 75, restAfterExercise: 75, tempo: null, notes: 'SHOULDERS — 12-15 reps' },
      { exerciseName: 'Overhead Tricep Extension', targetSets: 3, targetReps: 12, restBetweenSets: 75, restAfterExercise: 75, tempo: null, notes: 'ARMS — one dumbbell, 10-15 reps' },
      { exerciseName: 'Side Plank', targetSets: 3, targetReps: 1, restBetweenSets: 60, restAfterExercise: 120, tempo: null, notes: 'CORE — 20-45 sec hold per side; add time before anything else' },
      { exerciseName: 'Cycling', targetSets: 1, targetReps: 1, restBetweenSets: 0, restAfterExercise: 0, tempo: null, notes: 'NordicTrack, moderate 5-6/10 — can talk, not sing', targetDurationMinutes: 15 },
    ],
  },
];

async function main() {
  // Ensure the new exercises exist, sourcing definitions from exercise-data.json
  const exerciseDataPath = join(__dirname, 'exercise-data.json');
  const allExerciseData: ExerciseData[] = JSON.parse(readFileSync(exerciseDataPath, 'utf-8'));

  const muscleGroupMap = new Map<string, string>();
  for (const mg of await prisma.muscleGroup.findMany()) {
    muscleGroupMap.set(mg.name, mg.id);
  }
  const categoryMap = new Map<string, string>();
  for (const cat of await prisma.exerciseCategory.findMany()) {
    categoryMap.set(cat.name, cat.id);
  }

  for (const name of NEW_EXERCISE_NAMES) {
    const data = allExerciseData.find((e) => e.name === name);
    if (!data) {
      console.error(`  Definition missing from exercise-data.json: ${name}`);
      process.exit(1);
    }

    const muscleGroupId = data.muscleGroup ? muscleGroupMap.get(data.muscleGroup) : undefined;
    const categoryId = data.category ? categoryMap.get(data.category) : undefined;

    const existing = await prisma.exercise.findFirst({ where: { name: data.name } });
    if (existing) {
      console.log(`Exercise already exists: ${data.name}`);
      continue;
    }

    await prisma.exercise.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        metValue: data.metValue ?? undefined,
        muscleGroupId,
        categoryId,
        difficulty: data.difficulty ?? undefined,
        force: data.force ?? undefined,
        mechanic: data.mechanic ?? undefined,
        secondaryMuscles: data.secondaryMuscles ? JSON.stringify(data.secondaryMuscles) : undefined,
        specificMuscle: data.specificMuscle ?? undefined,
        videoUrl: data.videoUrl ?? undefined,
        aliases: data.aliases ? JSON.stringify(data.aliases) : undefined,
        instructions: data.instructions ?? undefined,
      },
    });
    console.log(`Created exercise: ${data.name}`);
  }

  // Get the first user to assign templates to
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found. Create a user first.');
    process.exit(1);
  }
  console.log(`Creating templates for user: ${user.firstName} ${user.lastName} (${user.email})`);

  // Build exercise name -> id lookup
  const allExercises = await prisma.exercise.findMany();
  const exerciseByName: Record<string, string> = {};
  for (const e of allExercises) {
    exerciseByName[e.name.toLowerCase()] = e.id;
  }

  for (const template of templates) {
    const existing = await prisma.workoutTemplate.findFirst({
      where: { userId: user.id, name: template.name },
    });
    if (existing) {
      console.log(`Template already exists: ${template.name}, skipping`);
      continue;
    }

    // Verify every exercise resolves before creating the template, so a typo
    // can't leave a half-populated template behind.
    const missing = template.exercises
      .map((ex) => ex.exerciseName)
      .filter((name) => !exerciseByName[name.toLowerCase()]);
    if (missing.length > 0) {
      console.error(`  Skipping ${template.name} — exercises not found: ${missing.join(', ')}`);
      continue;
    }

    const created = await prisma.workoutTemplate.create({
      data: {
        userId: user.id,
        name: template.name,
        description: template.description,
        color: template.color,
      },
    });

    for (let i = 0; i < template.exercises.length; i++) {
      const ex = template.exercises[i];
      await prisma.templateExercise.create({
        data: {
          templateId: created.id,
          exerciseId: exerciseByName[ex.exerciseName.toLowerCase()],
          orderIndex: i,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          restBetweenSets: ex.restBetweenSets,
          restAfterExercise: ex.restAfterExercise,
          tempo: ex.tempo,
          notes: ex.notes,
          targetDurationMinutes: ex.targetDurationMinutes,
        },
      });
    }

    console.log(`Created template: ${template.name} (${template.exercises.length} exercises)`);
  }

  // Not scheduled: the plan alternates A and B week to week (A/B/A then B/A/B),
  // which WorkoutSchedule's one-template-per-weekday model can't express.

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
