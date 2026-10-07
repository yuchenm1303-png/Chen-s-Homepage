import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260902075500_monitor_queued_lifecycle.sql", import.meta.url);
const activityPath = new URL("../download/usage-task-activity-v2.js", import.meta.url);
const statusPath = new URL("../download/usage-task-status-v1.js", import.meta.url);

test("queued batch jobs are persisted separately from running", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /job_status[^\n]*QUEUED|QUEUED/);
  assert.match(sql, /new\.status := 'queued'/);
  assert.match(sql, /then 'queued'/);
  assert.match(sql, /'queued', h\.queued/);
});

test("queued tasks are rendered as static queued lifecycle state", async () => {
  const activity = await readFile(activityPath, "utf8");
  const status = await readFile(statusPath, "utf8");
  assert.match(activity, /"queued"/);
  assert.match(activity, /queued: "排队中"/);
  assert.match(activity, /totals\.queued/);
  assert.match(status, /\["QUEUED", "queued"\]/);
  assert.doesNotMatch(activity, /bucket\.counts\.queued\)[^\n]*has-running/);
});
