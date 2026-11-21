# NexaGPT V2 — Stage 1: Persistent Project Memory

## What this stage provides

- PostgreSQL schema for projects and their durable memory items.
- Server-side storage functions to create/update projects, save memory, load project context, list projects, and delete a project.
- Ownership scoping on every operation.
- Memory ranking by importance and recency.
- A clear boundary between durable project facts and full conversation transcripts.

## Files

- `api/memory-store.js` — server-side storage functions.
- `database/nexagpt-project-memory.sql` — database tables and indexes.

## Setup

1. Create a PostgreSQL database. Neon has a free tier, but check its current limits and terms.
2. Open the database SQL editor and run `database/nexagpt-project-memory.sql`.
3. In the NexaGPT project, install the driver:

   ```bash
   npm install @neondatabase/serverless
   ```

4. Add the database connection string as the Vercel environment variable `DATABASE_URL`.
5. Redeploy after setting the environment variable.

## Important security requirement

`ownerKey` must be derived on the server from a verified login/session. Do not trust an arbitrary owner ID sent by a browser. The existing project context supplied for this stage does not establish a verified user-authentication system, so this storage layer is deliberately not exposed as a public endpoint yet.

Until authentication is connected, do not publish a public API route that accepts an unrestricted `ownerKey`. That could let one visitor read or alter another visitor's project memory.

## How NexaGPT should use memory

For each project, keep concise, structured memories such as:

- `goal` — what the project is meant to achieve.
- `requirements` — confirmed user requirements.
- `architecture` — selected technologies and system design.
- `files` — file names, roles, and confirmed latest versions.
- `decisions` — choices already agreed with the user.
- `progress` — completed work and verified test outcomes.
- `issues` — known bugs and unresolved problems.
- `next_steps` — the next agreed task.

Before answering a request to continue a project, load its project record and memories, then include relevant facts in the AI context. After a meaningful decision, completed step, or verified test, save a concise memory update.

Do not save passwords, API keys, payment credentials, or other secrets. Do not mark a feature as working unless a real test passed. Keep user-confirmed facts distinct from AI assumptions.

## What is not claimed as complete yet

This is the memory storage foundation only. It is not yet wired into the central `/api/brain` request flow, frontend project selector, conversation history, or automatic memory extraction. Those integrations must be added and tested against the actual current files in the next stage.
