const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const auth = config.auth ?? {};

const opsSection = document.getElementById("opsSection");
const opsKpis = document.getElementById("opsKpis");
const deviceHealthPanel = document.getElementById("deviceHealthPanel");
const taskPerformancePanel = document.getElementById("taskPerformancePanel");
const versionHealthPanel = document.getElementById("versionHealthPanel");
const diagnosticsSection = document.getElementById("diagnosticsSection");
const diagnosticsPanel = document.getElementById("diagnosticsPanel");
const diagnosticsHint = document.getElementById("diagnosticsHint");

let supabase = null;
let timer = null;
let refreshing = false;

function num(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtBytes(value) {
  const bytes = num(value);
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let amount = bytes;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount >= 100 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function fmtDuration(seconds) {
  const value = num(seconds);
  if (!value) return "—";
  if (value < 1) return `${Math.round(value * 1000)} ms`;
  if (value < 60) return `${value.toFixed(value < 10 ? 1 : 0)} s`;
  if (value < 3600) return `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;
  return `${Math.floor(value / 3600)}h ${Math.round((value % 3600) / 60)}m`;
}

function fmtTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date);
}

function percent(value, digits = 1) {
  return `${num(value).toFixed(digits)}%`;
}

function durationOf(audit) {
  const start = Date.parse(audit?.started_at || "");
  const end = Date.parse(audit?.completed_at || audit?.updated_at || "");
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? (end - start) / 1000 : 0;
}

function phaseStats(audit) {
  const result = audit?.result_data || {};
  const cold = result.cold || {};
  const hot = result.hot || {};
  const modelCalls = num(cold.model_calls) + num(hot.model_calls) + num(cold.web_model_calls) + num(hot.web_model_calls);
  const cacheHits = num(cold.cache_hits) + num(hot.cache_hits) + num(cold.web_cache_hits) + num(hot.web_cache_hits);
  const batches = num(cold.batch_count) + num(hot.batch_count) + num(cold.web_batch_count) + num(hot.web_batch_count);
  return {
    modelCalls,
    cacheHits,
    batches,
    coldSeconds: num(cold.elapsed_seconds),
    hotSeconds: num(hot.elapsed_seconds),
    executeSeconds: num(result.execution_elapsed_seconds),
  };
}

function percentile(values, q) {
  const sorted = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * q) - 1));
  return sorted[index];
}

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = String(text);
  return node;
}

function meta(label, value) {
  const item = el("div", "meta-item");
  item.append(el("span", "", label), el("strong", "", value));
  return item;
}

function kpi(overline, value, note) {
  const card = el("article", "utility-card cards usage-ops-kpi");
  card.append(el("span", "utility-overline", overline), el("h3", "", value), el("p", "", note));
  return card;
}

function userNameMap(snapshot) {
  const map = new Map();
  for (const user of Array.isArray(snapshot?.users) ? snapshot.users : []) {
    const id = String(user.user_id || user.id || "");
    if (id) map.set(id, user.display_name || user.email || id.slice(0, 8));
  }
  return map;
}

function latestSamples(samples) {
  const map = new Map();
  for (const row of samples) {
    const key = `${row.user_id || ""}:${row.device_id || ""}`;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function sampleGroup(samples) {
  const groups = new Map();
  for (const row of samples) {
    const key = `${row.user_id || ""}:${row.device_id || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const list of groups.values()) list.sort((a, b) => Date.parse(a.occurred_at || "") - Date.parse(b.occurred_at || ""));
  return groups;
}

function renderSpark(target, values, mode = "normal") {
  target.replaceChildren();
  target.className = `usage-ops-spark${mode === "lag" ? " is-lag" : ""}`;
  if (!values.length) return;
  const buckets = Array.from({ length: 24 }, () => []);
  const now = Date.now();
  for (const item of values) {
    const time = Date.parse(item.time || "");
    if (!Number.isFinite(time)) continue;
    const ageHours = Math.floor((now - time) / 3600000);
    if (ageHours < 0 || ageHours > 23) continue;
    buckets[23 - ageHours].push(num(item.value));
  }
  const averages = buckets.map((list) => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
  const max = Math.max(1, ...averages);
  for (const value of averages) {
    const bar = el("i");
    bar.style.height = value ? `${Math.max(4, (value / max) * 100)}%` : "1px";
    bar.title = value ? String(Math.round(value * 100) / 100) : "无数据";
    target.append(bar);
  }
}

function renderDeviceHealth(snapshot) {
  const samples = Array.isArray(snapshot?.system_samples) ? snapshot.system_samples : [];
  const names = userNameMap(snapshot);
  deviceHealthPanel.replaceChildren();

  const head = el("div", "usage-ops-panel-head");
  const title = el("div");
  title.append(el("p", "kicker", "CLIENT HEALTH"), el("h3", "", "设备与客户端性能"));
  head.append(title, el("span", "", samples.length ? `${samples.length} samples · ${snapshot.system_window_hours || 24}h` : "等待新版客户端采样"));
  deviceHealthPanel.append(head);

  const latest = latestSamples(samples);
  if (!latest.length) {
    deviceHealthPanel.append(el("div", "usage-ops-empty", "暂无 System Health 样本；包含该功能的新客户端启动约 8 秒后开始出现。"));
    return;
  }

  const groups = sampleGroup(samples);
  for (const row of latest) {
    const sample = row.sample || {};
    const cpu = sample.cpu || {};
    const memory = sample.memory || {};
    const process = sample.process || {};
    const edge = sample.edge || {};
    const windowState = sample.window || {};
    const telemetry = sample.telemetry || {};
    const disk = sample.disk || {};
    const task = sample.task || {};
    const key = `${row.user_id || ""}:${row.device_id || ""}`;
    const history = groups.get(key) || [];

    const details = el("details", "usage-diagnostic-item");
    const summary = el("summary");
    const summaryGrid = el("div", "usage-diagnostic-summary");
    const identity = el("div");
    identity.append(
      el("p", "kicker", row.app_version ? `v${row.app_version}` : "CLIENT"),
      el("h3", "", names.get(String(row.user_id || "")) || String(row.user_id || "").slice(0, 8)),
      el("p", "usage-account-email", `${String(row.device_id || "").slice(0, 12)} · ${fmtTime(row.occurred_at)}`)
    );
    const health = el("span", `usage-ops-pill ${num(windowState.event_loop_lag_ms) > 500 || num(memory.used_percent) > 90 ? "is-warn" : "is-ok"}`,
      `${percent(cpu.process_percent)} CPU · ${fmtBytes(process.working_set_bytes)}`);
    summaryGrid.append(identity, health);
    summary.append(summaryGrid);
    details.append(summary);

    const body = el("div", "usage-diagnostic-body");
    const grid = el("div", "usage-diagnostic-meta");
    grid.append(
      meta("系统 CPU", percent(cpu.system_percent)),
      meta("应用 CPU", percent(cpu.process_percent)),
      meta("应用内存", fmtBytes(process.working_set_bytes)),
      meta("峰值内存", fmtBytes(process.peak_working_set_bytes)),
      meta("系统内存", `${percent(memory.used_percent)} · ${fmtBytes(memory.available_bytes)} free`),
      meta("Edge", `${num(edge.count)} proc · ${fmtBytes(edge.working_set_bytes)}`),
      meta("UI Event Loop Lag", `${num(windowState.event_loop_lag_ms).toFixed(1)} ms`),
      meta("Telemetry RTT", `${num(telemetry.last_request_latency_ms).toFixed(0)} ms · HTTP ${num(telemetry.last_http_status) || "—"}`),
      meta("磁盘", `${percent(disk.used_percent)} · ${fmtBytes(disk.free_bytes)} free`),
      meta("运行时长", fmtDuration(sample.uptime_seconds)),
      meta("窗口", `${windowState.visible ? "visible" : "hidden"} · ${windowState.active ? "active" : "background"}`),
      meta("任务", task.single_execute_running ? "Single Execute" : task.single_prepare_running ? "Single Prepare" : task.batch_running ? `Batch ${task.batch_status || "running"}` : "Idle")
    );
    body.append(grid);

    const cpuSpark = el("div");
    const lagSpark = el("div");
    renderSpark(cpuSpark, history.map((item) => ({ time: item.occurred_at, value: item.sample?.cpu?.process_percent || 0 })));
    renderSpark(lagSpark, history.map((item) => ({ time: item.occurred_at, value: item.sample?.window?.event_loop_lag_ms || 0 })), "lag");
    body.append(el("p", "usage-ops-panel-meta", "24H 应用 CPU"), cpuSpark, el("p", "usage-ops-panel-meta", "24H UI Event Loop Lag"), lagSpark);

    const raw = el("pre", "usage-diagnostic-json");
    raw.textContent = JSON.stringify(row, null, 2);
    body.append(el("p", "usage-ops-panel-meta", "完整最新 System Health Sample"), raw);
    details.append(body);
    deviceHealthPanel.append(details);
  }
}

function renderTaskPerformance(snapshot) {
  const audits = Array.isArray(snapshot?.task_audits) ? snapshot.task_audits : [];
  const names = userNameMap(snapshot);
  taskPerformancePanel.replaceChildren();

  const head = el("div", "usage-ops-panel-head");
  const title = el("div");
  title.append(el("p", "kicker", "TASK PERFORMANCE"), el("h3", "", "任务耗时与 AI 调用"));
  head.append(title, el("span", "", `${audits.length} recent tasks`));
  taskPerformancePanel.append(head);

  if (!audits.length) {
    taskPerformancePanel.append(el("div", "usage-ops-empty", "暂无新版任务审计数据。"));
    return;
  }

  const table = el("div", "usage-ops-table");
  const header = el("div", "usage-ops-row is-head");
  ["任务", "总耗时", "AI Calls", "Cache", "Cold/Hot", "Execute"].forEach((text) => header.append(el("div", "usage-ops-cell", text)));
  table.append(header);

  for (const audit of audits.slice(0, 80)) {
    const stats = phaseStats(audit);
    const row = el("div", "usage-ops-row");
    const first = el("div", "usage-ops-cell");
    first.append(el("strong", "", `${audit.task_kind === "batch" ? "Batch" : "Single"} · ${names.get(String(audit.user_id || "")) || String(audit.user_id || "").slice(0, 8)}`));
    first.append(el("small", "", `${audit.status || "—"} · v${audit.app_version || "—"} · ${fmtTime(audit.updated_at)}`));
    row.append(
      first,
      el("div", "usage-ops-cell", fmtDuration(durationOf(audit))),
      el("div", "usage-ops-cell", String(stats.modelCalls)),
      el("div", "usage-ops-cell", stats.batches ? `${stats.cacheHits}/${stats.batches}` : String(stats.cacheHits)),
      el("div", "usage-ops-cell", `${fmtDuration(stats.coldSeconds)} / ${fmtDuration(stats.hotSeconds)}`),
      el("div", "usage-ops-cell", fmtDuration(stats.executeSeconds))
    );
    table.append(row);
  }
  taskPerformancePanel.append(table);
}

function renderVersionHealth(snapshot) {
  const audits = Array.isArray(snapshot?.task_audits) ? snapshot.task_audits : [];
  const diagnostics = Array.isArray(snapshot?.diagnostic_reports) ? snapshot.diagnostic_reports : [];
  const users = Array.isArray(snapshot?.users) ? snapshot.users : [];
  versionHealthPanel.replaceChildren();

  const head = el("div", "usage-ops-panel-head");
  const title = el("div");
  title.append(el("p", "kicker", "VERSION HEALTH"), el("h3", "", "版本稳定性"));
  head.append(title, el("span", "", "task + crash correlation"));
  versionHealthPanel.append(head);

  const versions = new Map();
  function bucket(version) {
    const key = version || "unknown";
    if (!versions.has(key)) versions.set(key, { version: key, tasks: 0, failed: 0, durations: [], crashes: 0, users: new Set() });
    return versions.get(key);
  }
  for (const audit of audits) {
    const item = bucket(audit.app_version);
    item.tasks += 1;
    if (audit.status === "failed") item.failed += 1;
    const duration = durationOf(audit);
    if (duration) item.durations.push(duration);
    if (audit.user_id) item.users.add(audit.user_id);
  }
  for (const report of diagnostics) bucket(report.app_version).crashes += 1;
  for (const user of users) if (user.latest_app_version) bucket(user.latest_app_version).users.add(user.user_id || user.email || user.latest_app_version);

  const table = el("div", "usage-ops-table");
  const header = el("div", "usage-ops-row is-head");
  ["版本", "任务", "失败", "成功率", "Crash", "平均耗时"].forEach((text) => header.append(el("div", "usage-ops-cell", text)));
  table.append(header);

  const rows = [...versions.values()].sort((a, b) => String(b.version).localeCompare(String(a.version), undefined, { numeric: true }));
  if (!rows.length) {
    versionHealthPanel.append(el("div", "usage-ops-empty", "暂无版本任务数据。"));
    return;
  }
  for (const item of rows) {
    const avg = item.durations.length ? item.durations.reduce((a, b) => a + b, 0) / item.durations.length : 0;
    const success = item.tasks ? ((item.tasks - item.failed) / item.tasks) * 100 : 0;
    const row = el("div", "usage-ops-row");
    const first = el("div", "usage-ops-cell");
    first.append(el("strong", "", `v${item.version}`), el("small", "", `${item.users.size} accounts`));
    row.append(first, el("div", "usage-ops-cell", item.tasks), el("div", "usage-ops-cell", item.failed), el("div", "usage-ops-cell", item.tasks ? percent(success) : "—"), el("div", "usage-ops-cell", item.crashes), el("div", "usage-ops-cell", fmtDuration(avg)));
    table.append(row);
  }
  versionHealthPanel.append(table);
}

function renderDiagnostics(snapshot) {
  const reports = Array.isArray(snapshot?.diagnostic_reports) ? snapshot.diagnostic_reports : [];
  const names = userNameMap(snapshot);
  diagnosticsPanel.replaceChildren();
  diagnosticsHint.textContent = reports.length ? `${reports.length} 条 · 最近 ${snapshot.diagnostic_limit || reports.length}` : "0 条";

  if (!reports.length) {
    diagnosticsPanel.append(el("div", "usage-ops-empty", "暂无已上传 Crash / Diagnostic 报告。"));
    diagnosticsSection.hidden = false;
    return;
  }

  for (const report of reports) {
    const details = el("details", "account-card cards usage-diagnostic-item");
    const summary = el("summary");
    const summaryGrid = el("div", "usage-diagnostic-summary");
    const identity = el("div");
    identity.append(
      el("p", "kicker", report.report_code || "DIAGNOSTIC"),
      el("h3", "", `${names.get(String(report.user_id || "")) || String(report.user_id || "").slice(0, 8)} · ${report.startup_stage || "unknown stage"}`),
      el("p", "usage-account-email", `${fmtTime(report.created_at)} · v${report.app_version || "—"}`)
    );
    summaryGrid.append(identity, el("span", "usage-ops-pill is-warn", "CRASH / DIAG"));
    summary.append(summaryGrid);
    details.append(summary);

    const body = el("div", "usage-diagnostic-body");
    const grid = el("div", "usage-diagnostic-meta");
    grid.append(
      meta("Crash ID", report.crash_id || "—"),
      meta("启动阶段", report.startup_stage || "—"),
      meta("设备", String(report.device_id || "").slice(0, 18) || "—"),
      meta("版本", report.app_version || "—")
    );
    const raw = el("pre", "usage-diagnostic-json");
    raw.textContent = JSON.stringify(report.report || {}, null, 2);
    body.append(grid, raw);
    details.append(body);
    diagnosticsPanel.append(details);
  }
  diagnosticsSection.hidden = false;
}

function renderKpis(snapshot) {
  const audits = Array.isArray(snapshot?.task_audits) ? snapshot.task_audits : [];
  const diagnostics = Array.isArray(snapshot?.diagnostic_reports) ? snapshot.diagnostic_reports : [];
  const samples = Array.isArray(snapshot?.system_samples) ? snapshot.system_samples : [];
  const durations = audits.map(durationOf).filter(Boolean);
  const stats = audits.map(phaseStats);
  const totalCalls = stats.reduce((sum, item) => sum + item.modelCalls, 0);
  const totalCache = stats.reduce((sum, item) => sum + item.cacheHits, 0);
  const totalBatches = stats.reduce((sum, item) => sum + item.batches, 0);
  const latest = latestSamples(samples);
  const avgCpu = latest.length ? latest.reduce((sum, row) => sum + num(row.sample?.cpu?.process_percent), 0) / latest.length : 0;
  const appRam = latest.reduce((sum, row) => sum + num(row.sample?.process?.working_set_bytes), 0);
  const edgeRam = latest.reduce((sum, row) => sum + num(row.sample?.edge?.working_set_bytes), 0);
  const avgLag = latest.length ? latest.reduce((sum, row) => sum + num(row.sample?.window?.event_loop_lag_ms), 0) / latest.length : 0;

  opsKpis.replaceChildren(
    kpi("AVG TASK", fmtDuration(durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0), `${durations.length} tasks`),
    kpi("P95 TASK", fmtDuration(percentile(durations, .95)), "最近任务耗时 P95"),
    kpi("AI CALLS", String(totalCalls), `${totalCache} cache hits`),
    kpi("AI CACHE", totalBatches ? percent((totalCache / totalBatches) * 100) : "—", `${totalCache} / ${totalBatches}`),
    kpi("CRASH", String(diagnostics.length), "已上传诊断报告"),
    kpi("APP RAM", fmtBytes(appRam), `${latest.length} active devices`),
    kpi("APP CPU", latest.length ? percent(avgCpu) : "—", "最新设备平均"),
    kpi("UI LAG", latest.length ? `${avgLag.toFixed(0)} ms` : "—", `Edge ${fmtBytes(edgeRam)}`)
  );
}

function render(snapshot) {
  renderKpis(snapshot);
  renderDeviceHealth(snapshot);
  renderTaskPerformance(snapshot);
  renderVersionHealth(snapshot);
  renderDiagnostics(snapshot);
  opsSection.hidden = false;
}

async function refresh() {
  if (!supabase || refreshing) return;
  refreshing = true;
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) return;
    const { data, error } = await supabase.functions.invoke("portal-usage-admin", { body: {} });
    if (error) throw error;
    render(data || {});
  } catch (error) {
    console.error("operations telemetry refresh failed", error);
  } finally {
    refreshing = false;
  }
}

async function init() {
  if (!opsSection || !auth.supabaseUrl || !auth.supabaseAnonKey) return;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(auth.supabaseUrl, auth.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  await refresh();
  timer = window.setInterval(() => void refresh(), 30_000);
}

window.addEventListener("pagehide", () => {
  if (timer) window.clearInterval(timer);
});

void init();
