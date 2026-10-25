import test from "node:test";
import assert from "node:assert/strict";

import { createPostgresPoolConfig } from "../../src/server/postgres-config";
import {
  readStoreAsync,
  ScopedWritePlan,
  withStoreAsyncScoped,
  type AppStore,
  type StoredNote,
} from "../../src/server/store";
import {
  buildScopedDeleteStatement,
  buildScopedReplaceStatement,
  persistStoreToPostgres,
} from "../../src/server/store-postgres";

type G = Record<string, unknown>;
const g = globalThis as unknown as G;

/**
 * Fake user pool in its globalThis slot (schema-ensure flags pre-set so no DDL
 * runs). Every statement — pool.query or a checked-out client — is recorded.
 */
function installFakeUserPool(): string[] {
  const sql: string[] = [];
  const query = async (text: string) => {
    sql.push(text.replace(/\s+/g, " ").trim());
    return { rows: [], rowCount: 0 };
  };
  const url = "postgres://fake:fake@127.0.0.1:1/fake_scoped_writes";
  process.env.USER_DATABASE_URL = url;
  g.__originUserSchemaEnsured = true;
  g.__originAppStoreSchemaEnsured = true;
  g.__originUserPool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
    end: async () => undefined,
  };
  g.__originUserPoolConnectionString = createPostgresPoolConfig(url, 25).connectionString;
  return sql;
}

function note(id: string, userId: string): StoredNote {
  const now = new Date().toISOString();
  return {
    id, userId, bookId: "book", chapterId: null, pageNumber: null,
    content: "c", color: "#fff", createdAt: now, updatedAt: now, tags: [],
  };
}

const WHOLE_TABLE_DELETE = /DELETE FROM app\.[a-z_]+(?!.*WHERE)/;

test("scoped notes save: upserts + targeted delete only, never DELETE FROM app.practice_attempts", async () => {
  const sql = installFakeUserPool();
  const plan = new ScopedWritePlan();
  await withStoreAsyncScoped((store: AppStore) => {
    store.notes = store.notes.filter((n) => n.id !== "note_old");
    store.notes.unshift(note("note_new", "user_a"));
    plan.forUser("user_a").touch("notes").remove("notes", "note_old");
    return null;
  }, plan.toPersist);

  const writes = sql.filter((s) => /^(INSERT|UPDATE|DELETE)/.test(s));
  assert.ok(
    writes.some((s) => s === "DELETE FROM app.notes WHERE user_id = $1 AND id = $2"),
    "targeted note delete issued",
  );
  assert.ok(writes.some((s) => s.startsWith("INSERT INTO app.notes")), "note upserted");
  assert.equal(writes.some((s) => s.includes("app.practice_attempts")), false);
  assert.equal(writes.some((s) => WHOLE_TABLE_DELETE.test(s)), false, "no whole-table DELETE");
  assert.deepEqual(
    [...new Set(writes.map((s) => s.match(/app\.[a-z_]+/)?.[0]))],
    ["app.notes"],
    "only the declared collection is written",
  );
});

test("a handler that never binds the plan (e.g. unauthorized) writes nothing", async () => {
  const sql = installFakeUserPool();
  const plan = new ScopedWritePlan();
  await withStoreAsyncScoped(() => "unauthorized", plan.toPersist);
  assert.equal(sql.some((s) => /^(BEGIN|INSERT|UPDATE|DELETE)/.test(s)), false);
});

test("read-only scoped call (persist null) writes nothing", async () => {
  const sql = installFakeUserPool();
  await withStoreAsyncScoped((store) => store.notes.length, null);
  assert.equal(sql.some((s) => /^(BEGIN|INSERT|UPDATE|DELETE)/.test(s)), false);
});

test("buildScopedDeleteStatement is always user-scoped and refuses non-deletable collections", () => {
  for (const [collection, table] of [
    ["notes", "notes"],
    ["bookmarks", "bookmarks"],
    ["savedBooks", "saved_books"],
    ["doubtSessions", "doubt_sessions"],
    ["originAiSessions", "origin_ai_sessions"],
    ["tasks", "tasks"],
  ] as const) {
    const statement = buildScopedDeleteStatement(collection, "u1", "row1");
    assert.equal(statement.text, `DELETE FROM app.${table} WHERE user_id = $1 AND id = $2`);
    assert.deepEqual(statement.values, ["u1", "row1"]);
  }
  assert.throws(() =>
    buildScopedDeleteStatement("practiceAttempts" as unknown as "notes", "u1", "row1"),
  );
});

test("buildScopedReplaceStatement clears ONE user's rows and refuses other collections", () => {
  const statement = buildScopedReplaceStatement("originAiReminders", "u1");
  assert.equal(statement.text, "DELETE FROM app.origin_ai_reminders WHERE user_id = $1");
  assert.deepEqual(statement.values, ["u1"]);
  assert.throws(() => buildScopedReplaceStatement("practiceAttempts" as unknown as "originAiReminders", "u1"));
  assert.throws(() => buildScopedReplaceStatement("originAiReminders", ""), "never without a user");
});

test("scoped replace + tasks: user-scoped clear, then only this user's rows are upserted", async () => {
  const sql = installFakeUserPool();
  const plan = new ScopedWritePlan();
  await withStoreAsyncScoped((store: AppStore) => {
    const now = new Date().toISOString();
    store.originAiReminders = [
      { id: "r_other", userId: "user_b", title: "t", detail: "d", kind: "habit", priority: "low", createdAt: now },
      { id: "r_mine", userId: "user_a", title: "t", detail: "d", kind: "habit", priority: "low", createdAt: now },
    ] as unknown as AppStore["originAiReminders"];
    store.tasks = [
      { id: "t_other", userId: "user_b", text: "x", completed: false, due: "2026-11-01", createdAt: now },
      { id: "t_mine", userId: "user_a", text: "y", completed: false, due: "2026-11-01", createdAt: now },
    ];
    plan.forUser("user_a").replaceAll("originAiReminders").touchTasks();
    return null;
  }, plan.toPersist);

  const writes = sql.filter((s) => /^(INSERT|UPDATE|DELETE)/.test(s));
  assert.equal(writes[0], "DELETE FROM app.origin_ai_reminders WHERE user_id = $1", "clear runs before upserts");
  const reminderInsert = writes.find((s) => s.startsWith("INSERT INTO app.origin_ai_reminders"));
  assert.ok(reminderInsert, "reminders re-upserted");
  assert.equal((reminderInsert.match(/\(\$\d+,/g) ?? []).length, 1, "only user_a's one reminder");
  const taskInserts = writes.filter((s) => s.startsWith("INSERT INTO app.tasks"));
  assert.equal(taskInserts.length, 1, "only user_a's one task");
  assert.equal(writes.some((s) => WHOLE_TABLE_DELETE.test(s)), false, "no whole-table DELETE");
});

test("ScopedWritePlan refuses to write a second user", () => {
  const plan = new ScopedWritePlan().forUser("a");
  assert.throws(() => plan.forUser("b"));
  assert.equal(new ScopedWritePlan().forUser("a").toPersist(), null, "nothing touched → no write");
});

test("control: the legacy full persist DOES wipe app.practice_attempts (why N3 matters)", async () => {
  const sql = installFakeUserPool();
  await persistStoreToPostgres(await readStoreAsync());
  assert.ok(sql.includes("DELETE FROM app.practice_attempts"));
});
