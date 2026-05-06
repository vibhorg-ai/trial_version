# NextFlow

NextFlow is a **visual workflow builder** for AI and media pipelines: compose nodes on a canvas, run them with [Trigger.dev](https://trigger.dev), and track execution history. The dashboard lets you create, rename, and delete workflows; the canvas (built with React Flow) is where you design and execute graphs.

![NextFlow Canvas](docs/screenshots/canvas.png)

> **Note:** The screenshot above is a placeholder path. Add `docs/screenshots/canvas.png` when the demo walkthrough is recorded (see [Demo video](#demo-video)).

---

## Tech stack

| Layer                  | Choices                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| Framework              | **Next.js 15** (App Router), **TypeScript** (strict)                         |
| Data                   | **PostgreSQL** (Neon), **Prisma**                                            |
| Auth                   | **Clerk**                                                                    |
| Canvas                 | **React Flow**                                                               |
| Background jobs        | **Trigger.dev v4**                                                           |
| Uploads / encoding     | **Transloadit**, **Uppy**                                                    |
| Styling                | **Tailwind CSS 4**                                                           |
| Client state           | **Zustand**                                                                  |
| Validation             | **Zod**                                                                      |
| Unit / component tests | **Vitest**, **Testing Library**                                              |
| E2E (planned)          | **Playwright**                                                               |
| Observability          | **Sentry** (`@sentry/nextjs`; optional when `NEXT_PUBLIC_SENTRY_DSN` is set) |

---

## Prerequisites

- **Node.js 22+**
- **PostgreSQL** (e.g. [Neon](https://neon.tech) free tier)
- Accounts / keys for: **Clerk**, **Google AI Studio**, **Transloadit**, **Trigger.dev**

---

## Local setup

1. **Clone and install**

   ```bash
   git clone <your-repo-url> nextflow
   cd nextflow
   npm install
   ```

   Peer dependency resolution uses `legacy-peer-deps=true` (see `.npmrc`).

2. **Environment**

   ```bash
   copy .env.local.example .env.local   # Windows
   # cp .env.local.example .env.local   # macOS / Linux
   ```

   Fill in all variables (see [Environment variables](#environment-variables)).

3. **Database**

   ```bash
   npx prisma migrate deploy
   ```

   For a brand-new database you can use `npx prisma migrate dev` instead.

4. **Check connectivity**

   ```bash
   npm run db:check
   ```

5. **Trigger.dev (dev tunnel)**

   In one terminal (registers tasks with Trigger.dev):

   ```bash
   npm run trigger:dev
   ```

6. **Next.js dev server**

   In another terminal:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable                                                    | Purpose                                              |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`                                              | Prisma connection string (pooler)                    |
| `DIRECT_URL`                                                | Direct Postgres URL (migrations)                     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                         | Clerk browser key                                    |
| `CLERK_SECRET_KEY`                                          | Clerk server secret                                  |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                             | Sign-in route (default `/sign-in`)                   |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                             | Sign-up route (default `/sign-up`)                   |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`           | Post sign-in redirect                                |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`           | Post sign-up redirect                                |
| `GOOGLE_AI_API_KEY`                                         | Google Generative AI                                 |
| `TRANSLOADIT_AUTH_KEY` / `TRANSLOADIT_AUTH_SECRET`          | Transloadit credentials                              |
| `TRANSLOADIT_TEMPLATE_UPLOAD` / `TRANSLOADIT_TEMPLATE_CROP` | Assembly template IDs                                |
| `TRIGGER_SECRET_KEY`                                        | Trigger.dev secret                                   |
| `TRIGGER_PROJECT_REF`                                       | Trigger.dev project ref                              |
| `NEXT_PUBLIC_SENTRY_DSN`                                    | Optional; when empty, Sentry is effectively disabled |

---

## Testing

| Command                    | Description                                |
| -------------------------- | ------------------------------------------ |
| `npm run test`             | Unit / component tests (Vitest)            |
| `npm run test:integration` | Integration tests (separate Vitest config) |
| `npm run test:all`         | Runs both suites sequentially              |
| `npm run test:watch`       | Vitest watch mode                          |
| `npm run test:ui`          | Vitest UI                                  |

---

## Project structure (`src/`)

```
src/
├── app/                 # App Router routes, API routes, loading/error UI
├── components/          # Shared UI (canvas, history, skeletons, etc.)
├── lib/                 # Prisma client, schemas, store, utilities
├── trigger/             # Trigger.dev tasks and orchestration
└── generated/prisma/    # Generated Prisma client (after install / generate)
```

---

## Scripts

| Script                           | Description                    |
| -------------------------------- | ------------------------------ |
| `npm run dev`                    | Next.js dev server (Turbopack) |
| `npm run build`                  | Production build               |
| `npm run start`                  | Start production server        |
| `npm run lint`                   | ESLint                         |
| `npm run test`                   | Unit tests                     |
| `npm run test:integration`       | Integration tests              |
| `npm run test:integration:watch` | Integration tests (watch)      |
| `npm run test:all`               | All tests                      |
| `npm run test:watch`             | Unit tests (watch)             |
| `npm run test:ui`                | Vitest UI                      |
| `npm run db:generate`            | `prisma generate`              |
| `npm run db:check`               | DB connectivity script         |
| `npm run trigger:dev`            | Trigger.dev dev CLI            |
| `npm run trigger:deploy`         | Deploy Trigger.dev tasks       |

---

## Deployment notes

### Vercel (app)

1. Connect the GitHub repo and set **all** production environment variables from `.env.local.example` (and optional `NEXT_PUBLIC_SENTRY_DSN`).
2. Use Node 22 in project settings.
3. Run **`npm run build`** locally or rely on CI; Vercel runs `next build` with your env.

### Trigger.dev (workers)

1. Configure production secrets in the Trigger.dev project (match `TRIGGER_SECRET_KEY` / `TRIGGER_PROJECT_REF`).
2. From the repo root: `npm run trigger:deploy` after merging task changes.

---

## Demo video

A short walkthrough will be linked here once Task 10.10 is recorded (canvas, run, history).

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, conditional integration tests (when `DATABASE_URL` is configured as a secret), and a production build on pushes and PRs to `main`.

---

## License

MIT
