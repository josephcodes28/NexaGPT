/**
 * NexaGPT V2 — persistent project memory store
 *
 * Requires:
 *   npm install @neondatabase/serverless
 *   DATABASE_URL=<your Neon PostgreSQL connection string>
 *
 * This module is a storage layer, not a public HTTP endpoint.
 * Call it from authenticated server-side API routes only.
 */

import { neon } from "@neondatabase/serverless";

let sqlClient;

function getSql() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("Project memory is not configured: DATABASE_URL is missing.");
    error.code = "MEMORY_NOT_CONFIGURED";
    throw error;
  }

  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

function requiredString(value, name, max = 500) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  const result = value.trim();
  if (result.length > max) throw new RangeError(`${name} must be ${max} characters or fewer.`);
  return result;
}

function optionalString(value, max = 12000) {
  if (value == null) return "";
  if (typeof value !== "string") throw new TypeError("Memory content must be text.");
  if (value.length > max) throw new RangeError(`Memory content must be ${max} characters or fewer.`);
  return value.trim();
}

function safeJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("metadata must be a JSON object.");
  }
  return value;
}

/**
 * Create or update a project record.
 * ownerKey must come from the authenticated server-side user/session.
 */
export async function saveProject({
  ownerKey,
  projectId,
  name,
  description = "",
  status = "active",
  summary = "",
  metadata = {}
}) {
  const sql = getSql();
  const owner = requiredString(ownerKey, "ownerKey", 200);
  const id = requiredString(projectId, "projectId", 120);
  const projectName = requiredString(name, "name", 200);
  const projectDescription = optionalString(description, 4000);
  const projectSummary = optionalString(summary, 12000);
  const projectStatus = requiredString(status, "status", 40);
  const projectMetadata = safeJson(metadata);

  const rows = await sql`
    INSERT INTO nexagpt_projects
      (owner_key, project_id, name, description, status, summary, metadata, created_at, updated_at)
    VALUES
      (${owner}, ${id}, ${projectName}, ${projectDescription}, ${projectStatus},
       ${projectSummary}, ${JSON.stringify(projectMetadata)}::jsonb, NOW(), NOW())
    ON CONFLICT (owner_key, project_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      summary = EXCLUDED.summary,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING project_id, name, description, status, summary, metadata, created_at, updated_at
  `;
  return rows[0] ?? null;
}

/**
 * Add one durable memory item to a project.
 * Use concise, useful facts—not entire conversations or secrets.
 */
export async function addProjectMemory({
  ownerKey,
  projectId,
  memoryType,
  content,
  source = "assistant",
  importance = 3,
  metadata = {}
}) {
  const sql = getSql();
  const owner = requiredString(ownerKey, "ownerKey", 200);
  const id = requiredString(projectId, "projectId", 120);
  const type = requiredString(memoryType, "memoryType", 60);
  const text = requiredString(content, "content", 12000);
  const sourceName = requiredString(source, "source", 40);
  const score = Math.max(1, Math.min(5, Number(importance) || 3));
  const memoryMetadata = safeJson(metadata);

  const rows = await sql`
    INSERT INTO nexagpt_project_memories
      (owner_key, project_id, memory_type, content, source, importance, metadata, created_at, updated_at)
    VALUES
      (${owner}, ${id}, ${type}, ${text}, ${sourceName}, ${score},
       ${JSON.stringify(memoryMetadata)}::jsonb, NOW(), NOW())
    ON CONFLICT (owner_key, project_id, memory_type, content)
    DO UPDATE SET
      importance = GREATEST(nexagpt_project_memories.importance, EXCLUDED.importance),
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING memory_id, project_id, memory_type, content, source, importance, metadata, created_at, updated_at
  `;
  return rows[0] ?? null;
}

/**
 * Load a project and its most useful recent memories for the AI prompt.
 */
export async function loadProjectContext({ ownerKey, projectId, limit = 40 }) {
  const sql = getSql();
  const owner = requiredString(ownerKey, "ownerKey", 200);
  const id = requiredString(projectId, "projectId", 120);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 40));

  const projects = await sql`
    SELECT project_id, name, description, status, summary, metadata, created_at, updated_at
    FROM nexagpt_projects
    WHERE owner_key = ${owner} AND project_id = ${id}
    LIMIT 1
  `;

  if (!projects.length) return { project: null, memories: [] };

  const memories = await sql`
    SELECT memory_id, memory_type, content, source, importance, metadata, created_at, updated_at
    FROM nexagpt_project_memories
    WHERE owner_key = ${owner} AND project_id = ${id}
    ORDER BY importance DESC, updated_at DESC
    LIMIT ${safeLimit}
  `;

  return { project: projects[0], memories };
}

/** List the user's projects, newest activity first. */
export async function listProjects({ ownerKey, limit = 50 }) {
  const sql = getSql();
  const owner = requiredString(ownerKey, "ownerKey", 200);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));

  return sql`
    SELECT project_id, name, description, status, summary, metadata, created_at, updated_at
    FROM nexagpt_projects
    WHERE owner_key = ${owner}
    ORDER BY updated_at DESC
    LIMIT ${safeLimit}
  `;
}

/** Delete a project and its memories. Restrict this to an authenticated owner action. */
export async function deleteProject({ ownerKey, projectId }) {
  const sql = getSql();
  const owner = requiredString(ownerKey, "ownerKey", 200);
  const id = requiredString(projectId, "projectId", 120);

  const rows = await sql`
    DELETE FROM nexagpt_projects
    WHERE owner_key = ${owner} AND project_id = ${id}
    RETURNING project_id
  `;
  return { deleted: rows.length > 0, projectId: id };
}
