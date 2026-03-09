import { prisma } from '../lib/prisma.js';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  AddExerciseToTemplateDto,
  UpdateTemplateExerciseDto,
  ReorderTemplateExercisesDto,
} from '@workout-tracker/shared';

export class TemplateService {
  async createTemplate(userId: string, data: CreateTemplateDto) {
    return prisma.workoutTemplate.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        color: data.color,
      },
      include: {
        templateExercises: {
          include: {
            exercise: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async getTemplates(userId: string, includeInactive = false) {
    return prisma.workoutTemplate.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        templateExercises: {
          include: {
            exercise: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplateById(userId: string, templateId: string) {
    const template = await prisma.workoutTemplate.findFirst({
      where: {
        id: templateId,
        userId,
      },
      include: {
        templateExercises: {
          include: {
            exercise: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return template;
  }

  async updateTemplate(
    userId: string,
    templateId: string,
    data: UpdateTemplateDto
  ) {
    // Verify template belongs to user
    const template = await prisma.workoutTemplate.findFirst({
      where: { id: templateId, userId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return prisma.workoutTemplate.update({
      where: { id: templateId },
      data,
      include: {
        templateExercises: {
          include: {
            exercise: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async deleteTemplate(userId: string, templateId: string) {
    // Verify template belongs to user
    const template = await prisma.workoutTemplate.findFirst({
      where: { id: templateId, userId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return prisma.workoutTemplate.delete({
      where: { id: templateId },
    });
  }

  async addExerciseToTemplate(
    userId: string,
    templateId: string,
    data: AddExerciseToTemplateDto
  ) {
    // Verify template belongs to user
    const template = await prisma.workoutTemplate.findFirst({
      where: { id: templateId, userId },
      include: { templateExercises: true },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Get next order index
    const maxOrder = template.templateExercises.reduce(
      (max, ex) => Math.max(max, ex.orderIndex),
      -1
    );

    return prisma.templateExercise.create({
      data: {
        templateId,
        exerciseId: data.exerciseId,
        orderIndex: maxOrder + 1,
        targetSets: data.targetSets,
        targetReps: data.targetReps,
        restBetweenSets: data.restBetweenSets,
        restAfterExercise: data.restAfterExercise,
        targetDurationMinutes: data.targetDurationMinutes,
        targetDistanceMiles: data.targetDistanceMiles,
        notes: data.notes,
      },
      include: {
        exercise: true,
      },
    });
  }

  async updateTemplateExercise(
    userId: string,
    templateId: string,
    templateExerciseId: string,
    data: UpdateTemplateExerciseDto
  ) {
    // Verify template belongs to user
    const template = await prisma.workoutTemplate.findFirst({
      where: { id: templateId, userId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Verify template exercise belongs to this template
    const templateExercise = await prisma.templateExercise.findFirst({
      where: {
        id: templateExerciseId,
        templateId,
      },
    });

    if (!templateExercise) {
      throw new Error('Template exercise not found');
    }

    return prisma.templateExercise.update({
      where: { id: templateExerciseId },
      data: {
        targetSets: data.targetSets,
        targetReps: data.targetReps,
        restBetweenSets: data.restBetweenSets,
        restAfterExercise: data.restAfterExercise,
        targetDurationMinutes: data.targetDurationMinutes,
        targetDistanceMiles: data.targetDistanceMiles,
        notes: data.notes,
      },
      include: {
        exercise: true,
      },
    });
  }

  async removeExerciseFromTemplate(
    userId: string,
    templateId: string,
    templateExerciseId: string
  ) {
    // Verify template belongs to user
    const template = await prisma.workoutTemplate.findFirst({
      where: { id: templateId, userId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Verify template exercise belongs to this template
    const templateExercise = await prisma.templateExercise.findFirst({
      where: {
        id: templateExerciseId,
        templateId,
      },
    });

    if (!templateExercise) {
      throw new Error('Template exercise not found');
    }

    return prisma.templateExercise.delete({
      where: { id: templateExerciseId },
    });
  }

  async reorderTemplateExercises(
    userId: string,
    templateId: string,
    data: ReorderTemplateExercisesDto
  ) {
    // Verify template belongs to user
    const template = await prisma.workoutTemplate.findFirst({
      where: { id: templateId, userId },
      include: { templateExercises: true },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Update order index for each exercise
    await Promise.all(
      data.exerciseIds.map((exerciseId, index) =>
        prisma.templateExercise.updateMany({
          where: {
            id: exerciseId,
            templateId,
          },
          data: {
            orderIndex: index,
          },
        })
      )
    );

    // Return updated template
    return this.getTemplateById(userId, templateId);
  }
}

export const templateService = new TemplateService();
