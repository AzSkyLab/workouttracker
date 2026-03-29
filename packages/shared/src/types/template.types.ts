import { Exercise } from './exercise.types.js';

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  isActive: boolean;
  templateExercises?: TemplateExercise[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateExercise {
  id: string;
  templateId: string;
  exerciseId: string;
  orderIndex: number;
  targetSets?: number | null;
  targetReps?: number | null;
  restBetweenSets?: number | null;
  restAfterExercise?: number | null;
  targetDurationMinutes?: number | null;
  targetDistanceMiles?: number | null;
  tempo?: string | null;
  notes?: string | null;
  exercise?: Exercise;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

export interface AddExerciseToTemplateDto {
  exerciseId: string;
  targetSets?: number;
  targetReps?: number;
  restBetweenSets?: number;
  restAfterExercise?: number;
  targetDurationMinutes?: number;
  targetDistanceMiles?: number;
  tempo?: string;
  notes?: string;
}

export interface UpdateTemplateExerciseDto {
  targetSets?: number;
  targetReps?: number;
  restBetweenSets?: number;
  restAfterExercise?: number;
  targetDurationMinutes?: number;
  targetDistanceMiles?: number;
  tempo?: string;
  notes?: string;
}

export interface ReorderTemplateExercisesDto {
  exerciseIds: string[];
}
