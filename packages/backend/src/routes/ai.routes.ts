import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { aiService } from '../services/ai.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { FitnessGoal, ExperienceLevel } from '@workout-tracker/shared';

const generatePlanSchema = z.object({
  goal: z.nativeEnum(FitnessGoal),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  daysPerWeek: z.number().int().min(1).max(7),
  sessionDurationMinutes: z.number().int().min(15).max(120),
  availableEquipment: z.array(z.string()),
  focusAreas: z.array(z.string()),
  includeCardio: z.boolean(),
  model: z.string().optional(),
});

const savePlanExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1),
  reps: z.number().int().min(1).optional(),
  durationMinutes: z.number().min(1).optional(),
  restSeconds: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

const savePlanDaySchema = z.object({
  dayName: z.string().min(1),
  description: z.string(),
  color: z.string(),
  exercises: z.array(savePlanExerciseSchema).min(1),
});

const savePlanSchema = z.object({
  planName: z.string().min(1),
  days: z.array(savePlanDaySchema).min(1),
});

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // List available LiteLLM models
  fastify.get('/models', async (request, reply) => {
    try {
      const models = await aiService.getAvailableModels();
      return models;
    } catch (error: any) {
      if (error.statusCode === 503) {
        return reply.status(503).send({ error: error.message });
      }
      throw error;
    }
  });

  // Generate a plan preview (no DB writes)
  fastify.post('/generate-plan', async (request, reply) => {
    try {
      const data = generatePlanSchema.parse(request.body);
      const result = await aiService.previewWorkoutPlan(request.user!.userId, data);
      return result;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      if (error.statusCode === 503) {
        return reply.status(503).send({ error: error.message });
      }
      if (error.statusCode === 504) {
        return reply.status(504).send({ error: error.message });
      }
      if (error.statusCode === 502) {
        return reply.status(502).send({ error: error.message });
      }
      throw error;
    }
  });

  // Save a reviewed plan to the database
  fastify.post('/save-plan', async (request, reply) => {
    try {
      const data = savePlanSchema.parse(request.body);
      const result = await aiService.saveWorkoutPlan(request.user!.userId, data);
      return result;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  });
}
