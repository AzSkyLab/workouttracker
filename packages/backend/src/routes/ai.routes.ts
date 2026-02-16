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
});

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/generate-plan', async (request, reply) => {
    try {
      const data = generatePlanSchema.parse(request.body);
      const result = await aiService.generateWorkoutPlan(request.user!.userId, data);
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
}
