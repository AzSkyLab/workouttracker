# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack workout tracking application using React, Node.js/Fastify, PostgreSQL, and Kubernetes. Monorepo architecture with npm workspaces containing three packages: frontend, backend, and shared types.

## Architecture

### Monorepo Structure

- **packages/shared**: Shared TypeScript types used by both frontend and backend
- **packages/backend**: Node.js API using Fastify + Prisma ORM
- **packages/frontend**: React SPA using Vite + TypeScript

All packages reference `@workout-tracker/shared` for type safety across the stack.

### Backend Architecture (Fastify)

The backend uses a layered architecture:

1. **Routes** (`src/routes/*.routes.ts`): Define endpoints and call services
2. **Services** (`src/services/*.service.ts`): Contain business logic
3. **Middleware** (`src/middleware/*.middleware.ts`): Auth and request processing
4. **Prisma Client** (`src/lib/prisma.ts`): Single database client instance

Key patterns:
- All routes are versioned under `/api/v1/`
- Authentication uses JWT with refresh tokens (15min access, 7day refresh)
- Refresh tokens stored in HttpOnly cookies for XSS protection
- Auth middleware decorator: `onRequest: [fastify.authenticate]`

### Frontend Architecture (React)

React Context pattern for global state:

1. **AuthContext**: Manages authentication state, user data, and token refresh
2. **WorkoutContext**: Manages active workout state during exercise logging

The frontend uses:
- React Router for navigation
- Axios with request/response interceptors for API calls and automatic token refresh
- Protected routes wrapper for authenticated pages
- LocalStorage for stopwatch state persistence
- Recharts for dashboard analytics and charts
- react-big-calendar for workout scheduling calendar view

### Database Schema (Prisma)

Core entities and relationships:
- **User** → **Workout** (1:many) - Each user has many workouts
- **User** → **Exercise** (1:many, optional) - Users can create custom exercises (userId=null for shared library)
- **Workout** → **WorkoutExercise** (1:many) - Each workout contains multiple exercises
- **Exercise** → **WorkoutExercise** (1:many) - Exercise library referenced by workouts
- **WorkoutExercise** → **Set** (1:many) - Each exercise instance has multiple sets logged
- **User + Exercise** → **ExerciseProgression** (unique pair) - Progression tracking per user/exercise
- **MuscleGroup** / **ExerciseCategory** - Lookup tables for exercise classification
- **WorkoutTemplate** → **TemplateExercise** (1:many) - Saved workout templates
- **WorkoutSchedule** - Maps templates to days of the week (unique userId+dayOfWeek)

Exercise types: `STRENGTH` (reps/weight/rpe) and `CARDIO` (duration/distance/calories with MET values).

Important: The `Exercise` table contains both shared library exercises (userId=null, seeded with 40+ exercises) and user-created custom exercises. `WorkoutExercise` is the instance of an exercise within a specific workout.

## Development Commands

### Local Development Setup

```bash
# 1. Install all dependencies (from root)
npm install

# 2. Start PostgreSQL
docker-compose up -d

# 3. Setup backend database (from root or packages/backend)
cd packages/backend
cp .env.example .env
npx prisma migrate dev
npm run prisma:seed

# 4. Start backend (from root)
npm run dev:backend

# 5. Start frontend (from root, new terminal)
npm run dev:frontend
```

### Backend Commands

```bash
# From root
npm run dev:backend          # Start dev server with hot reload
npm run build:backend        # Compile TypeScript to dist/

# From packages/backend
npm run dev                  # Start dev server
npm run build                # Build for production
npx prisma studio            # Open Prisma GUI at http://localhost:5555
npx prisma migrate dev       # Create and apply migrations
npm run prisma:seed          # Seed exercise library
npx prisma generate          # Regenerate Prisma Client after schema changes
npm run generate-history     # Generate sample workout history data
```

### Frontend Commands

```bash
# From root
npm run dev:frontend         # Start Vite dev server
npm run build:frontend       # Build for production

# From packages/frontend
npm run dev                  # Start dev server at http://localhost:5173
npm run build                # TypeScript check + Vite build
npm run preview              # Preview production build
```

### Database Migrations

When modifying `packages/backend/prisma/schema.prisma`:

```bash
cd packages/backend
npx prisma migrate dev --name descriptive_migration_name
npx prisma generate  # Regenerate client types
```

## Key Features and Implementations

### Authentication Flow

1. Register/Login returns access token (JWT) and sets refresh token as HttpOnly cookie
2. Frontend stores access token in AuthContext state (memory only, not localStorage)
3. Axios request interceptor adds `Authorization: Bearer <token>` header
4. On 401 response, interceptor calls `/api/v1/auth/refresh` with cookie
5. New access token stored and original request retried
6. Logout clears cookie and frontend state

Auth middleware in backend: `packages/backend/src/middleware/auth.middleware.ts` validates JWT and adds `request.user` object.

### Workout Tracking Flow

1. User creates workout on Dashboard (POST `/api/v1/workouts`)
2. Navigate to ActiveWorkout page
3. Add exercises from library via ExerciseSelector
4. Log sets using SetLogger component (reps, weight, optional RPE)
5. Stopwatch auto-starts for 30s after each set logged
6. Mark exercises complete when target sets reached
7. Complete entire workout (PATCH `/api/v1/workouts/:id/complete`)

WorkoutContext manages current workout state and provides methods to add exercises, log sets, etc.

### Progression Algorithm

Located in `packages/backend/src/services/progression.service.ts`:

1. Analyzes last 3 completed workouts for specific exercise
2. Calculates completion rate (sets completed / sets attempted)
3. Recommendations:
   - **Increase Weight** (+5 lbs): 100% completion rate with target reps met
   - **More Reps**: 80%+ completion rate
   - **Maintain**: <80% completion rate

Progression stored in `ExerciseProgression` table with unique constraint on (userId, exerciseId).

### Stopwatch Component

Custom hook `useStopwatch` in `packages/frontend/src/hooks/useStopwatch.ts`:
- Preset timers: 30s, 2min, 3min
- Manual controls: start, pause, reset
- Auto-start on set completion (30s default)
- Visual progress bar
- Audio alert via Web Audio API
- Persists to localStorage

## Environment Variables

Backend requires `.env` file in `packages/backend/`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/workouttracker"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret-key"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"  # Used for CORS
```

Copy from `.env.example` in that directory.

## Common Development Tasks

### Adding a New API Endpoint

1. Define types in `packages/shared/src/types/*.types.ts`
2. Create/update service in `packages/backend/src/services/*.service.ts`
3. Add route in `packages/backend/src/routes/*.routes.ts`
4. Register route in `packages/backend/src/server.ts` if new router
5. Use in frontend via `packages/frontend/src/services/api.ts`

### Adding a New Database Model

1. Update `packages/backend/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name model_name`
3. Run `npx prisma generate`
4. Add corresponding types in `packages/shared/src/types/`
5. Backend and frontend will auto-import updated Prisma types

### Modifying Shared Types

1. Edit types in `packages/shared/src/types/`
2. Run `npm run build` from `packages/shared/` (or let backend/frontend auto-rebuild)
3. Both frontend and backend reference these types automatically

## Testing Locally

1. Check health: http://localhost:3000/health
2. Check DB connection: http://localhost:3000/ready
3. Frontend: http://localhost:5173
4. Prisma Studio: `npx prisma studio` from packages/backend

## Docker and Kubernetes

### Build Docker Images

```bash
# From root - must use -f flag because Dockerfiles expect root context
docker build -t registry.home.lab/csgit34/workout-backend:latest -f ./packages/backend/Dockerfile .
docker build -t registry.home.lab/csgit34/workout-frontend:latest -f ./packages/frontend/Dockerfile .
```

Note: The npm `docker:build` scripts have incorrect build context. Use the commands above instead.

### Infrastructure

- **Git remote**: Forgejo at `git.home.lab` (primary), GitHub mirror (backup)
- **CI/CD**: Forgejo Actions (`.forgejo/workflows/ci.yml`) builds and pushes images to Harbor on push to `master`
- **Container registry**: Harbor at `registry.home.lab`, project `csgit34`
- **Cluster**: k3s cluster managed via ArgoCD GitOps (homelab repo)
- **Database**: External PostgreSQL at `10.0.30.10` (not in-cluster)
- **Ingress**: Traefik with TLS via cert-manager (`home-lab-ca` ClusterIssuer)
- **DNS**: CoreDNS resolves `workout.home.lab` → `10.0.20.80` (Traefik LB)
- **Replicas**: 2 backend, 2 frontend (no HPA for personal use)

### K8s Manifests (`k8s/`)

| File | Purpose |
|------|---------|
| `configmap.yaml` | Non-sensitive config (JWT expiry, NODE_ENV, FRONTEND_URL) |
| `secrets.yaml` | DATABASE_URL, JWT secrets (update placeholder values before first deploy) |
| `backend-deployment.yaml` | Backend Deployment (2 replicas) + ClusterIP Service on port 3000 |
| `frontend-deployment.yaml` | Frontend Deployment (2 replicas) + ClusterIP Service on port 80 |
| `ingress.yaml` | Traefik ingress for `workout.home.lab` with TLS, routes `/api` → backend, `/` → frontend |

### Deploy with ArgoCD

ArgoCD automatically syncs the `k8s/` directory from the `master` branch via Forgejo (`https://git.home.lab/csGIT34/workouttracker.git`). The ArgoCD Application is defined in the homelab repo at `kubernetes/apps/workout-tracker/workout-tracker.yml`.

**Automated deployment (normal flow):** Push to `master` on Forgejo. Forgejo Actions CI automatically builds Docker images, pushes them to Harbor (`registry.home.lab/csgit34/workout-backend` and `workout-frontend`), and ArgoCD syncs k8s manifest changes. After images are pushed, restart deployments to pull the new images:

```bash
kubectl rollout restart deployment/frontend deployment/backend -n workout-tracker
```

**Manual deployment (if CI is down):**

```bash
# 1. Build and push Docker images to Harbor (from repo root)
docker build -t registry.home.lab/csgit34/workout-backend:latest -f ./packages/backend/Dockerfile .
docker build -t registry.home.lab/csgit34/workout-frontend:latest -f ./packages/frontend/Dockerfile .
docker push registry.home.lab/csgit34/workout-backend:latest
docker push registry.home.lab/csgit34/workout-frontend:latest

# 2. Restart deployments to pull new images
kubectl rollout restart deployment/frontend deployment/backend -n workout-tracker
```

### CI/CD Pipeline (Forgejo Actions)

The CI workflow at `.forgejo/workflows/ci.yml` runs on push to `master` (skips `k8s/**` and `*.md` changes):

1. Checks out code from Forgejo
2. Installs Docker CLI in the job container
3. Logs into Harbor using repo secrets (`HARBOR_USERNAME`, `HARBOR_PASSWORD`)
4. Builds and pushes `workout-backend` and `workout-frontend` images to `registry.home.lab/csgit34/`

**Important CI notes:**
- Harbor credentials use `env:` vars in the workflow (not inline `${{ secrets.* }}`) because the Harbor robot username contains a `$` character that bash would interpret
- Job containers use the DinD Docker socket for Docker operations
- DNS resolves via external CoreDNS at `10.0.20.53`
- Forgejo push-mirrors all commits to GitHub automatically (backup)

### Git Remotes

```
origin   git@git.home.lab:csGIT34/workouttracker.git  (Forgejo, primary)
github   git@github.com:csGIT34/workouttracker.git     (GitHub, backup mirror)
```

Always push to `origin` (Forgejo). GitHub is updated automatically via push-mirroring.

### Initial Database Setup

PostgreSQL runs externally at `10.0.30.10`. Before first deployment, create the database:

```sql
-- On 10.0.30.10
CREATE DATABASE workouttracker;
CREATE USER workouttracker WITH ENCRYPTED PASSWORD '<password>';
GRANT ALL PRIVILEGES ON DATABASE workouttracker TO workouttracker;
\c workouttracker
GRANT ALL ON SCHEMA public TO workouttracker;
```

After backend pods are running, push the schema and seed:

```bash
# Push schema (this project uses prisma db push, not migrations)
kubectl exec deploy/backend -n workout-tracker -- npx prisma db push

# Seed from local machine (tsx is not in the production image)
cd packages/backend
DATABASE_URL="postgresql://workouttracker:<password>@10.0.30.10:5432/workouttracker" npx tsx prisma/seed.ts
```

### Verify Deployment

```bash
# Check ArgoCD UI at https://argocd.home.lab
kubectl get pods -n workout-tracker
# App accessible at https://workout.home.lab
# Health check: https://workout.home.lab/api/v1/health
```

## Important Implementation Details

### Password Security

Passwords hashed with bcrypt using cost factor 12 (`packages/backend/src/services/auth.service.ts`).

### Token Refresh Flow

Refresh token endpoint (`POST /api/v1/auth/refresh`) reads HttpOnly cookie automatically. Frontend doesn't need to send anything except the cookie (sent by browser). Returns new access token.

### CORS Configuration

Backend CORS allows credentials and uses `FRONTEND_URL` environment variable (`https://workout.home.lab` in production). The cookie `secure` flag must match the protocol (true for HTTPS).

### Database Indexes

All foreign keys have indexes. Additional indexes on `User.email`, `Exercise.muscleGroup`, `Exercise.category`, `Workout.status`, and `Workout.startedAt` for common queries.

## Code Conventions

- TypeScript strict mode enabled
- ESM modules (`"type": "module"` in package.json)
- Async/await pattern throughout
- Fastify route handlers use `FastifyRequest` and `FastifyReply` types
- React components use functional components with hooks
- File extensions: `.ts` for backend, `.tsx` for React components
- Import paths use `.js` extension in backend for ESM compatibility
