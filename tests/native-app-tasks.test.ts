import test from "node:test";
import assert from "node:assert/strict";

// V1/NATIVE_APP_API_PLAN.md — tasks for the native app's focus screen and daily missions.

async function call(method: string, path: string, body?: unknown) {
  const { NextRequest } = await import("next/server");
  const { handleAppApi } = await import("../src/server/mobile/app-api");
  const req = new NextRequest(new URL(`/api/mobile/${path}`, "https://www.o3origin.com"), {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return handleAppApi(method, req, path.split("/"));
}

test("a new task needs text, checked before any work is done", async () => {
  for (const body of [{}, { text: "" }, { text: "   " }, { text: 42 }]) {
    const res = await call("POST", "tasks", body);
    assert.equal(res?.status, 400);
    assert.deepEqual(await res?.json(), { detail: "Write the task first." });
  }
});

test("over-long task text is refused on add and on edit", async () => {
  const long = "x".repeat(201);
  const add = await call("POST", "tasks", { text: long });
  assert.equal(add?.status, 400);
  assert.match((await add?.json()).detail, /under 200 characters/);
  const edit = await call("PATCH", "tasks/t1", { text: long });
  assert.equal(edit?.status, 400);
});

test("a task update must change something", async () => {
  const res = await call("PATCH", "tasks/t1", { completed: "yes" });
  assert.equal(res?.status, 400);
  assert.deepEqual(await res?.json(), { detail: "Nothing to update." });
});

test("task paths that don't exist fall through to the catch-all's 404", async () => {
  assert.equal(await call("DELETE", "tasks"), null);
  assert.equal(await call("GET", "tasks/t1"), null);
  assert.equal(await call("POST", "tasks/t1", { text: "x" }), null);
  assert.equal(await call("PATCH", "tasks", { completed: true }), null);
  assert.equal(await call("GET", "tasks/t1/extra"), null);
});
