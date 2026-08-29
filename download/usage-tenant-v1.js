const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const auth = config.auth ?? {};
const FUNCTION_NAME = "portal-usage-tenant";
const REFRESH_MS = 60_000;

let supabase = null;
let refreshTimer = null;
let refreshing = false;
let currentUsers = [];
let currentTasks = [];
let currentDiagnostics = [];
let currentSystemSamples = [];
let currentDailyActivity = [];
let currentRange = "24h";

const el = (id) => document.getElementById(id);
const generatedAt = el("generatedAt");
const refreshButton = el("refreshButton");
const statusPanel = el("statusPanel");
const windowText = el("windowText");
const tenantScopeName = el("tenantScopeName");
const summaryGrid = el("summaryGrid");
const activitySection = el("activitySection");
const accountsSection = el("accountsSection");
const opsSection = el("opsSection");
const taskAuditSection = el("taskAuditSection");
const diagnosticsSection = el("diagnosticsSection");
const usersPanel = el("usersPanel");
const taskAuditPanel = el("taskAuditPanel");
const diagnosticsPanel = el("diagnosticsPanel");
const auditSearch = el("auditSearch");
const auditFilter = el("auditFilter");

function n(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function shortId(value, size = 10) {
  const raw = text(value);
  return raw.length > size ? `${raw.slice(0, size)}…` : raw || "—";
}

function taskStatus(value) {
  const status = text(value).toLowerCase();
  if (["done", "success", "succeeded", "complete", "completed"].includes(status)) return "completed";
  if (["fail", "failed", "error"].includes(status)) return "failed";
  if (["review", "needs_review"].includes(status)) return "review";
  if (["ready"].includes(status)) return "ready";
  if (["cancelled", "canceled", "stopped"].includes(status)) return "cancelled";
  return status || "running";
}

function setStatus(message, state = "neutral") {
  statusPanel.textContent = message;
  statusPanel.dataset.state = state;
}

function setVisible(node, visible) {
  if (node) node.hidden = !visible;
}

function hideData() {
  [summaryGrid, activitySection, accountsSection, opsSection, taskAuditSection, diagnosticsSection].forEach((node) => setVisible(node, false));
}

function showData() {
  [summaryGrid, activitySection, accountsSection, opsSection, taskAuditSection].forEach((node) => setVisible(node, true));
  setVisible(diagnosticsSection, true);
}

function userName(userId) {
  const user = currentUsers.find((item) => text(item?.user_id) === text(userId));
  return text(user?.display_name) || text(user?.email) || shortId(userId);
}

function taskTimestamp(task) {
  return task?.completed_at || task?.updated_at || task?.started_at || task?.created_at;
}

function taskCounts(tasks) {
  const stats = { completed: 0, failed: 0, review: 0, running: 0, ready: 0, singleDone: 0, batchDone: 0 };
  for (const task of tasks) {
    const status = taskStatus(task?.status);
    if (status === "completed") stats.completed += 1;
    else if (status === "failed") stats.failed += 1;
    else if (status === "review") stats.review += 1;
    else if (status === "ready") stats.ready += 1;
    else stats.running += 1;
    if (status === "completed" && text(task?.task_kind).toLowerCase() === "single") stats.singleDone += 1;
    if (status === "completed" && text(task?.task_kind).toLowerCase() === "batch") stats.batchDone += 1;
  }
  return stats;
}

function renderSummary() {
  const users = currentUsers;
  const online = users.filter((user) => Boolean(user?.online)).length;
  const launches = users.reduce((sum, user) => sum + n(user?.launch_count), 0);
  const devices = users.reduce((sum, user) => sum + n(user?.active_devices), 0);
  const maxDevices = users.reduce((sum, user) => sum + n(user?.max_devices), 0);
  const stats = taskCounts(currentTasks);
  const decided = stats.completed + stats.failed;
  const rate = decided ? `${((stats.completed / decided) * 100).toFixed(1)}%` : "—";

  el("onlineCount").textContent = String(online);
  el("onlineRatio").textContent = users.length ? `${online} / ${users.length} 当前在线` : "当前在线";
  el("accountCount").textContent = String(users.length);
  el("launchCount").textContent = String(launches);
  el("activeDeviceCount").textContent = String(devices);
  el("deviceCapacityText").textContent = maxDevices ? `${devices} / ${maxDevices} 活跃设备` : "活跃设备";
  el("singleDoneCount").textContent = String(stats.singleDone);
  el("batchDoneCount").textContent = String(stats.batchDone);
  el("successRate").textContent = rate;
  el("successRateMeta").textContent = decided ? `${stats.completed} 成功 / ${stats.failed} 失败` : "暂无已结束任务";
  el("failureCount").textContent = String(stats.failed);
}

function aggregate24h() {
  const buckets = new Map();
  for (const user of currentUsers) {
    for (const row of Array.isArray(user?.activity_24h) ? user.activity_24h : []) {
      const key = text(row?.bucket_start);
      if (!key) continue;
      const entry = buckets.get(key) || { key, active: false, launches: 0, completed: 0, failed: 0 };
      entry.active ||= Boolean(row?.active);
      entry.launches += n(row?.launches);
      entry.completed += n(row?.completed);
      entry.failed += n(row?.failed);
      buckets.set(key, entry);
    }
  }
  return [...buckets.values()].sort((a, b) => Date.parse(a.key) - Date.parse(b.key)).slice(-24);
}

function dailyRange(days) {
  return currentDailyActivity.slice(-days).map((row) => ({
    key: text(row?.date),
    active: n(row?.tasks) > 0 || n(row?.launches) > 0 || n(row?.active_accounts) > 0,
    launches: n(row?.launches),
    completed: n(row?.success),
    failed: n(row?.failed),
    tasks: n(row?.tasks)
  }));
}

function renderActivity() {
  const rows = currentRange === "24h" ? aggregate24h() : dailyRange(currentRange === "7d" ? 7 : 30);
  const presenceRail = el("globalPresenceRail");
  const taskSpark = el("globalTaskSpark");
  const axis = el("globalPresenceAxis");
  const taskAxis = el("globalTaskAxis");
  const completed = rows.reduce((sum, row) => sum + n(row.completed), 0);
  const failed = rows.reduce((sum, row) => sum + n(row.failed), 0);
  const active = rows.filter((row) => row.active).length;
  const maxTasks = Math.max(1, ...rows.map((row) => n(row.completed) + n(row.failed)));

  presenceRail.replaceChildren(...rows.map((row) => {
    const node = document.createElement("span");
    node.className = `tenant-presence-cell${row.failed ? " is-failed" : row.active ? " is-active" : ""}`;
    node.title = `${row.key} · 完成 ${row.completed} · 失败 ${row.failed} · 启动 ${row.launches}`;
    return node;
  }));

  const barWrap = document.createElement("div");
  barWrap.className = "tenant-task-bars";
  for (const row of rows) {
    const bar = document.createElement("span");
    bar.className = `tenant-task-bar${row.failed ? " is-failed" : ""}`;
    const total = n(row.completed) + n(row.failed);
    bar.style.height = `${Math.max(total ? 8 : 2, Math.round((total / maxTasks) * 64))}px`;
    bar.title = `${row.key} · 完成 ${row.completed} · 失败 ${row.failed}`;
    barWrap.append(bar);
  }
  taskSpark.replaceChildren(barWrap);

  const label = currentRange === "24h" ? "24 小时" : currentRange === "7d" ? "7 天" : "30 天";
  el("activityKicker").textContent = `${currentRange.toUpperCase()} ACTIVITY`;
  el("activityMeta").textContent = `过去 ${label}当前组织内客户端活动与任务处理记录`;
  el("presenceSummary").textContent = `${active} / ${rows.length || 0} 个时间段有活动`;
  el("throughputSummary").textContent = `${completed} 完成 · ${failed} 失败`;
  axis.textContent = rows.length ? `${rows[0].key.slice(5)}  →  ${rows.at(-1).key.slice(5)}` : "—";
  taskAxis.textContent = axis.textContent;
}

function renderAccounts() {
  if (!currentUsers.length) {
    usersPanel.innerHTML = '<article class="account-card cards tenant-monitor-empty">当前组织暂无账户数据</article>';
    el("accountsHint").textContent = "0 个账户";
    return;
  }
  el("accountsHint").textContent = `${currentUsers.length} 个账户`;
  usersPanel.innerHTML = currentUsers.map((user) => {
    const online = Boolean(user?.online);
    const label = text(user?.display_name) || text(user?.email) || "Unnamed account";
    return `
      <article class="account-card cards">
        <div class="account-head">
          <div>
            <p class="kicker">${online ? "ONLINE" : "ACCOUNT"}</p>
            <h2>${escapeHtml(label)}</h2>
            <p class="usage-account-email">${escapeHtml(user?.email)}</p>
          </div>
          <span class="secure-pill">${online ? "在线" : "离线"}</span>
        </div>
        <div class="tenant-account-gridline">
          <div class="tenant-mini-stat"><span>APP VERSION</span><strong>${escapeHtml(user?.latest_app_version || "—")}</strong></div>
          <div class="tenant-mini-stat"><span>DEVICES</span><strong>${n(user?.active_devices)} / ${n(user?.max_devices) || "—"}</strong></div>
          <div class="tenant-mini-stat"><span>LAUNCHES</span><strong>${n(user?.launch_count)}</strong></div>
          <div class="tenant-mini-stat"><span>LAST SEEN</span><strong>${escapeHtml(formatTime(user?.last_seen_at))}</strong></div>
        </div>
        <div class="tenant-account-meta"><span>Single 完成 ${n(user?.listing_execute_completed)}</span><span>Batch 完成 ${n(user?.batch_execute_completed)}</span><span>失败 ${n(user?.listing_execute_failed) + n(user?.batch_execute_failed)}</span></div>
      </article>`;
  }).join("");
}

function versionCounts() {
  const counts = new Map();
  for (const user of currentUsers) {
    const version = text(user?.latest_app_version) || "Unknown";
    counts.set(version, (counts.get(version) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function renderOps() {
  const stats = taskCounts(currentTasks);
  const latestByDevice = new Map();
  for (const sample of currentSystemSamples) {
    const deviceId = text(sample?.device_id);
    if (!deviceId) continue;
    const current = latestByDevice.get(deviceId);
    if (!current || Date.parse(sample?.occurred_at || 0) > Date.parse(current?.occurred_at || 0)) latestByDevice.set(deviceId, sample);
  }
  const versions = versionCounts();
  const successBase = stats.completed + stats.failed;
  const successRate = successBase ? `${((stats.completed / successBase) * 100).toFixed(1)}%` : "—";
  const latestSample = [...currentSystemSamples].sort((a, b) => Date.parse(b?.occurred_at || 0) - Date.parse(a?.occurred_at || 0))[0];

  el("opsKpis").innerHTML = `
    <article class="utility-card cards usage-ops-kpi"><span class="utility-overline">REPORTING DEVICES</span><h3>${latestByDevice.size}</h3><p>24h 系统采样设备</p></article>
    <article class="utility-card cards usage-ops-kpi"><span class="utility-overline">TASK SUCCESS</span><h3>${successRate}</h3><p>最近任务记录</p></article>
    <article class="utility-card cards usage-ops-kpi"><span class="utility-overline">VERSIONS</span><h3>${versions.length}</h3><p>当前客户端版本</p></article>
    <article class="utility-card cards usage-ops-kpi"><span class="utility-overline">LAST SAMPLE</span><h3>${escapeHtml(latestSample ? formatTime(latestSample.occurred_at) : "—")}</h3><p>最近系统上报</p></article>`;

  el("deviceHealthPanel").innerHTML = `<div class="account-head"><div><p class="kicker">DEVICE HEALTH</p><h2>设备上报</h2></div><span class="secure-pill">${latestByDevice.size}</span></div><div class="tenant-ops-list">${[...latestByDevice.values()].slice(0, 8).map((sample) => `<div class="tenant-ops-row"><span>${escapeHtml(userName(sample?.user_id))} · ${escapeHtml(shortId(sample?.device_id))}</span><strong>${escapeHtml(formatTime(sample?.occurred_at))}</strong></div>`).join("") || '<div class="tenant-monitor-empty">暂无系统采样</div>'}</div>`;

  el("taskPerformancePanel").innerHTML = `<div class="account-head"><div><p class="kicker">TASK PERFORMANCE</p><h2>任务结果</h2></div><span class="secure-pill">${currentTasks.length}</span></div><div class="tenant-ops-list"><div class="tenant-ops-row"><span>完成</span><strong>${stats.completed}</strong></div><div class="tenant-ops-row"><span>失败</span><strong>${stats.failed}</strong></div><div class="tenant-ops-row"><span>复核</span><strong>${stats.review}</strong></div><div class="tenant-ops-row"><span>运行中 / Ready</span><strong>${stats.running + stats.ready}</strong></div></div>`;

  el("versionHealthPanel").innerHTML = `<div class="account-head"><div><p class="kicker">VERSION HEALTH</p><h2>版本分布</h2></div><span class="secure-pill">${versions.length}</span></div><div class="tenant-ops-list">${versions.slice(0, 8).map(([version, count]) => `<div class="tenant-ops-row"><span>${escapeHtml(version)}</span><strong>${count} 个账户</strong></div>`).join("") || '<div class="tenant-monitor-empty">暂无版本数据</div>'}</div>`;
}

function filteredTasks() {
  const query = text(auditSearch?.value).toLowerCase();
  const filter = text(auditFilter?.value) || "all";
  return currentTasks.filter((task) => {
    const status = taskStatus(task?.status);
    const kind = text(task?.task_kind).toLowerCase();
    if (filter === "single" || filter === "batch") {
      if (kind !== filter) return false;
    } else if (filter !== "all" && status !== filter) {
      return false;
    }
    if (!query) return true;
    const haystack = [userName(task?.user_id), task?.product_url, task?.id, task?.source_audit_id, task?.phase, task?.status, task?.device_id].map(text).join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

async function loadTaskDetail(details, task) {
  if (details.dataset.loaded === "true" || details.dataset.loading === "true") return;
  details.dataset.loading = "true";
  const pre = details.querySelector("pre");
  pre.textContent = "正在读取详情…";
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { scope: "task_detail", audit_id: task?.id, source_audit_id: task?.source_audit_id }
    });
    if (error || !data?.task_audit) throw new Error("detail_failed");
    pre.textContent = JSON.stringify(data.task_audit, null, 2);
    details.dataset.loaded = "true";
  } catch {
    pre.textContent = "详情读取失败。";
  } finally {
    details.dataset.loading = "false";
  }
}

function renderTasks() {
  const tasks = filteredTasks();
  el("auditHint").textContent = `${tasks.length} / ${currentTasks.length} 条`;
  if (!tasks.length) {
    taskAuditPanel.innerHTML = '<article class="account-card cards tenant-monitor-empty">当前筛选条件下暂无任务记录</article>';
    return;
  }
  taskAuditPanel.innerHTML = tasks.map((task, index) => {
    const status = taskStatus(task?.status);
    const title = text(task?.product_url) || `${text(task?.task_kind) || "Task"} · ${text(task?.phase) || "—"}`;
    return `<article class="account-card cards tenant-task-card" data-task-index="${index}">
      <div class="tenant-task-top"><div><p class="kicker">${escapeHtml(text(task?.task_kind).toUpperCase() || "TASK")}</p><h3 class="tenant-task-title">${escapeHtml(title)}</h3></div><span class="tenant-status-pill" data-status="${escapeHtml(status)}">${escapeHtml(status)}</span></div>
      <span class="tenant-task-url">${escapeHtml(task?.product_url || "无商品链接")}</span>
      <div class="tenant-task-meta"><span>${escapeHtml(userName(task?.user_id))}</span><span>${escapeHtml(formatDate(taskTimestamp(task)))}</span><span>${escapeHtml(task?.phase || "—")}</span><span>${escapeHtml(shortId(task?.device_id))}</span></div>
      <details class="tenant-task-detail" data-task-id="${escapeHtml(task?.id)}"><summary>查看任务详情</summary><pre>展开后读取</pre></details>
    </article>`;
  }).join("");

  const taskById = new Map(tasks.map((task) => [text(task?.id), task]));
  taskAuditPanel.querySelectorAll("details[data-task-id]").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      const task = taskById.get(details.dataset.taskId);
      if (task) void loadTaskDetail(details, task);
    });
  });
}

function renderDiagnostics() {
  el("diagnosticsHint").textContent = `${currentDiagnostics.length} 条`;
  if (!currentDiagnostics.length) {
    diagnosticsPanel.innerHTML = '<article class="account-card cards tenant-monitor-empty">当前组织暂无诊断记录</article>';
    return;
  }
  diagnosticsPanel.innerHTML = currentDiagnostics.slice(0, 100).map((report) => `
    <article class="account-card cards tenant-diagnostic-card">
      <div class="tenant-task-top"><div><p class="kicker">${escapeHtml(report?.report_code || "DIAGNOSTIC")}</p><h3 class="tenant-task-title">${escapeHtml(userName(report?.user_id))}</h3></div><span class="tenant-status-pill">${escapeHtml(report?.startup_stage || "record")}</span></div>
      <div class="tenant-diagnostic-meta"><span>${escapeHtml(formatDate(report?.created_at))}</span><span>App ${escapeHtml(report?.app_version || "—")}</span><span>Device ${escapeHtml(shortId(report?.device_id))}</span></div>
      <details class="tenant-task-detail"><summary>查看诊断内容</summary><pre>${escapeHtml(JSON.stringify(report?.report ?? {}, null, 2))}</pre></details>
    </article>`).join("");
}

function heatLevel(value, values) {
  if (!value) return 0;
  const max = Math.max(1, ...values);
  const ratio = value / max;
  if (ratio <= .25) return 1;
  if (ratio <= .5) return 2;
  if (ratio <= .75) return 3;
  return 4;
}

function renderHeatmap() {
  let card = el("tenantDailyHeatmap");
  if (!card) {
    card = document.createElement("article");
    card.id = "tenantDailyHeatmap";
    card.className = "account-card cards tenant-heatmap-card";
    activitySection.append(card);
  }
  if (!currentDailyActivity.length) {
    card.innerHTML = '<div class="account-head"><div><p class="kicker">365D DAILY ACTIVITY</p><h2>年度使用热力图</h2></div></div><div class="tenant-monitor-empty">暂无每日记录</div>';
    return;
  }
  const values = currentDailyActivity.map((day) => n(day?.tasks));
  const activeDays = currentDailyActivity.filter((day) => n(day?.tasks) || n(day?.launches)).length;
  const totalTasks = values.reduce((a, b) => a + b, 0);
  card.innerHTML = `<div class="account-head"><div><p class="kicker">365D DAILY ACTIVITY</p><h2>年度使用热力图</h2><p class="usage-account-email">${activeDays} 个活跃日 · ${totalTasks} 个商品任务</p></div><span class="secure-pill">UTC+8</span></div><div class="tenant-heatmap-scroll"><div class="tenant-heatmap-grid"></div></div>`;
  const grid = card.querySelector(".tenant-heatmap-grid");
  currentDailyActivity.forEach((day) => {
    const cell = document.createElement("span");
    const tasks = n(day?.tasks);
    cell.className = "tenant-heatmap-cell";
    cell.dataset.level = String(heatLevel(tasks, values));
    cell.dataset.failed = n(day?.failed) ? "true" : "false";
    cell.title = `${text(day?.date)} · 任务 ${tasks} · 成功 ${n(day?.success)} · 失败 ${n(day?.failed)} · 活跃账户 ${n(day?.active_accounts)}`;
    grid.append(cell);
  });
}

function renderAll() {
  renderSummary();
  renderActivity();
  renderAccounts();
  renderOps();
  renderTasks();
  renderDiagnostics();
  renderHeatmap();
}

async function getClient() {
  if (supabase) return supabase;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(auth.supabaseUrl, auth.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  return supabase;
}

async function invoke(scope) {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: { scope } });
  if (error) throw error;
  return data ?? {};
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  refreshButton.disabled = true;
  refreshButton.textContent = "读取中";
  try {
    if (!auth.supabaseUrl || !auth.supabaseAnonKey) {
      hideData();
      setStatus("监控配置缺失。", "error");
      return;
    }
    await getClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) {
      hideData();
      generatedAt.textContent = "—";
      tenantScopeName.textContent = "未登录";
      setStatus("当前没有登录。请先返回下载页登录后再打开组织监控。", "warn");
      return;
    }

    const [coreResult, opsResult, heatmapResult] = await Promise.allSettled([
      invoke("core"),
      invoke("ops"),
      invoke("heatmap")
    ]);
    if (coreResult.status !== "fulfilled") throw coreResult.reason;

    const core = coreResult.value;
    const ops = opsResult.status === "fulfilled" ? opsResult.value : {};
    const heatmap = heatmapResult.status === "fulfilled" ? heatmapResult.value : {};
    currentUsers = Array.isArray(core?.users) ? core.users : [];
    currentTasks = Array.isArray(ops?.task_audits) ? ops.task_audits : Array.isArray(core?.task_audits) ? core.task_audits : [];
    currentDiagnostics = Array.isArray(ops?.diagnostic_reports) ? ops.diagnostic_reports : [];
    currentSystemSamples = Array.isArray(ops?.system_samples) ? ops.system_samples : [];
    currentDailyActivity = Array.isArray(heatmap?.daily_activity?.days) ? heatmap.daily_activity.days : [];

    const tenant = core?.tenant ?? {};
    tenantScopeName.textContent = text(tenant?.name) || (core?.viewer_scope === "self" ? "个人工作区" : "当前组织");
    generatedAt.textContent = formatTime(core?.generated_at || new Date().toISOString());
    windowText.textContent = `在线判定 ${n(core?.online_window_seconds) || 150}s · 系统窗口 ${n(core?.system_window_hours) || 24}h`;
    showData();
    renderAll();

    const partialCount = [core, ops, heatmap].flatMap((payload) => Array.isArray(payload?.partial_errors) ? payload.partial_errors : []).length;
    setStatus(partialCount ? `组织数据已加载，${partialCount} 个次要数据源使用降级结果。` : "组织监控数据正常。", partialCount ? "warn" : "success");
  } catch (error) {
    hideData();
    const message = text(error?.message || error);
    if (message.includes("403") || message.includes("not_authorized")) {
      setStatus("当前账号没有该组织监控权限。", "warn");
    } else {
      setStatus("组织监控读取失败，请稍后重试。", "error");
    }
  } finally {
    refreshing = false;
    refreshButton.disabled = false;
    refreshButton.textContent = "刷新";
  }
}

refreshButton?.addEventListener("click", () => void refresh());
auditSearch?.addEventListener("input", renderTasks);
auditFilter?.addEventListener("change", renderTasks);
el("activityRangeControl")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-range]");
  if (!button) return;
  currentRange = button.dataset.range || "24h";
  el("activityRangeControl").querySelectorAll("button[data-range]").forEach((candidate) => candidate.setAttribute("aria-pressed", candidate === button ? "true" : "false"));
  renderActivity();
});

void refresh();
refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);
window.addEventListener("pagehide", () => {
  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = null;
});
