-- NexaGPT V2 persistent project memory
-- Run this once in the PostgreSQL/Neon SQL editor.

CREATE TABLE IF NOT EXISTS nexagpt_projects (
  id BIGSERIAL PRIMARY KEY,
  owner_key TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  summary TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_key, project_id)
);

CREATE TABLE IF NOT EXISTS nexagpt_project_memories (
  memory_id BIGSERIAL PRIMARY KEY,
  owner_key TEXT NOT NULL,
  project_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'assistant',
  importance SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_key, project_id, memory_type, content),
  FOREIGN KEY (owner_key, project_id)
    REFERENCES nexagpt_projects (owner_key, project_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nexagpt_projects_owner_updated
  ON nexagpt_projects (owner_key, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_nexagpt_memories_project_rank
  ON nexagpt_project_memories (owner_key, project_id, importance DESC, updated_at DESC);
