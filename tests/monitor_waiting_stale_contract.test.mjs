import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260902073000_monitor_waiting_and_stale_lifecycle.sql", import.meta.url);
const activityPath = new URL("../download/usage-task-activity-v2.js", import.meta.url);

test("human-interaction waits are persisted and projected as waiting", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /WAITING_SOURCE_INTERACTION/);
  assert.match(sql, /new\.status := 'waiting'/);
  assert.match(sql, /then 'waiting'/);
});

test("old active rows stop presenting as live running after the freshness window", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /interval '60 minutes'/);
  assert.match(sql, /then 'stale'/);
});

test("monitor renders waiting and stale separately from animated running", async () => {
  const source = await readFile(activityPath, "utf8");
  assert.match(source, /"waiting", "stale"/);
  assert.match(source, /waiting: "等待操作"/);
  assert.match(source, /stale: "已停滞"/);
  assert.match(source, /bucket\.counts\.running/);
  assert.doesNotMatch(source, /bucket\.counts\.waiting\)[^\n]*has-running/);
  assert.doesNotMatch(source, /bucket\.counts\.stale\)[^\n]*has-running/);
});
