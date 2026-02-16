export enum FitnessGoal {
  MUSCLE_GAIN = 'MUSCLE_GAIN',
  FAT_LOSS = 'FAT_LOSS',
  STRENGTH = 'STRENGTH',
  GENERAL_FITNESS = 'GENERAL_FITNESS',
  ENDURANCE = 'ENDURANCE',
}

export enum ExperienceLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export interface GenerateWorkoutPlanDto {
  goal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  daysPerWeek: number;
  sessionDurationMinutes: number;
  availableEquipment: string[];
  focusAreas: string[];
  includeCardio: boolean;
}

export interface GenerateWorkoutPlanResponse {
  planName: string;
  templates: Array<{
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    templateExercises?: Array<{
      id: string;
      exerciseId: string;
      orderIndex: number;
      targetSets?: number | null;
      targetReps?: number | null;
      targetDurationMinutes?: number | null;
      exercise?: {
        id: string;
        name: string;
        type: string;
      };
    }>;
  }>;
  warnings: string[];
}

// Internal types for raw AI output before mapping to real exercise IDs
export interface AiRawExercise {
  name: string;
  sets: number;
  reps?: number;
  durationMinutes?: number;
  restSeconds?: number;
  notes?: string;
}

export interface AiRawWorkoutDay {
  dayName: string;
  description: string;
  exercises: AiRawExercise[];
}

export interface AiRawWorkoutPlan {
  planName: string;
  days: AiRawWorkoutDay[];
}
