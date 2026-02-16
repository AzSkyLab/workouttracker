import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth.routes.js';
import { workoutRoutes } from './routes/workout.routes.js';
import { exerciseRoutes } from './routes/exercise.routes.js';
import { progressionRoutes } from './routes/progression.routes.js';
import { templateRoutes } from './routes/template.routes.js';
import { scheduleRoutes } from './routes/schedule.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { metadataRoutes } from './routes/metadata.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { prisma } from './lib/prisma.js';

dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Register plugins
await fastify.register(helmet, {
  contentSecurityPolicy: false,
});

await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});

await fastify.register(cookie);

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  sign: {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  },
});

// Health check endpoints
fastify.get('/health', async () => {
  return { status: 'ok' };
});

fastify.get('/ready', async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', database: 'connected' };
  } catch (error) {
    fastify.log.error(error);
    return { status: 'not ready', database: 'disconnected' };
  }
});

// Register routes
await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
await fastify.register(userRoutes, { prefix: '/api/v1/users' });
await fastify.register(workoutRoutes, { prefix: '/api/v1/workouts' });
await fastify.register(exerciseRoutes, { prefix: '/api/v1/exercises' });
await fastify.register(progressionRoutes, { prefix: '/api/v1/progression' });
await fastify.register(templateRoutes, { prefix: '/api/v1/templates' });
await fastify.register(scheduleRoutes, { prefix: '/api/v1/schedule' });
await fastify.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
await fastify.register(metadataRoutes, { prefix: '/api/v1/admin' });
await fastify.register(aiRoutes, { prefix: '/api/v1/ai' });

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    error: error.message || 'Internal Server Error',
  });
});

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server...`);
    await prisma.$disconnect();
    await fastify.close();
    process.exit(0);
  });
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
