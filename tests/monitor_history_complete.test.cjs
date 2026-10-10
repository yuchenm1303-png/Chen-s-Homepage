const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const core = fs.readFileSync(path.join(__dirname, "../download/usage-admin-v2-core.js"), "utf8");
const modal = fs.readFileSync(path.join(__dirname, "../download/usage-detail-modal-v1.js"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../download/usage.html"), "utf8");
assert(core.includes("renderAccountHistory(user)"), "account cards must expose per-account history");
assert(core.includes('window.addEventListener("usage:task-history-progress"'), "stats must reconcile to complete history");
assert(core.includes("appendFullAuditEvidence(hydratedBody, data, sourceAuditId)"), "detail must surface history and logs");
assert(modal.includes("group.parts") && modal.includes("gunzipChunkedText"), "task log chunks must be reconstructed");
assert(modal.includes("sha256Hex(text)"), "task log content integrity must be verified");
assert(page.includes("usage-monitor-history-v1.css"), "complete history must be visible and styled");

const historyPath = path.join(__dirname, "../download/usage-task-history-v2.js");
const source = fs.readFileSync(historyPath, "utf8");
assert(source.includes('const HISTORY_VIEW = "revisions"'));
let code = source.slice(0, source.indexOf("function install() {"));
const cardStart = code.indexOf("function makePagedTaskCard(audit) {");
const cardEnd = code.indexOf("\nfunction captureTaskCards(cards) {", cardStart);
assert(cardStart >= 0 && cardEnd > cardStart);
code = code.slice(0, cardStart) + [
  "function makePagedTaskCard(audit) {",
  "return { dataset: { revisionId: audit.revision_id, userId: audit.user_id, auditId: audit.id } };",
  "}",
  ""
].join("\n") + code.slice(cardEnd);

function makeRecords(count, start = 1) {
  return Array.from({ length: count }, (_, n) => {
    const id = n + start;
    return {
      id: "source-" + id + ":revision:" + id,
      source_audit_id: "source-" + id,
      revision_id: String(id),
      user_id: id <= 414 ? "target-user" : "other-user",
      task_kind: "batch",
      status: id % 7 === 0 ? "failed" : "completed",
      updated_at: "2026-10-09T06:27:07.423Z",
    };
  }).reverse();
}
function setup(initialRecords) {
  let records = initialRecords;
  let failAfter = Infinity;
  let calls = 0;
  const client = {
    auth: { getSession: async () => ({ data: { session: { access_token: "fake-test-only" } } }) },
    functions: {
      invoke: async (name, { body }) => {
        assert.equal(name, "portal-task-history");
        assert.equal(body.view, "revisions");
        assert.equal(body.limit, 120);
        calls++;
        if (calls > failAfter) throw new Error("simulated network failure");
        const cursor = body.before_revision_id ? Number(body.before_revision_id) : Infinity;
        const selected = records.filter((x) => Number(x.revision_id) < cursor).slice(0, 121);
        const page = selected.slice(0, 120);
        return {
          data: {
            query_architecture: "usage_monitor_task_revisions_v1",
            task_audits: page,
            has_more: selected.length > 120,
            next_before_revision_id: selected.length > 120 ? page.at(-1).revision_id : null,
          }
        };
      }
    }
  };
  const events = [];
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout,
    document: { getElementById: () => ({}) },
    queueMicrotask: () => {},
    window: { setTimeout, dispatchEvent: (event) => events.push(event.detail) },
    CustomEvent: class { constructor(type, opts) { this.type=type; this.detail=opts.detail; } },
    __client: client,
  });
  vm.runInContext(code, ctx, { filename: "usage-task-history-v2.js" });
  vm.runInContext("historyClient = __client;", ctx);
  return {
    async load() { await vm.runInContext("loadOlderTasks()", ctx); },
    async update() { await vm.runInContext("syncNewRevisions()", ctx); },
    get count() { return vm.runInContext("historyRows.size", ctx); },
    get complete() { return vm.runInContext("historyComplete", ctx); },
    get error() { return vm.runInContext("historyError", ctx); },
    get targetCount() { return vm.runInContext("Array.from(historyRows.values()).filter(x => x.user_id==='target-user').length", ctx); },
    setData(next) { records = next; },
    setFailAfter(next) { failAfter = next; calls = 0; },
    events,
  };
}

(async () => {
  const store = setup(makeRecords(1143));
  await store.load();
  assert.equal(store.count, 1143);
  assert.equal(store.targetCount, 414);
  assert.equal(store.complete, true);
  assert.equal(store.error, "");
  assert.equal(store.events.at(-1).complete, true);

  store.setData(makeRecords(1323));
  await store.update();
  assert.equal(store.count, 1323);
  assert.equal(store.targetCount, 414);
  assert.equal(store.error, "");

  const intermittent = setup(makeRecords(1143));
  intermittent.setFailAfter(2);
  await intermittent.load();
  assert.equal(intermittent.count, 240);
  assert.equal(intermittent.complete, false);
  assert.match(intermittent.error, /simulated network failure/);
  intermittent.setFailAfter(Infinity);
  await intermittent.load();
  assert.equal(intermittent.count, 1143);
  assert.equal(intermittent.complete, true);
  assert.equal(intermittent.error, "");
  console.log("PASS: 1,143 revisions / 414 target / incremental +180 / retry after page 2");
})().catch((error) => { console.error(error); process.exitCode=1; });
