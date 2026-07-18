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
  'Farmer Carry',
  'Suitcase Carry',
  'Split Squat',
  'Landmine Rotation',
  'Kettlebell Swing',
];

interface TemplateExerciseInput {
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  restBetweenSets: number;
  restAfterExercise: number;
  tempo: string | null;
  notes: string | null;
}

const templates: { name: string; description: string; color: string; exercises: TemplateExerciseInput[] }[] = [
  {
    name: 'Day 1 — Strength Base',
    description: 'Full-body strength across all six movement patterns: push, pull, squat, hinge, carry, rotate.',
    color: '#14b8a6',
    exercises: [
      { exerciseName: 'Dumbbell Bench Press', targetSets: 3, targetReps: 8, restBetweenSets: 90, restAfterExercise: 120, tempo: '3-1-2-0', notes: 'PUSH — 6-10 reps' },
      { exerciseName: 'Dumbbell Row', targetSets: 3, targetReps: 10, restBetweenSets: 75, restAfterExercise: 120, tempo: '2-1-2-1', notes: 'PULL — one arm, 8-12 each side' },
      { exerciseName: 'Goblet Squat', targetSets: 3, targetReps: 10, restBetweenSets: 90, restAfterExercise: 120, tempo: '3-1-2-0', notes: 'SQUAT — 8-12 reps, DB at chest' },
      { exerciseName: 'Romanian Deadlift', targetSets: 3, targetReps: 8, restBetweenSets: 90, restAfterExercise: 120, tempo: '3-0-2-1', notes: 'HINGE — 6-10 reps, feel hamstrings' },
      { exerciseName: 'Farmer Carry', targetSets: 4, targetReps: 1, restBetweenSets: 60, restAfterExercise: 90, tempo: null, notes: 'CARRY — 30-45 sec per set, heavy DBs' },
      { exerciseName: 'Pallof Press', targetSets: 3, targetReps: 12, restBetweenSets: 45, restAfterExercise: 0, tempo: '2-2-2-0', notes: 'ROTATE — 10-12 each side, anti-rotation' },
    ],
  },
  {
    name: 'Day 2 — Volume + Joint-Friendly',
    description: 'Higher volume with joint-friendly variations. Same six patterns, lower joint stress.',
    color: '#6366f1',
    exercises: [
      { exerciseName: 'Push-ups', targetSets: 3, targetReps: 15, restBetweenSets: 75, restAfterExercise: 120, tempo: '3-0-2-0', notes: 'PUSH — close to failure, elevate hands if needed' },
      { exerciseName: 'Lat Pulldown', targetSets: 3, targetReps: 10, restBetweenSets: 75, restAfterExercise: 120, tempo: '3-1-2-0', notes: 'PULL — 8-12 reps, or assisted pull-up' },
      { exerciseName: 'Split Squat', targetSets: 3, targetReps: 10, restBetweenSets: 75, restAfterExercise: 120, tempo: '3-0-2-0', notes: 'SQUAT — 8-10 each leg, both feet on floor' },
      { exerciseName: 'Hip Thrust', targetSets: 3, targetReps: 12, restBetweenSets: 75, restAfterExercise: 120, tempo: '2-2-2-0', notes: 'HINGE — 10-12 reps, pause & squeeze at top' },
      { exerciseName: 'Suitcase Carry', targetSets: 3, targetReps: 1, restBetweenSets: 60, restAfterExercise: 90, tempo: null, notes: 'CARRY — 30-45 sec each side, stay level' },
      { exerciseName: 'Cable Woodchoppers', targetSets: 3, targetReps: 10, restBetweenSets: 45, restAfterExercise: 0, tempo: '2-0-2-0', notes: 'ROTATE — 10 each side, rotate through hips' },
    ],
  },
  {
    name: 'Day 3 — Power + Athletic Strength',
    description: 'Explosive and athletic work. Heavier compounds up front, power hinge and mixed carries after.',
    color: '#ec4899',
    exercises: [
      { exerciseName: 'Overhead Press', targetSets: 3, targetReps: 8, restBetweenSets: 90, restAfterExercise: 120, tempo: '2-1-2-0', notes: 'PUSH — 6-10 reps, strict form' },
      { exerciseName: 'Seal Row', targetSets: 3, targetReps: 10, restBetweenSets: 75, restAfterExercise: 120, tempo: '2-1-2-1', notes: 'PULL — chest-supported, 8-12 reps' },
      { exerciseName: 'Front Squat', targetSets: 3, targetReps: 8, restBetweenSets: 120, restAfterExercise: 150, tempo: '3-1-2-0', notes: 'SQUAT — 6-10 reps, or leg press' },
      { exerciseName: 'Kettlebell Swing', targetSets: 6, targetReps: 10, restBetweenSets: 60, restAfterExercise: 120, tempo: null, notes: 'HINGE/POWER — explosive hip snap, not an arm raise' },
      { exerciseName: 'Farmer Carry', targetSets: 3, targetReps: 1, restBetweenSets: 45, restAfterExercise: 0, tempo: null, notes: 'MIXED CARRY 1/2 — ~1 min per set (~3 of 6 min total)' },
      { exerciseName: 'Suitcase Carry', targetSets: 3, targetReps: 1, restBetweenSets: 45, restAfterExercise: 90, tempo: null, notes: 'MIXED CARRY 2/2 — ~1 min per set, alternate sides (~3 of 6 min total)' },
      { exerciseName: 'Landmine Rotation', targetSets: 3, targetReps: 8, restBetweenSets: 45, restAfterExercise: 0, tempo: '2-0-2-0', notes: 'ROTATE — 8 each side, pivot the back foot' },
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
      // Farmer Carry predated this script (created via the admin UI) and was filed
      // under SHOULDERS. Realign classification to exercise-data.json so the two
      // carries don't sit in different muscle groups.
      if (existing.muscleGroupId !== muscleGroupId || existing.categoryId !== categoryId) {
        await prisma.exercise.update({
          where: { id: existing.id },
          data: { muscleGroupId, categoryId },
        });
        console.log(`Reclassified exercise: ${data.name} -> ${data.muscleGroup}/${data.category}`);
      } else {
        console.log(`Exercise already exists: ${data.name}`);
      }
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
        },
      });
    }

    console.log(`Created template: ${template.name} (${template.exercises.length} exercises)`);
  }

  // Schedule the three days across the week. dayOfWeek is 0=Sunday..6=Saturday.
  // Mon/Wed/Fri leaves a recovery day between each full-body session.
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const schedule: { templateName: string; dayOfWeek: number }[] = [
    { templateName: 'Day 1 — Strength Base', dayOfWeek: 1 },
    { templateName: 'Day 2 — Volume + Joint-Friendly', dayOfWeek: 3 },
    { templateName: 'Day 3 — Power + Athletic Strength', dayOfWeek: 5 },
  ];

  for (const entry of schedule) {
    const template = await prisma.workoutTemplate.findFirst({
      where: { userId: user.id, name: entry.templateName },
    });
    if (!template) {
      console.error(`  Cannot schedule — template not found: ${entry.templateName}`);
      continue;
    }

    // Unique constraint is (userId, dayOfWeek), so an existing entry for that day
    // belongs to a different template and shouldn't be silently replaced.
    const occupied = await prisma.workoutSchedule.findFirst({
      where: { userId: user.id, dayOfWeek: entry.dayOfWeek },
      include: { template: true },
    });
    if (occupied) {
      if (occupied.templateId === template.id) {
        console.log(`Already scheduled: ${DAY_NAMES[entry.dayOfWeek]} -> ${entry.templateName}`);
      } else {
        console.log(
          `  ${DAY_NAMES[entry.dayOfWeek]} already taken by "${occupied.template.name}" — leaving it, skipping ${entry.templateName}`
        );
      }
      continue;
    }

    await prisma.workoutSchedule.create({
      data: { userId: user.id, templateId: template.id, dayOfWeek: entry.dayOfWeek },
    });
    console.log(`Scheduled: ${DAY_NAMES[entry.dayOfWeek]} -> ${entry.templateName}`);
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
