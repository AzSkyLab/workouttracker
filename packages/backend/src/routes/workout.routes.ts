import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { workoutService } from '../services/workout.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

const createWorkoutSchema = z.object({
  name: z.string().min(1),
});

const createFromTemplateSchema = z.object({
  templateId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
});

const createFromPreviousWorkoutSchema = z.object({
  templateWorkoutId: z.string().uuid(),
  name: z.string().min(1),
});

const addExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  targetSets: z.number().min(1),
  targetReps: z.number().min(1),
});

const logSetSchema = z.object({
  setNumber: z.number().min(1),
  // Strength fields
  reps: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  rpe: z.number().min(1).max(10).optional(),
  // Cardio fields
  durationMinutes: z.number().min(0).optional(),
  distanceMiles: z.number().min(0).optional(),
  caloriesBurned: z.number().min(0).optional(),
  // Optional metadata
  completed: z.boolean().optional(),
  notes: z.string().optional(),
});

const updateSetSchema = z.object({
  // Strength fields
  reps: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  // Cardio fields
  durationMinutes: z.number().min(0).optional(),
  distanceMiles: z.number().min(0).optional(),
  caloriesBurned: z.number().min(0).nullable().optional(),
  completed: z.boolean().optional(),
  notes: z.string().optional(),
});

const saveAsTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

export async function workoutRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Get workout stats
  fastify.get('/stats', async (request) => {
    return workoutService.getWorkoutStats(request.user!.userId);
  });

  // Get active/in-progress workout
  fastify.get('/active', async (request) => {
    return workoutService.getActiveWorkout(request.user!.userId);
  });

  // Get recent workouts (for templates)
  fastify.get('/recent', async (request) => {
    const { limit = 5 } = request.query as any;
    return workoutService.getRecentWorkouts(request.user!.userId, Number(limit));
  });

  // Get all workouts for user
  fastify.get('/', async (request) => {
    const { limit = 20, offset = 0 } = request.query as any;
    return workoutService.getWorkouts(
      request.user!.userId,
      Number(limit),
      Number(offset)
    );
  });

  // Get single workout
  fastify.get('/:id', async (request) => {
    const { id } = request.params as any;
    return workoutService.getWorkoutById(request.user!.userId, id);
  });

  // Create workout
  fastify.post('/', async (request, reply) => {
    try {
      const data = createWorkoutSchema.parse(request.body);
      return workoutService.createWorkout(request.user!.userId, data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });

  // Create workout from template (WorkoutTemplate model)
  fastify.post('/from-template', async (request, reply) => {
    try {
      const data = createFromTemplateSchema.parse(request.body);
      return workoutService.createWorkoutFromTemplate(
        request.user!.userId,
        data.templateId,
        data.startDate
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });

  // Create workout from previous workout
  fastify.post('/from-previous', async (request, reply) => {
    try {
      const data = createFromPreviousWorkoutSchema.parse(request.body);
      return workoutService.createWorkoutFromPreviousWorkout(
        request.user!.userId,
        data.templateWorkoutId,
        data.name
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });

  // Add exercise to workout
  fastify.post('/:workoutId/exercises', async (request, reply) => {
    try {
      const { workoutId } = request.params as any;
      const data = addExerciseSchema.parse(request.body);
      return workoutService.addExerciseToWorkout(
        request.user!.userId,
        workoutId,
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

  // Complete workout exercise
  fastify.patch('/:workoutId/exercises/:exerciseId/complete', async (request) => {
    const { workoutId, exerciseId } = request.params as any;
    return workoutService.completeWorkoutExercise(
      request.user!.userId,
      workoutId,
      exerciseId
    );
  });

  // Complete workout
  fastify.patch('/:id/complete', async (request) => {
    const { id } = request.params as any;
    return workoutService.completeWorkout(request.user!.userId, id);
  });

  // Restart workout (reset timer)
  fastify.patch('/:id/restart', async (request) => {
    const { id } = request.params as any;
    return workoutService.restartWorkout(request.user!.userId, id);
  });

  // Save workout as template
  fastify.post('/:id/save-as-template', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = saveAsTemplateSchema.parse(request.body);
      return workoutService.saveWorkoutAsTemplate(request.user!.userId, id, data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });

  // Delete workout
  fastify.delete('/:id', async (request) => {
    const { id } = request.params as any;
    return workoutService.deleteWorkout(request.user!.userId, id);
  });

  // Log a set
  fastify.post('/exercises/:exerciseId/sets', async (request, reply) => {
    try {
      const { exerciseId } = request.params as any;
      const data = logSetSchema.parse(request.body);
      return workoutService.logSet(request.user!.userId, exerciseId, data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });

  // Update set
  fastify.put('/sets/:setId', async (request, reply) => {
    try {
      const { setId } = request.params as any;
      const data = updateSetSchema.parse(request.body);
      return workoutService.updateSet(request.user!.userId, setId, data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        throw error;
      }
    }
  });

  // Complete set
  fastify.patch('/sets/:setId/complete', async (request) => {
    const { setId } = request.params as any;
    return workoutService.completeSet(request.user!.userId, setId);
  });
}
