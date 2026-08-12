/**
 * Question clusters — SQL layer.
 *
 * A cluster is a named, ORDERED, reusable group of Question-Bag questions. It
 * REFERENCES bag questions, never copies them, so editing a question updates it
 * everywhere it is used — the same rule test reuse already follows — and
 * deleting a cluster never deletes a question.
 *
 * Every function here is workspace-scoped in SQL. A cluster id belonging to
 * another workspace resolves to NOTHING rather than raising, so a probe cannot
 * confirm that an id exists — the same rule `test-sources-service` follows.
 *
 * Plan: V1/QUESTION_CLUSTERS_AND_BLUEPRINT_DRAFTS_PLAN.md §3, D4, D5, D8.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureContentSchema } from "./content-schema";
import { createQuestionClusterId } from "./ids";

/** Bag statuses a question must have to be usable in a test — mirrors test-sources-service. */
const USABLE_STATUSES = ["ready", "published_private"];

export type QuestionCluster = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  sourceImportJobId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Members that are currently usable in a test. */
  questionCount: number;
};

export type ClusterMember = {
  questionId: string;
  position: number;
  addedAt: string;
};

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToCluster(row: Record<string, unknown>): QuestionCluster {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    sourceImportJobId: (row.source_import_job_id as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    questionCount: Number(row.question_count ?? 0),
  };
}

/**
 * Clusters in a workspace, newest first, each with the number of members that
 * are actually usable in a test. Counting usable members (rather than all rows)
 * keeps the list honest: a cluster whose questions are all still in review reads
 * as empty, which is what the stack picker will do with it.
 */
export async function listClusters(workspaceId: string): Promise<QuestionCluster[]> {
  await ensureContentSchema();
  const res = await pool().query(
    `SELECT c.*,
            (
              SELECT COUNT(*)::int
                FROM content.question_cluster_members m
                JOIN content.questions q ON q.id = m.question_id
               WHERE m.cluster_id = c.id AND q.status::text = ANY($2::text[])
            ) AS question_count
       FROM content.question_clusters c
      WHERE c.workspace_id = $1
      ORDER BY c.created_at DESC
      LIMIT 200`,
    [workspaceId, USABLE_STATUSES],
  );
  return res.rows.map(rowToCluster);
}

export async function getCluster(workspaceId: string, clusterId: string): Promise<QuestionCluster | null> {
  await ensureContentSchema();
  const res = await pool().query(
    `SELECT c.*,
            (
              SELECT COUNT(*)::int
                FROM content.question_cluster_members m
                JOIN content.questions q ON q.id = m.question_id
               WHERE m.cluster_id = c.id AND q.status::text = ANY($3::text[])
            ) AS question_count
       FROM content.question_clusters c
      WHERE c.workspace_id = $1 AND c.id = $2`,
    [workspaceId, clusterId, USABLE_STATUSES],
  );
  return res.rows[0] ? rowToCluster(res.rows[0]) : null;
}

/** Ordered members of a cluster, including ones not yet usable in a test. */
export async function listClusterMembers(workspaceId: string, clusterId: string): Promise<ClusterMember[]> {
  await ensureContentSchema();
  const res = await pool().query(
    `SELECT m.question_id, m.position, m.added_at
       FROM content.question_cluster_members m
       JOIN content.question_clusters c ON c.id = m.cluster_id AND c.workspace_id = $1
      WHERE m.cluster_id = $2
      ORDER BY m.position ASC`,
    [workspaceId, clusterId],
  );
  return res.rows.map((row) => ({
    questionId: String(row.question_id),
    position: Number(row.position),
    addedAt: new Date(row.added_at as string).toISOString(),
  }));
}

/**
 * A cluster's TEST-USABLE question ids, in cluster order — what the source
 * stack draws. Questions still in review are skipped rather than resolving to a
 * question the taker cannot render.
 */
export async function listClusterUsableQuestionIds(
  workspaceId: string,
  clusterId: string,
): Promise<string[]> {
  await ensureContentSchema();
  const res = await pool().query(
    `SELECT m.question_id
       FROM content.question_cluster_members m
       JOIN content.question_clusters c ON c.id = m.cluster_id AND c.workspace_id = $1
       JOIN content.questions q ON q.id = m.question_id AND q.status::text = ANY($3::text[])
      WHERE m.cluster_id = $2
      ORDER BY m.position ASC`,
    [workspaceId, clusterId, USABLE_STATUSES],
  );
  return res.rows.map((row) => String(row.question_id));
}

export async function createCluster(input: {
  workspaceId: string;
  name: string;
  description?: string | null;
  sourceImportJobId?: string | null;
  createdBy: string;
}): Promise<QuestionCluster> {
  await ensureContentSchema();
  const id = createQuestionClusterId();
  await pool().query(
    `INSERT INTO content.question_clusters
       (id, workspace_id, name, description, source_import_job_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      id,
      input.workspaceId,
      input.name,
      input.description ?? null,
      input.sourceImportJobId ?? null,
      input.createdBy,
    ],
  );
  const created = await getCluster(input.workspaceId, id);
  if (!created) throw new Error("Failed to create cluster.");
  return created;
}

export async function updateCluster(
  workspaceId: string,
  clusterId: string,
  patch: { name?: string; description?: string | null },
): Promise<QuestionCluster | null> {
  await ensureContentSchema();
  const sets: string[] = [];
  const values: unknown[] = [workspaceId, clusterId];
  if (patch.name !== undefined) {
    values.push(patch.name);
    sets.push(`name = $${values.length}`);
  }
  if (patch.description !== undefined) {
    values.push(patch.description);
    sets.push(`description = $${values.length}`);
  }
  if (sets.length === 0) return getCluster(workspaceId, clusterId);
  sets.push("updated_at = NOW()");
  const res = await pool().query(
    `UPDATE content.question_clusters SET ${sets.join(", ")}
      WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    values,
  );
  return res.rowCount ? getCluster(workspaceId, clusterId) : null;
}

/** Deletes the cluster and its membership rows. Questions are untouched (D8). */
export async function deleteCluster(workspaceId: string, clusterId: string): Promise<boolean> {
  await ensureContentSchema();
  const res = await pool().query(
    `DELETE FROM content.question_clusters WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, clusterId],
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Appends questions to the end of a cluster, in the order given.
 *
 * Only questions the workspace owns are added — an id from another workspace is
 * silently skipped rather than raising, so a probe cannot confirm it exists.
 * A question already in the cluster keeps its existing position (the PK makes
 * this a no-op) instead of jumping to the end, so re-adding is harmless.
 *
 * Returns how many rows were actually inserted.
 */
export async function addQuestionsToCluster(
  workspaceId: string,
  clusterId: string,
  questionIds: readonly string[],
): Promise<number> {
  await ensureContentSchema();
  const unique = [...new Set(questionIds.filter(Boolean))];
  if (unique.length === 0) return 0;

  const client = await pool().connect();
  try {
    await client.query("BEGIN");

    // Ownership of the cluster AND of every question, checked in SQL.
    const owns = await client.query(
      `SELECT 1 FROM content.question_clusters WHERE id = $1 AND workspace_id = $2`,
      [clusterId, workspaceId],
    );
    if (owns.rowCount === 0) {
      await client.query("ROLLBACK");
      return 0;
    }

    const nextRes = await client.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM content.question_cluster_members WHERE cluster_id = $1`,
      [clusterId],
    );
    const start = Number(nextRes.rows[0]?.next ?? 0);

    const res = await client.query(
      `INSERT INTO content.question_cluster_members (cluster_id, question_id, position)
       SELECT $1, q.id, $2 + (ord.idx - 1)
         FROM UNNEST($3::text[]) WITH ORDINALITY AS ord(qid, idx)
         JOIN content.questions q ON q.id = ord.qid AND q.workspace_id = $4
       ON CONFLICT (cluster_id, question_id) DO NOTHING`,
      [clusterId, start, unique, workspaceId],
    );

    await client.query(
      `UPDATE content.question_clusters SET updated_at = NOW() WHERE id = $1`,
      [clusterId],
    );
    // Re-close the gaps any skipped/duplicate id left in the position sequence.
    await normalizePositions(client, clusterId);
    await client.query("COMMIT");
    return res.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function removeQuestionFromCluster(
  workspaceId: string,
  clusterId: string,
  questionId: string,
): Promise<boolean> {
  await ensureContentSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `DELETE FROM content.question_cluster_members m
        USING content.question_clusters c
        WHERE m.cluster_id = c.id AND c.workspace_id = $1
          AND m.cluster_id = $2 AND m.question_id = $3`,
      [workspaceId, clusterId, questionId],
    );
    if (res.rowCount) {
      await normalizePositions(client, clusterId);
      await client.query(`UPDATE content.question_clusters SET updated_at = NOW() WHERE id = $1`, [clusterId]);
    }
    await client.query("COMMIT");
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rewrites the cluster's order from the given id list.
 *
 * Ids absent from the list keep their relative order AFTER the listed ones, so
 * a stale client that reorders a subset can never silently drop a question.
 */
export async function reorderCluster(
  workspaceId: string,
  clusterId: string,
  orderedQuestionIds: readonly string[],
): Promise<boolean> {
  await ensureContentSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const owns = await client.query(
      `SELECT 1 FROM content.question_clusters WHERE id = $1 AND workspace_id = $2`,
      [clusterId, workspaceId],
    );
    if (owns.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    // Listed ids first, in the given order; everything else keeps its old order
    // behind them. `position` is bumped clear of the current range first so the
    // rewrite cannot trip the (cluster_id, position) ordering mid-update.
    await client.query(
      `UPDATE content.question_cluster_members
          SET position = position + 1000000
        WHERE cluster_id = $1`,
      [clusterId],
    );
    await client.query(
      `UPDATE content.question_cluster_members m
          SET position = ord.idx - 1
         FROM UNNEST($2::text[]) WITH ORDINALITY AS ord(qid, idx)
        WHERE m.cluster_id = $1 AND m.question_id = ord.qid`,
      [clusterId, [...orderedQuestionIds]],
    );
    await normalizePositions(client, clusterId);
    await client.query(`UPDATE content.question_clusters SET updated_at = NOW() WHERE id = $1`, [clusterId]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Collapses positions to a dense 0..n-1 run, preserving the current order. */
async function normalizePositions(
  client: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  clusterId: string,
): Promise<void> {
  await client.query(
    `UPDATE content.question_cluster_members m
        SET position = ranked.rn - 1
       FROM (
         SELECT question_id, ROW_NUMBER() OVER (ORDER BY position ASC, added_at ASC, question_id ASC) AS rn
           FROM content.question_cluster_members
          WHERE cluster_id = $1
       ) ranked
      WHERE m.cluster_id = $1 AND m.question_id = ranked.question_id
        AND m.position <> ranked.rn - 1`,
    [clusterId],
  );
}

/** Cluster ids each question belongs to — powers the "in N clusters" chip. */
export async function listClusterMapForWorkspace(workspaceId: string): Promise<Record<string, string[]>> {
  await ensureContentSchema();
  const res = await pool().query(
    `SELECT m.question_id, m.cluster_id
       FROM content.question_cluster_members m
       JOIN content.question_clusters c ON c.id = m.cluster_id
      WHERE c.workspace_id = $1`,
    [workspaceId],
  );
  const map: Record<string, string[]> = {};
  for (const row of res.rows) {
    const questionId = String(row.question_id);
    (map[questionId] ??= []).push(String(row.cluster_id));
  }
  return map;
}
