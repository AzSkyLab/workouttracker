export const WorkoutStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const;
export type WorkoutStatus = (typeof WorkoutStatus)[keyof typeof WorkoutStatus];

export interface Set {
  id: string;
  workoutExerciseId: string;
  setNumber: number;

  // Strength training fields
  reps?: number;
  weight?: number;
  rpe?: number | null;

  // Cardio fields
  durationMinutes?: number;
  distanceMiles?: number;
  caloriesBurned?: number;

  notes?: string | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  orderIndex: number;
  targetSets: number;
  targetReps: number;
  suggestedWeight?: number;
  previousWeight?: number;
  previousReps?: number;
  completed: boolean;
  restBetweenSets?: number; // in seconds
  restAfterExercise?: number; // in seconds — rest after completing all sets
  tempo?: string | null; // e.g. "3-1-2-0"
  // Cardio-specific targets
  targetDurationMinutes?: number;
  targetDistanceMiles?: number;
  exercise?: {
    id: string;
    name: string;
    muscleGroup: string;
    category: string;
    type?: string;
    metValue?: number;
  };
  sets: Set[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Workout {
  id: string;
  userId: string;
  templateId?: string | null;
  name: string;
  startedAt: Date;
  completedAt: Date | null;
  status: WorkoutStatus;
  workoutExercises: WorkoutExercise[];
  createdAt: Date;
  updatedAt: Date;

  // Calorie tracking fields
  totalCaloriesBurned?: number | null;
  totalActiveTime?: number | null; // in seconds
  totalRestTime?: number | null; // in seconds
}

export interface CreateWorkoutDto {
  name: string;
}

export interface AddExerciseToWorkoutDto {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  restBetweenSets?: number; // in seconds
  restAfterExercise?: number; // in seconds
}

export interface LogSetDto {
  setNumber: number;
  // Strength fields
  reps?: number;
  weight?: number;
  rpe?: number;
  // Cardio fields
  durationMinutes?: number;
  distanceMiles?: number;
  caloriesBurned?: number;
  // Optional metadata
  completed?: boolean;
  notes?: string;
}

export interface UpdateSetDto {
  // Strength fields
  reps?: number;
  weight?: number;
  rpe?: number;
  // Cardio fields
  durationMinutes?: number;
  distanceMiles?: number;
  caloriesBurned?: number;
  completed?: boolean;
  notes?: string;
}

export interface WorkoutSummary {
  id: string;
  name: string;
  startedAt: Date;
  completedAt: Date | null;
  status: WorkoutStatus;
  exerciseCount: number;
  totalSets: number;
  totalCaloriesBurned?: number | null;
  totalActiveTime?: number | null;
  totalRestTime?: number | null;
}

export interface SaveWorkoutAsTemplateDto {
  name: string;
  description?: string;
  color?: string;
}
