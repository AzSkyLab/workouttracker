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
  model?: string;
}

export interface AiModelInfo {
  name: string;
  size: number;
  parameterSize?: string;
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
      restBetweenSets?: number | null;
      notes?: string | null;
      exercise?: {
        id: string;
        name: string;
        type: string;
      };
    }>;
  }>;
  warnings: string[];
  generationTimeSeconds: number;
}

// Internal types for raw AI output before mapping to real exercise IDs
export interface AiRawExercise {
  name: string;
  sets: number;
  reps?: number;
  durationMinutes?: number;
  restSeconds?: number;
  notes?: string;
  reason?: string;
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

// Preview types for the two-step generate → review → save flow
export interface AiPlanPreviewExercise {
  exerciseId: string;
  name: string;
  type: string;
  sets: number;
  reps?: number;
  durationMinutes?: number;
  restSeconds?: number;
  notes?: string;
  reason?: string;
}

export interface AiPlanPreviewDay {
  dayName: string;
  description: string;
  color: string;
  exercises: AiPlanPreviewExercise[];
}

export interface AiPlanPreview {
  planName: string;
  days: AiPlanPreviewDay[];
  warnings: string[];
  generationTimeSeconds: number;
  model?: string;
}

// Payload for saving a reviewed plan
export interface SaveWorkoutPlanDay {
  dayName: string;
  description: string;
  color: string;
  exercises: Array<{
    exerciseId: string;
    sets: number;
    reps?: number;
    durationMinutes?: number;
    restSeconds?: number;
    notes?: string;
    reason?: string;
  }>;
}

export interface SaveWorkoutPlanDto {
  planName: string;
  days: SaveWorkoutPlanDay[];
}
