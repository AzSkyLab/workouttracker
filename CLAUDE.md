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
2. Rep range is 8–12. Averages are calculated from completed sets only (failed sets don't penalize)
3. Recommendations (using RPE when available, falling back to completion rate):
   - **Increase Weight** (+5 lbs, drop to 8 reps): Avg reps hit 12-rep ceiling, or all sets/reps completed with low RPE
   - **More Reps** (up to 12): Completed all sets but RPE was moderate, or most reps completed
   - **Maintain**: High RPE, or significantly missed target reps
4. Dumbbell override: for dumbbells under 50 lbs, prefers adding reps before weight (unless at 12-rep ceiling)
5. RPE cap: won't suggest weight increase if any set hit RPE 10 (unless at rep ceiling)

Progression stored in `ExerciseProgression` table with unique constraint on (userId, exerciseId).

### AI Workout Plan Generator

Uses LiteLLM as an API gateway to route requests to local Ollama instances running on multiple GPUs. The backend service (`packages/backend/src/services/ai.service.ts`) calls LiteLLM's OpenAI-compatible `/v1/chat/completions` endpoint.

**LiteLLM Gateway:**
- **In-cluster**: `http://litellm.litellm.svc.cluster.local:4000` (used by backend pods)
- **External**: `https://llm.home.lab` (used for local dev)
- **Auth**: Bearer token using `LITELLM_API_KEY` (key has `sk-` prefix)

**Model naming convention** — models are prefixed by GPU backend:
- `vm/*` — RTX 3090 (24GB) at `10.0.20.30` (e.g., `vm/qwen2.5-coder:32b`, `vm/gemma3:27b`)
- `ws/*` — RTX 5090 (32GB) at `10.0.10.40` (e.g., `ws/qwen2.5-coder:32b`, `ws/qwen3:32b`)
- `ollama/*` — Load-balanced across both backends

**Flow**: User selects preferences → backend builds prompt with exercise library → calls LiteLLM → parses JSON response → maps AI exercise names to DB IDs (exact → alias → fuzzy match) → returns preview for user review → saves as workout templates.

**Key files:**
- Backend service: `packages/backend/src/services/ai.service.ts`
- Routes: `packages/backend/src/routes/ai.routes.ts`
- Shared types: `packages/shared/src/types/ai.types.ts`
- Frontend: `packages/frontend/src/pages/AiPlanGenerator.tsx`

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
LITELLM_URL="https://llm.home.lab"
LITELLM_MODEL="vm/qwen2.5-coder:32b"
LITELLM_API_KEY="your-litellm-api-key"
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

### Adding Exercises or Workout Templates

Scripts in `packages/backend/prisma/`, run with `npx tsx prisma/<script>.ts` and
a `DATABASE_URL` from the cluster secret (see Initial Database Setup):

| Script | Purpose |
|--------|---------|
| `seed.ts` | Seeds muscle groups, categories, and the full exercise library from `exercise-data.json`. Upserts by name. |
| `seed-recomp-templates.ts` | 6-day recomp program (Mon–Sat templates) |
| `seed-3day-templates.ts` | 3-day full-body program (Day 1/2/3), scheduled Mon/Wed/Fri |
| `update-recomp-notes.ts` | One-off note edits on existing recomp templates |

**New exercises belong in `exercise-data.json`, not inline in a seed script.**
`seed.ts` upserts the whole file by name, so anything defined only inside a
one-off script is lost the next time the library is reseeded. Template scripts
should read their exercise definitions back out of the JSON.

Conventions these scripts follow, worth preserving since they run against live
production data:

- Idempotent — check for an existing record and skip rather than duplicating,
  so a re-run is safe.
- Resolve every exercise name to an ID *before* creating the template, so a typo
  cannot leave a half-populated template behind.
- Templates attach to `prisma.user.findFirst()`. Fine for a single-user
  deployment; scope by email if that ever changes.
- `WorkoutSchedule` is unique on `(userId, dayOfWeek)` with `0 = Sunday`. Check
  whether a day is already occupied before claiming it.
- The JSON is formatted with 2-space indent but **inline string arrays**
  (`"aliases": ["a", "b"]`). A naive `json.dump(indent=2)` reformats all 137
  entries — append by hand or the diff becomes unreviewable.

## Testing Locally

1. Check health: http://localhost:3000/health
2. Check DB connection: http://localhost:3000/ready
3. Frontend: http://localhost:5173
4. Prisma Studio: `npx prisma studio` from packages/backend

## Docker and Kubernetes

### Build Docker Images

```bash
# From root - must use -f flag because Dockerfiles expect root context
docker build -t ghcr.io/azskylab/workout-backend:latest -f ./packages/backend/Dockerfile .
docker build -t ghcr.io/azskylab/workout-frontend:latest -f ./packages/frontend/Dockerfile .
```

### Infrastructure

- **Git remote**: GitHub at `github.com` (primary)
- **CI/CD**: GitHub Actions (`.github/workflows/docker.yml`) builds, pushes images to GHCR, and updates k8s image tags on push to `master`
- **Container registry**: GitHub Container Registry (`ghcr.io/azskylab/`)
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

ArgoCD automatically syncs the `k8s/` directory from the `master` branch. The ArgoCD Application is defined in the homelab repo at `kubernetes/apps/workout-tracker/workout-tracker.yml`.

**Automated deployment (normal flow):** Push to `master`. GitHub Actions CI builds Docker images, pushes them to GHCR with a commit SHA tag, then commits the updated image tag back to the k8s manifests. ArgoCD detects the manifest change and rolls out automatically. No manual `kubectl` commands needed.

**Manual deployment (if CI is down):**

```bash
# 1. Build and push Docker images to GHCR (from repo root)
SHORT_SHA=$(git rev-parse --short HEAD)
docker build -t ghcr.io/azskylab/workout-backend:${SHORT_SHA} -f ./packages/backend/Dockerfile .
docker build -t ghcr.io/azskylab/workout-frontend:${SHORT_SHA} -f ./packages/frontend/Dockerfile .
docker push ghcr.io/azskylab/workout-backend:${SHORT_SHA}
docker push ghcr.io/azskylab/workout-frontend:${SHORT_SHA}

# 2. Update k8s manifests with new tag and push (ArgoCD will sync)
sed -i "s|ghcr.io/azskylab/workout-backend:[a-zA-Z0-9._-]*|ghcr.io/azskylab/workout-backend:${SHORT_SHA}|" k8s/backend-deployment.yaml
sed -i "s|ghcr.io/azskylab/workout-frontend:[a-zA-Z0-9._-]*|ghcr.io/azskylab/workout-frontend:${SHORT_SHA}|" k8s/frontend-deployment.yaml
git add k8s/ && git commit -m "chore: update k8s image tags to ${SHORT_SHA}" && git push
```

### CI/CD Pipeline (GitHub Actions)

The CI workflow at `.github/workflows/docker.yml` runs on push to `master` when `packages/`, `package-lock.json`, or the workflow itself changes:

1. Detects which packages changed (backend, frontend, or both) via `dorny/paths-filter`
2. Builds and pushes Docker images to GHCR with both `:<commit-sha>` and `:latest` tags
3. Commits updated image tags in `k8s/` manifests back to `master`
4. ArgoCD detects the k8s manifest change and syncs automatically

**Important CI notes:**
- The `update-k8s-tags` job only runs if at least one build succeeded
- Uses short SHA (7 chars) for k8s manifest tags, full SHA for GHCR tags
- The bot commit only touches `k8s/` which is not in the workflow's path trigger, so no infinite loop
- Bot commits via `GITHUB_TOKEN` don't trigger workflows (GitHub default behavior)

### Git Remotes

```
origin   git@github.com:AzSkyLab/workouttracker.git  (GitHub, primary)
```

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
DATABASE_URL=$(kubectl get secret workout-tracker-secrets -n workout-tracker -o jsonpath='{.data.DATABASE_URL}' | base64 -d) npx tsx prisma/seed.ts
```

There is no local development database configured (`packages/backend/.env` is not
checked in). Seed scripts are run from a local machine straight against the
production database, so the connection string comes from the cluster secret as
shown above. `workout-tracker-secrets` also holds `JWT_SECRET`,
`JWT_REFRESH_SECRET`, and `LITELLM_API_KEY`.

### Verify Deployment

```bash
# Check ArgoCD UI at https://argocd.home.lab
kubectl get pods -n workout-tracker
kubectl rollout status deploy/backend -n workout-tracker
# App accessible at https://workout.home.lab
```

The backend health routes are registered at the service root (`/health`,
`/ready`), *not* under `/api/v1`. The ingress routes `/api` to the backend and
`/` to the frontend, so `https://workout.home.lab/health` reaches the frontend
SPA and returns 200 regardless of backend state — it is not a valid health
check. Query the backend directly instead:

```bash
POD_IP=$(kubectl get pod -n workout-tracker -l app=backend -o jsonpath='{.items[0].status.podIP}')
kubectl exec -n workout-tracker deploy/backend -- wget -qO- "http://${POD_IP}:3000/health"  # {"status":"ok"}
kubectl exec -n workout-tracker deploy/backend -- wget -qO- "http://${POD_IP}:3000/ready"   # {"status":"ready","database":"connected"}
```

Use the pod IP rather than `localhost` — `localhost` resolves to IPv6 inside the
container and the connection is refused.

## Important Implementation Details

### Password Security

Passwords hashed with bcrypt using cost factor 12 (`packages/backend/src/services/auth.service.ts`).

### Token Refresh Flow

Refresh token endpoint (`POST /api/v1/auth/refresh`) reads HttpOnly cookie automatically. Frontend doesn't need to send anything except the cookie (sent by browser). Returns new access token.

### CORS Configuration

Backend CORS allows credentials and uses `FRONTEND_URL` environment variable (`https://workout.home.lab` in production). The cookie `secure` flag must match the protocol (true for HTTPS).

### Database Indexes

All foreign keys have indexes. Additional indexes on `User.email`, `Exercise.muscleGroup`, `Exercise.category`, `Workout.status`, and `Workout.startedAt` for common queries.

### Exercise Type Constraints (STRENGTH vs CARDIO)

An exercise's `type` decides how the whole logging UI behaves, so it is a
functional choice rather than a classification detail. `SetLogger` branches on
it (`packages/frontend/src/components/SetLogger.tsx`):

| | STRENGTH | CARDIO |
|---|---|---|
| Sets loggable | `targetSets` | **1 only** (`maxSets = isCardio ? 1 : ...`) |
| Fields recorded | reps, weight, RPE | duration, distance, calories |
| Weight tracked | yes | **no** |

Consequences when adding exercises:

- **Anything needing per-set load or multiple logged sets must be `STRENGTH`**,
  even when the prescription is time-based. Loaded carries (Farmer Carry,
  Suitcase Carry) are `STRENGTH` with `targetReps: 1` and the hold duration in
  `notes` ("30-45 sec per set"), because tracking the weight is the point.
- A template may set `targetSets > 1` on a CARDIO exercise and it will display,
  but only one set can actually be logged against it.
- The library holds both `Kettlebell Swing` (STRENGTH, for sets-and-reps power
  work) and `Kettlebell Swings` (CARDIO, for conditioning). Similar names,
  deliberately different types — pick by how it will be logged.

`TemplateExercise.targetReps` is a single `Int`, so a prescribed rep *range* has
to collapse to one working target. Convention is to store the working number and
keep the full range in `notes` ("PUSH — 6-10 reps").

## Code Conventions

- TypeScript strict mode enabled
- ESM modules (`"type": "module"` in package.json)
- Async/await pattern throughout
- Fastify route handlers use `FastifyRequest` and `FastifyReply` types
- React components use functional components with hooks
- File extensions: `.ts` for backend, `.tsx` for React components
- Import paths use `.js` extension in backend for ESM compatibility
