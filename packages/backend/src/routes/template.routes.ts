import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { templateService } from '../services/template.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
});

const addExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  targetSets: z.number().min(1).optional(),
  targetReps: z.number().min(1).optional(),
  restBetweenSets: z.number().min(0).optional(),
  restAfterExercise: z.number().min(0).optional(),
  targetDurationMinutes: z.number().min(0).optional(),
  targetDistanceMiles: z.number().min(0).optional(),
  tempo: z.string().optional(),
  notes: z.string().optional(),
});

const updateExerciseSchema = z.object({
  targetSets: z.number().min(1).optional(),
  targetReps: z.number().min(1).optional(),
  restBetweenSets: z.number().min(0).optional(),
  restAfterExercise: z.number().min(0).optional(),
  targetDurationMinutes: z.number().min(0).optional(),
  targetDistanceMiles: z.number().min(0).optional(),
  tempo: z.string().optional(),
  notes: z.string().optional(),
});

const reorderExercisesSchema = z.object({
  exerciseIds: z.array(z.string().uuid()),
});

export async function templateRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Get all templates
  fastify.get('/', async (request) => {
    const { includeInactive = false } = request.query as any;
    return templateService.getTemplates(
      request.user!.userId,
      Boolean(includeInactive)
    );
  });

  // Get single template
  fastify.get('/:id', async (request) => {
    const { id } = request.params as any;
    return templateService.getTemplateById(request.user!.userId, id);
  });

  // Create template
  fastify.post('/', async (request, reply) => {
    try {
      const data = createTemplateSchema.parse(request.body);
      return templateService.createTemplate(request.user!.userId, data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });

  // Update template
  fastify.put('/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = updateTemplateSchema.parse(request.body);
      return templateService.updateTemplate(request.user!.userId, id, data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });

  // Delete template
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    await templateService.deleteTemplate(request.user!.userId, id);
    reply.status(204).send();
  });

  // Add exercise to template
  fastify.post('/:id/exercises', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = addExerciseSchema.parse(request.body);
      return templateService.addExerciseToTemplate(request.user!.userId, id, data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });

  // Update exercise in template
  fastify.put('/:id/exercises/:exerciseId', async (request, reply) => {
    try {
      const { id, exerciseId } = request.params as any;
      const data = updateExerciseSchema.parse(request.body);
      return templateService.updateTemplateExercise(
        request.user!.userId,
        id,
        exerciseId,
        data
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });

  // Remove exercise from template
  fastify.delete('/:id/exercises/:exerciseId', async (request, reply) => {
    const { id, exerciseId } = request.params as any;
    await templateService.removeExerciseFromTemplate(
      request.user!.userId,
      id,
      exerciseId
    );
    reply.status(204).send();
  });

  // Reorder template exercises
  fastify.put('/:id/exercises/reorder', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = reorderExercisesSchema.parse(request.body);
      return templateService.reorderTemplateExercises(request.user!.userId, id, data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });
}
