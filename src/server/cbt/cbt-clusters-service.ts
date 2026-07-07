/**
 * CBT question clusters — many-to-many collections over cbt.questions. Every
 * query is scoped by teacher_id (the cbt.teachers.id tenant key); a cluster or
 * question the teacher does not own is invisible (404, no oracle). Clusters are
 * organizational only and may overlap freely — the "no shared question across
 * tests" rule is enforced elsewhere (the add-to-test path), not here.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import type { CbtCluster } from "@/lib/cbt/cluster-model";

import { ensureCbtSchema } from "./cbt-schema";
import { cbtId } from "./ids";

export type { CbtCluster };

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function cbtError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function mapCluster(row: Record<string, unknown>): CbtCluster {
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : null,
    questionCount: Number(row.question_count ?? 0),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function sanitizeName(raw: unknown): string {
  const name = String(raw ?? "").trim().slice(0, 120);
  if (!name) throw cbtError(400, "Cluster name is required.");
  return name;
}

function sanitizeDescription(raw: unknown): string | null {
  if (raw == null) return null;
  const d = String(raw).trim().slice(0, 500);
  return d.length > 0 ? d : null;
}

export async function listClusters(teacherId: string): Promise<CbtCluster[]> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT c.id, c.teacher_id, c.name, c.description, c.created_at, c.updated_at,
            COUNT(m.question_id)::int AS question_count
       FROM cbt.question_clusters c
       LEFT JOIN cbt.question_cluster_members m ON m.cluster_id = c.id
      WHERE c.teacher_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC`,
    [teacherId],
  );
  return res.rows.map(mapCluster);
}

async function getClusterOwned(teacherId: string, clusterId: string): Promise<void> {
  const res = await pool().query(
    `SELECT 1 FROM cbt.question_clusters WHERE id = $1 AND teacher_id = $2`,
    [clusterId, teacherId],
  );
  if (res.rowCount === 0) throw cbtError(404, "Cluster not found.");
}

export async function createCluster(
  teacherId: string,
  input: { name: unknown; description?: unknown },
): Promise<CbtCluster> {
  await ensureCbtSchema();
  const id = cbtId("cbtcluster");
  const res = await pool().query(
    `INSERT INTO cbt.question_clusters (id, teacher_id, name, description)
     VALUES ($1, $2, $3, $4)
     RETURNING id, teacher_id, name, description, created_at, updated_at, 0 AS question_count`,
    [id, teacherId, sanitizeName(input.name), sanitizeDescription(input.description)],
  );
  return mapCluster(res.rows[0]);
}

export async function updateCluster(
  teacherId: string,
  clusterId: string,
  input: { name?: unknown; description?: unknown },
): Promise<CbtCluster> {
  await ensureCbtSchema();
  await getClusterOwned(teacherId, clusterId);
  const res = await pool().query(
    `UPDATE cbt.question_clusters
        SET name = COALESCE($3, name),
            description = CASE WHEN $4::boolean THEN $5 ELSE description END,
            updated_at = NOW()
      WHERE id = $1 AND teacher_id = $2
      RETURNING id, teacher_id, name, description, created_at, updated_at,
                (SELECT COUNT(*)::int FROM cbt.question_cluster_members m WHERE m.cluster_id = $1) AS question_count`,
    [
      clusterId,
      teacherId,
      input.name == null ? null : sanitizeName(input.name),
      input.description !== undefined,
      input.description === undefined ? null : sanitizeDescription(input.description),
    ],
  );
  return mapCluster(res.rows[0]);
}

export async function deleteCluster(teacherId: string, clusterId: string): Promise<void> {
  await ensureCbtSchema();
  const res = await pool().query(
    `DELETE FROM cbt.question_clusters WHERE id = $1 AND teacher_id = $2`,
    [clusterId, teacherId],
  );
  if (res.rowCount === 0) throw cbtError(404, "Cluster not found.");
}

/**
 * Adds questions to a cluster. Only questions the teacher owns are inserted
 * (the INSERT…SELECT filters by teacher_id), so a foreign question id is
 * silently ignored rather than leaking existence. Idempotent via ON CONFLICT.
 * Returns how many memberships were newly created.
 */
export async function addQuestionsToCluster(
  teacherId: string,
  clusterId: string,
  questionIds: string[],
): Promise<{ added: number }> {
  await ensureCbtSchema();
  await getClusterOwned(teacherId, clusterId);
  const ids = questionIds.filter((q) => typeof q === "string" && q.length > 0);
  if (ids.length === 0) return { added: 0 };
  const res = await pool().query(
    `INSERT INTO cbt.question_cluster_members (cluster_id, question_id)
     SELECT $1, q.id FROM cbt.questions q
      WHERE q.teacher_id = $2 AND q.id = ANY($3::text[])
     ON CONFLICT (cluster_id, question_id) DO NOTHING`,
    [clusterId, teacherId, ids],
  );
  return { added: res.rowCount ?? 0 };
}

export async function removeQuestionFromCluster(
  teacherId: string,
  clusterId: string,
  questionId: string,
): Promise<void> {
  await ensureCbtSchema();
  await getClusterOwned(teacherId, clusterId);
  await pool().query(
    `DELETE FROM cbt.question_cluster_members WHERE cluster_id = $1 AND question_id = $2`,
    [clusterId, questionId],
  );
}

/** Map of question_id → cluster_ids for the teacher (drives client-side filtering). */
export async function listQuestionClusterMap(teacherId: string): Promise<Record<string, string[]>> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT m.question_id, m.cluster_id
       FROM cbt.question_cluster_members m
       JOIN cbt.question_clusters c ON c.id = m.cluster_id
      WHERE c.teacher_id = $1`,
    [teacherId],
  );
  const map: Record<string, string[]> = {};
  for (const r of res.rows) {
    const q = String(r.question_id);
    (map[q] ??= []).push(String(r.cluster_id));
  }
  return map;
}

/** Question ids in a cluster (teacher-scoped; empty if not owned). */
export async function listClusterQuestionIds(teacherId: string, clusterId: string): Promise<string[]> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT m.question_id
       FROM cbt.question_cluster_members m
       JOIN cbt.question_clusters c ON c.id = m.cluster_id
      WHERE m.cluster_id = $1 AND c.teacher_id = $2
      ORDER BY m.added_at ASC`,
    [clusterId, teacherId],
  );
  return res.rows.map((r) => String(r.question_id));
}
