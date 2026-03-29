import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Map exercise names from the plan to DB exercise names
const exerciseMap: Record<string, string> = {
  'Barbell Bench Press': 'Barbell Bench Press',
  'Incline Dumbbell Press': 'Incline Dumbbell Press',
  'Overhead Press': 'Overhead Press',
  'Lateral Raises': 'Lateral Raises',
  'Dips': 'Dips',
  'Overhead Tricep Extension': 'Overhead Tricep Extension',
  'Ab Wheel Rollout': 'Ab Wheel Rollout',
  'Hanging Leg Raise': 'Hanging Leg Raise',
  'Cycling': 'Cycling',
  'Boxing': 'Boxing',
  'Pull-ups': 'Pull-ups',
  'Pendlay Row': 'Pendlay Row',
  'Lat Pulldown': 'Lat Pulldown',
  'Cable Row': 'Cable Row',
  'Face Pull': 'Face Pull',
  'EZ-Bar Curl': 'EZ-Bar Curl',
  'Hammer Curl': 'Hammer Curl',
  'Box Squat': 'Box Squat',
  'Romanian Deadlift': 'Romanian Deadlift',
  'Goblet Squat': 'Goblet Squat',
  'Hip Thrust': 'Hip Thrust',
  'Walking Lunges': 'Walking Lunges',
  'Calf Raises': 'Calf Raises',
  'Close-Grip Bench Press': 'Close-Grip Bench Press',
  'Skull Crushers': 'Skull Crushers',
  'Incline Dumbbell Curl': 'Incline Dumbbell Curl',
  'Tricep Pushdown': 'Tricep Pushdown',
  'Band Pull-Apart': 'Band Pull-Apart',
  'Incline Barbell Bench Press': 'Incline Barbell Bench Press',
  'Dumbbell Flyes': 'Dumbbell Flyes',
  'Arnold Press': 'Arnold Press',
  'Cable Lateral Raise': 'Cable Lateral Raise',
  'Dumbbell Row': 'Dumbbell Row',
};

interface TemplateExerciseInput {
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  restBetweenSets: number;
  restAfterExercise: number;
  tempo: string | null;
  notes: string | null;
  // For cardio
  targetDurationMinutes?: number;
  targetDistanceMiles?: number;
}

const templates: { name: string; description: string; color: string; exercises: TemplateExerciseInput[] }[] = [
  {
    name: 'Monday — Push + Core',
    description: 'Chest, shoulders, and triceps with core finisher.',
    color: '#3b82f6',
    exercises: [
      { exerciseName: 'Barbell Bench Press', targetSets: 4, targetReps: 8, restBetweenSets: 90, restAfterExercise: 120, tempo: '3-1-2-0', notes: 'Main lift' },
      { exerciseName: 'Incline Dumbbell Press', targetSets: 3, targetReps: 12, restBetweenSets: 75, restAfterExercise: 120, tempo: '3-0-2-0', notes: '30° incline' },
      { exerciseName: 'Overhead Press', targetSets: 3, targetReps: 10, restBetweenSets: 90, restAfterExercise: 120, tempo: '2-1-2-0', notes: 'Strict form' },
      { exerciseName: 'Lateral Raises', targetSets: 3, targetReps: 15, restBetweenSets: 60, restAfterExercise: 90, tempo: '2-1-2-0', notes: 'Light & controlled' },
      { exerciseName: 'Dips', targetSets: 3, targetReps: 12, restBetweenSets: 75, restAfterExercise: 90, tempo: '3-0-2-0', notes: 'Lean forward for chest' },
      { exerciseName: 'Overhead Tricep Extension', targetSets: 3, targetReps: 15, restBetweenSets: 60, restAfterExercise: 90, tempo: '2-1-2-0', notes: 'Single DB, both hands' },
      { exerciseName: 'Ab Wheel Rollout', targetSets: 3, targetReps: 12, restBetweenSets: 60, restAfterExercise: 60, tempo: '3-1-2-0', notes: 'From knees' },
      { exerciseName: 'Hanging Leg Raise', targetSets: 3, targetReps: 15, restBetweenSets: 60, restAfterExercise: 0, tempo: '2-1-2-0', notes: 'Bent knees OK' },
    ],
  },
  {
    name: 'Tuesday — Cardio + Heavy Bag',
    description: 'Pure conditioning. Quick and intense. ~55 minutes, 500-700 calorie burn.',
    color: '#ef4444',
    exercises: [
      { exerciseName: 'Cycling', targetSets: 1, targetReps: 1, restBetweenSets: 0, restAfterExercise: 60, tempo: null, notes: 'Warm-up: 5 min easy pace', targetDurationMinutes: 5 },
      { exerciseName: 'Cycling', targetSets: 1, targetReps: 1, restBetweenSets: 0, restAfterExercise: 120, tempo: null, notes: 'Intervals: 30 sec sprint / 60 sec easy x 13', targetDurationMinutes: 20 },
      { exerciseName: 'Boxing', targetSets: 5, targetReps: 1, restBetweenSets: 60, restAfterExercise: 120, tempo: null, notes: '3 min rounds — mix jab-cross-hook combos', targetDurationMinutes: 3 },
      { exerciseName: 'Boxing', targetSets: 2, targetReps: 1, restBetweenSets: 30, restAfterExercise: 120, tempo: null, notes: 'Burnout: 1 min all-out non-stop punches', targetDurationMinutes: 1 },
      { exerciseName: 'Cycling', targetSets: 1, targetReps: 1, restBetweenSets: 0, restAfterExercise: 0, tempo: null, notes: 'Cool-down: 5 min easy spin', targetDurationMinutes: 5 },
    ],
  },
  {
    name: 'Wednesday — Pull + Core',
    description: 'Back and biceps with core finisher.',
    color: '#22c55e',
    exercises: [
      { exerciseName: 'Pull-ups', targetSets: 4, targetReps: 10, restBetweenSets: 90, restAfterExercise: 120, tempo: '2-1-2-0', notes: 'AMRAP — use band if needed' },
      { exerciseName: 'Pendlay Row', targetSets: 4, targetReps: 8, restBetweenSets: 90, restAfterExercise: 120, tempo: '1-0-1-1', notes: 'From floor each rep' },
      { exerciseName: 'Lat Pulldown', targetSets: 3, targetReps: 12, restBetweenSets: 75, restAfterExercise: 90, tempo: '3-1-2-0', notes: 'Cable pulley, wide grip' },
      { exerciseName: 'Cable Row', targetSets: 3, targetReps: 12, restBetweenSets: 75, restAfterExercise: 90, tempo: '2-1-2-1', notes: 'Cable pulley, squeeze at chest' },
      { exerciseName: 'Face Pull', targetSets: 3, targetReps: 20, restBetweenSets: 60, restAfterExercise: 90, tempo: '2-2-2-0', notes: 'Cable pulley or band' },
      { exerciseName: 'EZ-Bar Curl', targetSets: 3, targetReps: 12, restBetweenSets: 60, restAfterExercise: 90, tempo: '2-1-2-0', notes: 'Wide grip, strict form' },
      { exerciseName: 'Hammer Curl', targetSets: 3, targetReps: 15, restBetweenSets: 60, restAfterExercise: 60, tempo: '2-0-2-0', notes: 'Seated on incline bench' },
      { exerciseName: 'Ab Wheel Rollout', targetSets: 3, targetReps: 12, restBetweenSets: 60, restAfterExercise: 0, tempo: '3-1-2-0', notes: 'From knees' },
    ],
  },
  {
    name: 'Thursday — Legs + Heavy Bag',
    description: 'Knee-friendly leg day with posterior chain emphasis, plus bag work for conditioning.',
    color: '#a855f7',
    exercises: [
      { exerciseName: 'Box Squat', targetSets: 4, targetReps: 8, restBetweenSets: 120, restAfterExercise: 180, tempo: '3-1-2-0', notes: 'Sit fully on box, explode up' },
      { exerciseName: 'Romanian Deadlift', targetSets: 4, targetReps: 10, restBetweenSets: 90, restAfterExercise: 120, tempo: '3-0-2-1', notes: 'Hip hinge, feel hamstrings' },
      { exerciseName: 'Goblet Squat', targetSets: 3, targetReps: 15, restBetweenSets: 75, restAfterExercise: 120, tempo: '3-1-2-0', notes: 'Heel-elevated — plates under heels, DB at chest' },
      { exerciseName: 'Hip Thrust', targetSets: 3, targetReps: 12, restBetweenSets: 75, restAfterExercise: 120, tempo: '2-2-2-0', notes: 'Barbell — pause & squeeze at top' },
      { exerciseName: 'Walking Lunges', targetSets: 3, targetReps: 10, restBetweenSets: 75, restAfterExercise: 90, tempo: '2-0-2-0', notes: 'DB, 10/leg — short stride, upright torso' },
      { exerciseName: 'Calf Raises', targetSets: 4, targetReps: 20, restBetweenSets: 60, restAfterExercise: 120, tempo: '2-2-1-0', notes: 'Barbell on back, slow' },
      { exerciseName: 'Boxing', targetSets: 4, targetReps: 1, restBetweenSets: 60, restAfterExercise: 0, tempo: null, notes: '3 min rounds — focus on footwork + power', targetDurationMinutes: 3 },
    ],
  },
  {
    name: 'Friday — Cardio + Arms',
    description: 'Active recovery cardio plus dedicated arm work to pre-pump for Saturday upper body.',
    color: '#f97316',
    exercises: [
      { exerciseName: 'Cycling', targetSets: 1, targetReps: 1, restBetweenSets: 0, restAfterExercise: 120, tempo: null, notes: 'Intervals: 40 sec on / 80 sec off x 10', targetDurationMinutes: 20 },
      { exerciseName: 'Close-Grip Bench Press', targetSets: 3, targetReps: 10, restBetweenSets: 75, restAfterExercise: 90, tempo: '3-1-2-0', notes: 'Hands shoulder-width' },
      { exerciseName: 'EZ-Bar Curl', targetSets: 3, targetReps: 12, restBetweenSets: 60, restAfterExercise: 90, tempo: '2-1-2-0', notes: 'Close grip, slow negatives' },
      { exerciseName: 'Skull Crushers', targetSets: 3, targetReps: 15, restBetweenSets: 60, restAfterExercise: 90, tempo: '2-1-2-0', notes: 'EZ bar on bench' },
      { exerciseName: 'Incline Dumbbell Curl', targetSets: 3, targetReps: 12, restBetweenSets: 60, restAfterExercise: 60, tempo: '3-0-2-0', notes: '45° incline bench' },
      { exerciseName: 'Tricep Pushdown', targetSets: 3, targetReps: 20, restBetweenSets: 45, restAfterExercise: 60, tempo: '2-1-1-0', notes: 'Cable pulley, rope handle' },
      { exerciseName: 'Band Pull-Apart', targetSets: 3, targetReps: 20, restBetweenSets: 45, restAfterExercise: 0, tempo: '1-1-1-0', notes: 'Rear delt / posture work' },
    ],
  },
  {
    name: 'Saturday — Upper Body (Pool Day)',
    description: 'Showcase session. Higher volume, pump-focused — chest, shoulders, arms, upper back. Hit the pool 1-2 hours after.',
    color: '#eab308',
    exercises: [
      { exerciseName: 'Incline Barbell Bench Press', targetSets: 4, targetReps: 10, restBetweenSets: 90, restAfterExercise: 120, tempo: '3-0-2-0', notes: 'Build upper chest' },
      { exerciseName: 'Dumbbell Flyes', targetSets: 3, targetReps: 15, restBetweenSets: 60, restAfterExercise: 90, tempo: '3-1-2-0', notes: 'Flat — deep stretch, squeeze' },
      { exerciseName: 'Arnold Press', targetSets: 3, targetReps: 12, restBetweenSets: 75, restAfterExercise: 90, tempo: '2-0-2-0', notes: 'Rotate through press' },
      { exerciseName: 'Cable Lateral Raise', targetSets: 3, targetReps: 20, restBetweenSets: 45, restAfterExercise: 90, tempo: '2-1-2-0', notes: 'Cable pulley or DB if busy' },
      { exerciseName: 'Pull-ups', targetSets: 3, targetReps: 10, restBetweenSets: 90, restAfterExercise: 90, tempo: '2-1-2-0', notes: 'Wide grip — V-taper builder, AMRAP' },
      { exerciseName: 'Dumbbell Row', targetSets: 3, targetReps: 12, restBetweenSets: 60, restAfterExercise: 60, tempo: '2-1-2-1', notes: 'Single arm — full stretch to squeeze' },
      // Superset 1: EZ Curl + Dips
      { exerciseName: 'EZ-Bar Curl', targetSets: 3, targetReps: 12, restBetweenSets: 60, restAfterExercise: 0, tempo: '2-0-2-0', notes: 'SUPERSET with Dips — arm pump finisher' },
      { exerciseName: 'Dips', targetSets: 3, targetReps: 12, restBetweenSets: 60, restAfterExercise: 60, tempo: '2-0-2-0', notes: 'SUPERSET with EZ Curl' },
      // Superset 2: Hammer Curl + Pushdown
      { exerciseName: 'Hammer Curl', targetSets: 3, targetReps: 15, restBetweenSets: 45, restAfterExercise: 0, tempo: '2-0-2-0', notes: 'SUPERSET with Pushdown' },
      { exerciseName: 'Tricep Pushdown', targetSets: 3, targetReps: 15, restBetweenSets: 45, restAfterExercise: 0, tempo: '2-0-2-0', notes: 'SUPERSET with Hammer Curl — cable pulley' },
    ],
  },
];

async function main() {
  // First, seed the new exercises (Box Squat, Band Pull-Apart) if they don't exist
  const newExercises = [
    {
      name: 'Box Squat',
      description: 'Squat variation where you sit back onto a box, reducing knee stress while building explosive power.',
      type: 'STRENGTH',
      muscleGroupName: 'LEGS',
      categoryName: 'BARBELL',
    },
    {
      name: 'Band Pull-Apart',
      description: 'Resistance band exercise targeting rear deltoids and upper back for posture and shoulder health.',
      type: 'STRENGTH',
      muscleGroupName: 'SHOULDERS',
      categoryName: 'BODYWEIGHT',
    },
  ];

  for (const ex of newExercises) {
    const existing = await prisma.exercise.findFirst({ where: { name: ex.name } });
    if (!existing) {
      const muscleGroup = await prisma.muscleGroup.findFirst({ where: { name: ex.muscleGroupName } });
      const category = await prisma.exerciseCategory.findFirst({ where: { name: ex.categoryName } });
      await prisma.exercise.create({
        data: {
          name: ex.name,
          description: ex.description,
          type: ex.type,
          muscleGroupId: muscleGroup?.id,
          categoryId: category?.id,
        },
      });
      console.log(`Created exercise: ${ex.name}`);
    } else {
      console.log(`Exercise already exists: ${ex.name}`);
    }
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
    // Check if template already exists
    const existing = await prisma.workoutTemplate.findFirst({
      where: { userId: user.id, name: template.name },
    });
    if (existing) {
      console.log(`Template already exists: ${template.name}, skipping`);
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
      const exerciseId = exerciseByName[ex.exerciseName.toLowerCase()];
      if (!exerciseId) {
        console.error(`  Exercise not found: ${ex.exerciseName}`);
        continue;
      }

      await prisma.templateExercise.create({
        data: {
          templateId: created.id,
          exerciseId,
          orderIndex: i,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          restBetweenSets: ex.restBetweenSets,
          restAfterExercise: ex.restAfterExercise,
          tempo: ex.tempo,
          notes: ex.notes,
          targetDurationMinutes: ex.targetDurationMinutes,
          targetDistanceMiles: ex.targetDistanceMiles,
        },
      });
    }

    console.log(`Created template: ${template.name} (${template.exercises.length} exercises)`);
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
