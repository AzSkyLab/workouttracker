import { prisma } from '../lib/prisma.js';
import {
  CreateWorkoutDto,
  AddExerciseToWorkoutDto,
  LogSetDto,
  UpdateSetDto,
  WorkoutStatus,
  ExerciseType,
  SaveWorkoutAsTemplateDto,
} from '@workout-tracker/shared';
import { progressionService } from './progression.service.js';
import { calorieService } from './calorie.service.js';

export class WorkoutService {
  async createWorkout(userId: string, data: CreateWorkoutDto) {
    return prisma.workout.create({
      data: {
        userId,
        name: data.name,
        status: WorkoutStatus.IN_PROGRESS,
      },
    });
  }

  async getWorkouts(userId: string, limit = 20, offset = 0) {
    const [workouts, total] = await Promise.all([
      prisma.workout.findMany({
        where: { userId },
        include: {
          workoutExercises: {
            include: {
              exercise: true,
              sets: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.workout.count({ where: { userId } }),
    ]);

    return { workouts, total };
  }

  async getWorkoutById(userId: string, workoutId: string) {
    const workout = await prisma.workout.findFirst({
      where: {
        id: workoutId,
        userId,
      },
      include: {
        workoutExercises: {
          include: {
            exercise: true,
            sets: {
              orderBy: { setNumber: 'asc' },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!workout) {
      throw new Error('Workout not found');
    }

    return workout;
  }

  async getActiveWorkout(userId: string) {
    const workout = await prisma.workout.findFirst({
      where: {
        userId,
        status: WorkoutStatus.IN_PROGRESS,
      },
      include: {
        workoutExercises: {
          include: {
            exercise: true,
            sets: {
              orderBy: { setNumber: 'asc' },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return workout;
  }

  async addExerciseToWorkout(
    userId: string,
    workoutId: string,
    data: AddExerciseToWorkoutDto
  ) {
    // Verify workout belongs to user
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId },
      include: { workoutExercises: true },
    });

    if (!workout) {
      throw new Error('Workout not found');
    }

    // Get next order index
    const maxOrder = workout.workoutExercises.reduce(
      (max, ex) => Math.max(max, ex.orderIndex),
      -1
    );

    return prisma.workoutExercise.create({
      data: {
        workoutId,
        exerciseId: data.exerciseId,
        orderIndex: maxOrder + 1,
        targetSets: data.targetSets,
        targetReps: data.targetReps,
        restBetweenSets: data.restBetweenSets,
        restAfterExercise: data.restAfterExercise,
      },
      include: {
        exercise: true,
        sets: true,
      },
    });
  }

  async completeWorkoutExercise(
    userId: string,
    workoutId: string,
    exerciseId: string
  ) {
    // Verify workout belongs to user
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId },
    });

    if (!workout) {
      throw new Error('Workout not found');
    }

    return prisma.workoutExercise.updateMany({
      where: {
        id: exerciseId,
        workoutId,
      },
      data: {
        completed: true,
      },
    });
  }

  async restartWorkout(userId: string, workoutId: string) {
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId },
      include: {
        workoutExercises: {
          include: { exercise: { include: { category: true } } },
        },
      },
    });

    if (!workout) {
      throw new Error('Workout not found');
    }

    // Refresh suggested weights from latest progression data
    for (const we of workout.workoutExercises) {
      if (we.exercise.type === ExerciseType.STRENGTH) {
        const progression = await progressionService.getProgressionForExercise(userId, we.exerciseId);
        if (progression?.lastWorkout?.avgWeight) {
          const previousWeight = progression.lastWorkout.avgWeight;
          const previousReps = progression.lastWorkout.avgReps;
          let suggestedWeight = previousWeight;
          const isDumbbellUnder50 = (we.exercise as any).category?.name === 'DUMBBELL' && previousWeight < 50;
          if (progression.recommendation === 'INCREASE_WEIGHT' && !isDumbbellUnder50) {
            suggestedWeight += 5;
          }
          await prisma.workoutExercise.update({
            where: { id: we.id },
            data: { suggestedWeight, previousWeight, previousReps },
          });
        }
      }
    }

    return prisma.workout.update({
      where: { id: workoutId },
      data: {
        startedAt: new Date(),
      },
    });
  }

  async completeWorkout(userId: string, workoutId: string) {
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId },
    });

    if (!workout) {
      throw new Error('Workout not found');
    }

    const updatedWorkout = await prisma.workout.update({
      where: { id: workoutId },
      data: {
        status: WorkoutStatus.COMPLETED,
        completedAt: workout.completedAt || new Date(),
      },
    });

    // Update progression for all exercises in this workout
    await progressionService.updateProgressionsAfterWorkout(userId, workoutId);

    // Calculate and update calorie data
    try {
      await calorieService.updateWorkoutCalories(workoutId, userId);
    } catch (error) {
      console.error('Failed to calculate workout calories:', error);
      // Don't fail the workout completion if calorie calculation fails
    }

    return updatedWorkout;
  }

  async deleteWorkout(userId: string, workoutId: string) {
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId },
    });

    if (!workout) {
      throw new Error('Workout not found');
    }

    return prisma.workout.delete({
      where: { id: workoutId },
    });
  }

  async logSet(
    userId: string,
    workoutExerciseId: string,
    data: LogSetDto
  ) {
    // Verify workout exercise belongs to user's workout
    const workoutExercise = await prisma.workoutExercise.findFirst({
      where: {
        id: workoutExerciseId,
        workout: {
          userId,
        },
      },
      include: { workout: true },
    });

    if (!workoutExercise) {
      throw new Error('Workout exercise not found');
    }

    const newSet = await prisma.set.create({
      data: {
        workoutExerciseId,
        setNumber: data.setNumber,
        reps: data.reps,
        weight: data.weight,
        rpe: data.rpe,
        durationMinutes: data.durationMinutes,
        distanceMiles: data.distanceMiles,
        caloriesBurned: data.caloriesBurned,
        notes: data.notes,
        completed: data.completed ?? true,
      },
    });

    // Update progression if logging sets on an already-completed workout (e.g., backdated)
    if (workoutExercise.workout.status === WorkoutStatus.COMPLETED) {
      try {
        await progressionService.calculateProgression(userId, workoutExercise.exerciseId);
      } catch (error) {
        console.error('Failed to update progression for completed workout:', error);
      }
    }

    return newSet;
  }

  async updateSet(userId: string, setId: string, data: UpdateSetDto) {
    // Verify set belongs to user's workout and workout is not completed
    const set = await prisma.set.findFirst({
      where: {
        id: setId,
        workoutExercise: {
          workout: {
            userId,
          },
        },
      },
      include: {
        workoutExercise: {
          include: {
            workout: true,
          },
        },
      },
    });

    if (!set) {
      throw new Error('Set not found');
    }

    const updatedSet = await prisma.set.update({
      where: { id: setId },
      data,
    });

    // Update progression if editing sets on an already-completed workout (e.g., backdated)
    if (set.workoutExercise.workout.status === WorkoutStatus.COMPLETED) {
      try {
        await progressionService.calculateProgression(userId, set.workoutExercise.exerciseId);
      } catch (error) {
        console.error('Failed to update progression for completed workout:', error);
      }
    }

    return updatedSet;
  }

  async completeSet(userId: string, setId: string) {
    return this.updateSet(userId, setId, { completed: true });
  }

  async getWorkoutStats(userId: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalWorkouts, weekWorkouts] = await Promise.all([
      prisma.workout.count({
        where: {
          userId,
          status: WorkoutStatus.COMPLETED,
        },
      }),
      prisma.workout.count({
        where: {
          userId,
          status: WorkoutStatus.COMPLETED,
          completedAt: {
            gte: weekAgo,
          },
        },
      }),
    ]);

    return {
      totalWorkouts,
      weekWorkouts,
    };
  }

  async getRecentWorkouts(userId: string, limit = 5) {
    return prisma.workout.findMany({
      where: {
        userId,
        status: WorkoutStatus.COMPLETED,
      },
      include: {
        workoutExercises: {
          include: {
            exercise: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });
  }

  async createWorkoutFromTemplate(userId: string, templateId: string, startDate?: string) {
    // Get the template
    const template = await prisma.workoutTemplate.findFirst({
      where: {
        id: templateId,
        userId,
      },
      include: {
        templateExercises: {
          include: {
            exercise: { include: { category: true } },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!template) {
      throw new Error('Workout template not found');
    }

    // If startDate is provided, create a completed backdated workout
    const isBackdated = !!startDate;
    const backdatedDate = startDate ? new Date(startDate) : undefined;

    // Create new workout
    const newWorkout = await prisma.workout.create({
      data: {
        userId,
        name: template.name,
        templateId: template.id,
        status: isBackdated ? WorkoutStatus.COMPLETED : WorkoutStatus.IN_PROGRESS,
        startedAt: backdatedDate,
        completedAt: isBackdated ? backdatedDate : undefined,
      },
    });

    // Add exercises from template
    for (const templateExercise of template.templateExercises) {
      const exercise = templateExercise.exercise;

      if (exercise.type === ExerciseType.STRENGTH) {
        // For strength exercises, apply progression logic
        const progression = await progressionService.getProgressionForExercise(
          userId,
          exercise.id
        );

        let targetSets = templateExercise.targetSets || 3;
        let targetReps = templateExercise.targetReps || 10;
        let suggestedWeight: number | undefined = undefined;
        let previousWeight: number | undefined = undefined;
        let previousReps: number | undefined = undefined;

        if (progression?.lastWorkout?.avgWeight) {
          previousWeight = progression.lastWorkout.avgWeight;
          previousReps = progression.lastWorkout.avgReps;
          suggestedWeight = previousWeight;

          // Adjust based on progression recommendation
          const isDumbbellUnder50 = (exercise as any).category?.name === 'DUMBBELL' && previousWeight < 50;
          if (progression.recommendation === 'INCREASE_WEIGHT' && !isDumbbellUnder50) {
            suggestedWeight += 5; // Add 5 lbs
          } else if (progression.recommendation === 'MORE_REPS') {
            targetReps = Math.min(targetReps + 2, 15); // Add 2 reps, max 15
          }
        }

        await prisma.workoutExercise.create({
          data: {
            workoutId: newWorkout.id,
            exerciseId: exercise.id,
            orderIndex: templateExercise.orderIndex,
            targetSets,
            targetReps,
            suggestedWeight,
            previousWeight,
            previousReps,
            restBetweenSets: templateExercise.restBetweenSets,
            restAfterExercise: templateExercise.restAfterExercise,
            tempo: templateExercise.tempo,
          },
        });
      } else {
        // For cardio exercises, use template targets directly
        await prisma.workoutExercise.create({
          data: {
            workoutId: newWorkout.id,
            exerciseId: exercise.id,
            orderIndex: templateExercise.orderIndex,
            targetSets: templateExercise.targetSets || 1,
            targetReps: templateExercise.targetReps || 1,
            restBetweenSets: templateExercise.restBetweenSets,
            restAfterExercise: templateExercise.restAfterExercise,
            tempo: templateExercise.tempo,
          },
        });
      }
    }

    // Return the new workout with exercises
    return this.getWorkoutById(userId, newWorkout.id);
  }

  async createWorkoutFromPreviousWorkout(userId: string, templateWorkoutId: string, name: string) {
    // Get the template workout
    const template = await prisma.workout.findFirst({
      where: {
        id: templateWorkoutId,
        userId,
      },
      include: {
        workoutExercises: {
          include: {
            exercise: { include: { category: true } },
          },
        },
      },
    });

    if (!template) {
      throw new Error('Template workout not found');
    }

    // Create new workout
    const newWorkout = await prisma.workout.create({
      data: {
        userId,
        name,
        status: WorkoutStatus.IN_PROGRESS,
      },
    });

    // Copy exercises with progression-based adjustments
    for (const templateExercise of template.workoutExercises) {
      // Get progression recommendation for this exercise
      const progression = await progressionService.getProgressionForExercise(
        userId,
        templateExercise.exerciseId
      );

      let targetSets = templateExercise.targetSets;
      let targetReps = templateExercise.targetReps;
      let suggestedWeight: number | undefined = undefined;
      let previousWeight: number | undefined = undefined;
      let previousReps: number | undefined = undefined;

      if (progression?.lastWorkout?.avgWeight) {
        previousWeight = progression.lastWorkout.avgWeight;
        previousReps = progression.lastWorkout.avgReps;
        suggestedWeight = previousWeight;

        // Adjust based on progression recommendation
        const isDumbbellUnder50 = (templateExercise.exercise as any).category?.name === 'DUMBBELL' && previousWeight < 50;
        if (progression.recommendation === 'INCREASE_WEIGHT' && !isDumbbellUnder50) {
          suggestedWeight += 5; // Add 5 lbs
        } else if (progression.recommendation === 'MORE_REPS') {
          targetReps = Math.min(targetReps + 2, 15); // Add 2 reps, max 15
        }
      }

      await prisma.workoutExercise.create({
        data: {
          workoutId: newWorkout.id,
          exerciseId: templateExercise.exerciseId,
          orderIndex: templateExercise.orderIndex,
          targetSets,
          targetReps,
          suggestedWeight,
          previousWeight,
          previousReps,
          restBetweenSets: templateExercise.restBetweenSets,
          restAfterExercise: templateExercise.restAfterExercise,
          tempo: templateExercise.tempo,
        },
      });
    }

    // Return the new workout with exercises
    return this.getWorkoutById(userId, newWorkout.id);
  }

  async saveWorkoutAsTemplate(
    userId: string,
    workoutId: string,
    data: SaveWorkoutAsTemplateDto
  ) {
    // Fetch the workout with all exercises
    const workout = await prisma.workout.findFirst({
      where: {
        id: workoutId,
        userId,
      },
      include: {
        workoutExercises: {
          include: {
            exercise: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    // Validate workout exists and belongs to user
    if (!workout) {
      throw new Error('Workout not found');
    }

    // Validate workout is ad-hoc (not created from a template)
    if (workout.templateId !== null) {
      throw new Error('Cannot save template-based workout as a new template');
    }

    // Validate workout has at least one exercise
    if (workout.workoutExercises.length === 0) {
      throw new Error('Cannot save empty workout as template');
    }

    // Create template with all exercises in a transaction
    const template = await prisma.$transaction(async (tx) => {
      // Create the workout template
      const newTemplate = await tx.workoutTemplate.create({
        data: {
          userId,
          name: data.name,
          description: data.description,
          color: data.color,
          isActive: true,
        },
      });

      // Create template exercises from workout exercises
      for (const workoutExercise of workout.workoutExercises) {
        await tx.templateExercise.create({
          data: {
            templateId: newTemplate.id,
            exerciseId: workoutExercise.exerciseId,
            orderIndex: workoutExercise.orderIndex,
            targetSets: workoutExercise.targetSets,
            targetReps: workoutExercise.targetReps,
            restBetweenSets: workoutExercise.restBetweenSets,
            restAfterExercise: workoutExercise.restAfterExercise,
            tempo: workoutExercise.tempo,
          },
        });
      }

      // Fetch the complete template with exercises
      const completeTemplate = await tx.workoutTemplate.findUnique({
        where: { id: newTemplate.id },
        include: {
          templateExercises: {
            include: {
              exercise: true,
            },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      return completeTemplate;
    });

    return template;
  }
}

export const workoutService = new WorkoutService();
