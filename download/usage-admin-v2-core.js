const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const auth = config.auth ?? {};

const statusPanel = document.getElementById("statusPanel");
const summaryGrid = document.getElementById("summaryGrid");
const activitySection = document.getElementById("activitySection");
const accountsSection = document.getElementById("accountsSection");
const usersPanel = document.getElementById("usersPanel");
const generatedAt = document.getElementById("generatedAt");
const refreshButton = document.getElementById("refreshButton");
const onlineCount = document.getElementById("onlineCount");
const onlineRatio = document.getElementById("onlineRatio");
const accountCount = document.getElementById("accountCount");
const windowText = document.getElementById("windowText");
const launchCount = document.getElementById("launchCount");
const activeDeviceCount = document.getElementById("activeDeviceCount");
const deviceCapacityText = document.getElementById("deviceCapacityText");
const singleDoneCount = document.getElementById("singleDoneCount");
const batchDoneCount = document.getElementById("batchDoneCount");
const successRate = document.getElementById("successRate");
const successRateMeta = document.getElementById("successRateMeta");
const failureCount = document.getElementById("failureCount");
const accountsHint = document.getElementById("accountsHint");
const activityMeta = document.getElementById("activityMeta");
const activityKicker = document.getElementById("activityKicker");
const activityRangeControl = document.getElementById("activityRangeControl");
const activityRangeButtons = Array.from(activityRangeControl?.querySelectorAll("[data-range]") || []);
const globalPresenceRail = document.getElementById("globalPresenceRail");
const globalPresenceAxis = document.getElementById("globalPresenceAxis");
const globalTaskSpark = document.getElementById("globalTaskSpark");
const globalTaskAxis = document.getElementById("globalTaskAxis");
const presenceSummary = document.getElementById("presenceSummary");
const throughputSummary = document.getElementById("throughputSummary");
const taskAuditSection = document.getElementById("taskAuditSection");
const taskAuditPanel = document.getElementById("taskAuditPanel");
const auditSearch = document.getElementById("auditSearch");
const auditFilter = document.getElementById("auditFilter");
const auditHint = document.getElementById("auditHint");

let supabase = null;
let refreshing = false;
let autoRefresh = null;
let currentAudits = [];
let currentUsers = [];
let currentAuditLimit = 0;
let currentSnapshot = null;
let currentActivityRange = "24h";
let dailyActivity = null;
let hasRenderedData = false;

function asNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date);
}

function formatHour(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatDay(value, detailed = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", detailed
    ? { month: "2-digit", day: "2-digit", weekday: "short", timeZone: "Asia/Shanghai" }
    : { month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai" }).format(date);
}

function formatBucket(value, granularity = "hour", detailed = false) {
  return granularity === "day" ? formatDay(value, detailed) : formatHour(value);
}

function formatDuration(startValue, endValue) {
  const start = Date.parse(startValue || "");
  const end = Date.parse(endValue || "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return `${minutes}m ${rest}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function setStatus(text, state = "neutral") {
  statusPanel.textContent = text;
  statusPanel.dataset.state = state;
}

function activityForUser(user) {
  if (!Array.isArray(user?.activity_24h)) return [];
  return user.activity_24h.map((bucket) => ({
    bucket_start: bucket?.bucket_start || null,
    active: Boolean(bucket?.active),
    launches: asNumber(bucket?.launches),
    completed: asNumber(bucket?.completed),
    failed: asNumber(bucket?.failed)
  }));
}

function activityTotals(buckets) {
  return buckets.reduce((acc, bucket) => {
    if (bucket.active) acc.activeHours += 1;
    acc.launches += asNumber(bucket.launches);
    acc.completed += asNumber(bucket.completed);
    acc.failed += asNumber(bucket.failed);
    return acc;
  }, { activeHours: 0, launches: 0, completed: 0, failed: 0 });
}

function aggregateActivity(users) {
  const histories = users.map(activityForUser);
  const bucketCount = histories.reduce((max, history) => Math.max(max, history.length), 0);
  const result = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const source = histories.find((history) => history[index]?.bucket_start)?.[index];
    const bucket = { bucket_start: source?.bucket_start || null, active_count: 0, launches: 0, completed: 0, failed: 0 };
    histories.forEach((history) => {
      const item = history[index];
      if (!item) return;
      if (item.active) bucket.active_count += 1;
      bucket.launches += asNumber(item.launches);
      bucket.completed += asNumber(item.completed);
      bucket.failed += asNumber(item.failed);
    });
    result.push(bucket);
  }
  return result;
}

function createStatusLine(label, value, state = "neutral") {
  const line = document.createElement("div");
  line.className = "account-status-line";
  const key = document.createElement("span");
  key.textContent = label;
  const data = document.createElement("strong");
  data.textContent = String(value ?? "—");
  data.dataset.state = state;
  line.append(key, data);
  return line;
}

function createMetaItem(label, value) {
  const item = document.createElement("div");
  item.className = "meta-item";
  const key = document.createElement("span");
  key.textContent = label;
  const data = document.createElement("strong");
  data.textContent = String(value ?? "—");
  item.append(key, data);
  return item;
}

function renderAxis(target, buckets, { granularity = "hour" } = {}) {
  target.replaceChildren();
  if (!buckets.length) return;
  const values = [buckets[0]?.bucket_start, buckets[Math.floor((buckets.length - 1) / 2)]?.bucket_start, buckets[buckets.length - 1]?.bucket_start];
  values.forEach((value) => {
    const label = document.createElement("span");
    label.textContent = formatBucket(value, granularity);
    target.append(label);
  });
}

function renderPresenceRail(target, buckets, { totalUsers = 1, global = false, granularity = "hour" } = {}) {
  target.style.gridTemplateColumns = `repeat(${Math.max(1, buckets.length)}, minmax(0, 1fr))`;
  const nodes = buckets.map((bucket, index) => {
    const activeCount = global ? asNumber(bucket.active_count) : (bucket.active ? 1 : 0);
    const active = activeCount > 0;
    const failed = asNumber(bucket.failed) > 0;
    const segment = document.createElement("span");
    segment.className = `usage-presence-segment ${failed ? "is-failed" : active ? "is-active" : "is-idle"}`;
    if (index === buckets.length - 1) segment.classList.add("is-current");
    if (global && active) {
      const ratio = totalUsers > 0 ? activeCount / totalUsers : 0;
      segment.style.setProperty("--presence-opacity", String(Math.max(.4, Math.min(1, ratio))));
    }
    const stateText = failed ? "有失败事件" : active ? (global ? `${activeCount} 个账号活跃` : "客户端活跃") : "无活动";
    segment.title = `${formatBucket(bucket.bucket_start, granularity, true)} · ${stateText} · 启动 ${asNumber(bucket.launches)} · 完成 ${asNumber(bucket.completed)} · 失败 ${asNumber(bucket.failed)}`;
    return segment;
  });
  target.replaceChildren(...nodes);
}

function renderThroughputChart(target, buckets, { granularity = "hour" } = {}) {
  target.style.gridTemplateColumns = `repeat(${Math.max(1, buckets.length)}, minmax(0, 1fr))`;
  const maxValue = Math.max(1, ...buckets.map((bucket) => asNumber(bucket.completed) + asNumber(bucket.failed)));
  const columns = buckets.map((bucket) => {
    const completed = asNumber(bucket.completed);
    const failed = asNumber(bucket.failed);
    const column = document.createElement("div");
    column.className = "usage-throughput-column";
    column.title = `${formatBucket(bucket.bucket_start, granularity, true)} · 完成 ${completed} · 失败 ${failed} · 启动 ${asNumber(bucket.launches)}`;
    if (completed > 0) {
      const success = document.createElement("span");
      success.className = "usage-throughput-completed";
      success.style.height = `${Math.max(4, (completed / maxValue) * 100)}%`;
      column.append(success);
    }
    if (failed > 0) {
      const failure = document.createElement("span");
      failure.className = "usage-throughput-failed";
      failure.style.height = `${Math.max(4, (failed / maxValue) * 100)}%`;
      column.append(failure);
    }
    return column;
  });
  target.replaceChildren(...columns);
}

function createAccountMonitor(user) {
  const buckets = activityForUser(user);
  const totals = activityTotals(buckets);
  const monitor = document.createElement("div");
  monitor.className = "usage-account-monitor";
  const head = document.createElement("div");
  head.className = "usage-account-monitor-head";
  const label = document.createElement("span");
  label.textContent = "24H CLIENT ACTIVITY";
  const summary = document.createElement("strong");
  summary.textContent = `${totals.activeHours}h 活跃 · ${totals.completed} 完成 · ${totals.failed} 失败`;
  head.append(label, summary);
  const rail = document.createElement("div");
  rail.className = "usage-presence-rail";
  rail.setAttribute("aria-label", `${user.display_name || user.email || "客户"} 过去24小时在线活动`);
  renderPresenceRail(rail, buckets);
  const chart = document.createElement("div");
  chart.className = "usage-throughput-chart usage-account-throughput";
  chart.setAttribute("aria-label", `${user.display_name || user.email || "客户"} 过去24小时任务执行`);
  renderThroughputChart(chart, buckets);
  const axis = document.createElement("div");
  axis.className = "usage-monitor-axis";
  renderAxis(axis, buckets);
  monitor.append(head, rail, chart, axis);
  return monitor;
}

function auditStats(audits) {
  return audits.reduce((acc, audit) => {
    const status = String(audit?.status || "").toLowerCase();
    const kind = String(audit?.task_kind || "").toLowerCase();
    if (status === "completed" || status === "ready") acc.success += 1;
    if (status === "failed" || status === "cancelled") acc.failed += 1;
    if (kind === "single" && status === "completed") acc.singleCompleted += 1;
    if (kind === "batch" && status === "completed") acc.batchCompleted += 1;
    if (kind === "batch" && status === "ready") acc.batchReady += 1;
    if (kind === "batch" && status === "review") acc.batchReview += 1;
    if (kind === "batch" && (status === "failed" || status === "cancelled")) acc.batchFailed += 1;
    return acc;
  }, { success: 0, failed: 0, singleCompleted: 0, batchCompleted: 0, batchReady: 0, batchReview: 0, batchFailed: 0 });
}

function userAuditStats(userId) {
  return auditStats(currentAudits.filter((audit) => String(audit?.user_id || "") === String(userId || "")));
}

function renderUser(user) {
  const card = document.createElement("article");
  card.className = "account-card cards usage-account-card";
  const stats = userAuditStats(user.user_id);
  const attempts = stats.success + stats.failed;
  const success = attempts ? `${((stats.success / attempts) * 100).toFixed(1)}%` : "—";
  const head = document.createElement("div");
  head.className = "account-head";
  const identity = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "ACCOUNT";
  const name = document.createElement("h2");
  name.textContent = user.display_name || user.email || "Unnamed user";
  const email = document.createElement("p");
  email.className = "usage-account-email";
  email.textContent = user.email || "—";
  identity.append(kicker, name, email);
  const presence = document.createElement("span");
  presence.className = "secure-pill";
  presence.textContent = user.online ? "ONLINE" : "OFFLINE";
  head.append(identity, presence);
  const statePanel = document.createElement("div");
  statePanel.className = "account-status-panel";
  statePanel.append(
    createStatusLine("运行状态", user.online ? "在线" : "离线", user.online ? "ok" : "neutral"),
    createStatusLine("客户端版本", user.latest_app_version || "—"),
    createStatusLine("最后活跃", formatTime(user.last_seen_at)),
    createStatusLine("最近商品任务成功率", success, attempts ? (stats.failed ? "warn" : "ok") : "neutral")
  );
  const metrics = document.createElement("div");
  metrics.className = "release-meta usage-account-metrics";
  metrics.append(
    createMetaItem("程序启动", asNumber(user.launch_count)),
    createMetaItem("单商品完成", stats.singleCompleted),
    createMetaItem("批量商品完成", stats.batchCompleted),
    createMetaItem("批量商品 READY", stats.batchReady),
    createMetaItem("批量商品 复核/失败", `${stats.batchReview} / ${stats.batchFailed}`),
    createMetaItem("授权设备", `${asNumber(user.active_devices)} / ${asNumber(user.max_devices)}`)
  );
  const footer = document.createElement("div");
  footer.className = "account-footer";
  const telemetry = document.createElement("span");
  telemetry.textContent = "Usage telemetry · per supplier link";
  const authorization = document.createElement("span");
  authorization.textContent = user.enabled ? "AUTHORIZED" : "DISABLED";
  footer.append(telemetry, authorization);
  card.append(head, createAccountMonitor(user), statePanel, metrics, footer);
  return card;
}

function renderGlobalActivity(snapshot, users) {
  const buckets = aggregateActivity(users);
  const hours = asNumber(snapshot?.activity_window_hours) || buckets.length || 24;
  const activeUserCount = users.filter((user) => activityForUser(user).some((bucket) => bucket.active)).length;
  const totals = buckets.reduce((acc, bucket) => {
    acc.launches += asNumber(bucket.launches);
    acc.completed += asNumber(bucket.completed);
    acc.failed += asNumber(bucket.failed);
    if (asNumber(bucket.active_count) > 0) acc.activeHours += 1;
    acc.peakOnline = Math.max(acc.peakOnline, asNumber(bucket.active_count));
    return acc;
  }, { launches: 0, completed: 0, failed: 0, activeHours: 0, peakOnline: 0 });
  activityKicker.textContent = `${hours}H ACTIVITY`;
  activityMeta.textContent = `${activeUserCount} 个账号在过去 ${hours} 小时出现真实心跳 · ${totals.launches} 次客户端启动`;
  presenceSummary.textContent = `${totals.activeHours}/${hours} 小时有活动 · 峰值 ${totals.peakOnline} 在线`;
  throughputSummary.textContent = `${totals.completed} 批次/单任务事件完成 · ${totals.failed} 失败`;
  renderPresenceRail(globalPresenceRail, buckets, { totalUsers: users.length, global: true });
  renderAxis(globalPresenceAxis, buckets);
  renderThroughputChart(globalTaskSpark, buckets);
  renderAxis(globalTaskAxis, buckets);
  globalPresenceRail.setAttribute("aria-label", `过去${hours}小时活动覆盖`);
  globalTaskSpark.setAttribute("aria-label", `过去${hours}小时任务处理`);
  activitySection.hidden = false;
}

function dailyBucketsForRange(payload, days) {
  const source = Array.isArray(payload?.days) ? payload.days.slice(-days) : [];
  return source.map((day) => ({
    bucket_start: `${String(day?.date || "")}T00:00:00+08:00`,
    active_count: asNumber(day?.active_accounts),
    launches: asNumber(day?.launches),
    completed: asNumber(day?.success),
    failed: asNumber(day?.failed),
    review: asNumber(day?.review),
    running: asNumber(day?.running),
    tasks: asNumber(day?.tasks)
  }));
}

function renderDailyActivity(payload, days) {
  const buckets = dailyBucketsForRange(payload, days);
  if (!buckets.length) {
    activityKicker.textContent = `${days}D ACTIVITY`;
    activityMeta.textContent = `正在读取过去 ${days} 天的每日汇总…`;
    presenceSummary.textContent = "—";
    throughputSummary.textContent = "—";
    globalPresenceRail.replaceChildren();
    globalPresenceAxis.replaceChildren();
    globalTaskSpark.replaceChildren();
    globalTaskAxis.replaceChildren();
    return;
  }

  const totals = buckets.reduce((acc, bucket) => {
    acc.tasks += asNumber(bucket.tasks);
    acc.completed += asNumber(bucket.completed);
    acc.failed += asNumber(bucket.failed);
    acc.review += asNumber(bucket.review);
    acc.launches += asNumber(bucket.launches);
    if (asNumber(bucket.active_count) > 0 || asNumber(bucket.launches) > 0 || asNumber(bucket.tasks) > 0) acc.activeDays += 1;
    acc.peakAccounts = Math.max(acc.peakAccounts, asNumber(bucket.active_count));
    return acc;
  }, { tasks: 0, completed: 0, failed: 0, review: 0, launches: 0, activeDays: 0, peakAccounts: 0 });

  activityKicker.textContent = `${days}D ACTIVITY`;
  activityMeta.textContent = `过去 ${days} 天 · ${totals.activeDays} 个活跃日 · ${totals.launches} 次客户端启动`;
  presenceSummary.textContent = `${totals.activeDays}/${days} 天有活动 · 单日峰值 ${totals.peakAccounts} 个账号`;
  throughputSummary.textContent = `${totals.tasks} 个任务 · ${totals.completed} 成功 · ${totals.failed} 失败${totals.review ? ` · ${totals.review} 复核` : ""}`;
  renderPresenceRail(globalPresenceRail, buckets, { totalUsers: Math.max(1, totals.peakAccounts), global: true, granularity: "day" });
  renderAxis(globalPresenceAxis, buckets, { granularity: "day" });
  renderThroughputChart(globalTaskSpark, buckets, { granularity: "day" });
  renderAxis(globalTaskAxis, buckets, { granularity: "day" });
  globalPresenceRail.setAttribute("aria-label", `过去${days}天每日活动覆盖`);
  globalTaskSpark.setAttribute("aria-label", `过去${days}天每日任务处理`);
  activitySection.hidden = false;
}

function updateActivityRangeControl() {
  activityRangeButtons.forEach((button) => {
    const selected = button.dataset.range === currentActivityRange;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function renderSelectedActivity() {
  updateActivityRangeControl();
  if (currentActivityRange === "24h") {
    if (currentSnapshot) renderGlobalActivity(currentSnapshot, currentUsers);
    return;
  }
  renderDailyActivity(dailyActivity, currentActivityRange === "7d" ? 7 : 30);
}

activityRangeControl?.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("[data-range]") : null;
  const range = button?.dataset.range;
  if (range !== "24h" && range !== "7d" && range !== "30d") return;
  currentActivityRange = range;
  renderSelectedActivity();
});

window.addEventListener("usage:daily-activity", (event) => {
  dailyActivity = event instanceof CustomEvent ? event.detail : null;
  if (currentActivityRange !== "24h") renderSelectedActivity();
});

function auditUser(audit, usersById) {
  return usersById.get(String(audit?.user_id || "")) || null;
}

function auditStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  return ({ running: "RUNNING", completed: "COMPLETED", failed: "FAILED", cancelled: "CANCELLED", review: "REVIEW", ready: "READY" })[normalized] || normalized.toUpperCase() || "UNKNOWN";
}

function auditStatusState(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed" || normalized === "ready") return "ok";
  if (normalized === "failed" || normalized === "cancelled") return "warn";
  return "neutral";
}

function urlTitle(url) {
  const value = String(url || "").trim();
  if (!value) return "Listing";
  try {
    const parsed = new URL(value);
    const tail = parsed.pathname.split("/").filter(Boolean).slice(-2).join("/");
    return `${parsed.hostname}${tail ? ` · ${tail}` : ""}`;
  } catch {
    return value.slice(0, 90);
  }
}

function auditTitle(audit) {
  const input = audit?.input_data || {};
  const result = audit?.result_data || {};
  const url = audit?.product_url || input.supplier_url || result.product_url || "";
  if (audit?.task_kind === "batch") {
    const index = asNumber(input.batch_index || result.batch_index);
    const size = asNumber(input.batch_size || result.batch_size);
    const prefix = index && size ? `Batch ${index}/${size}` : "Batch link";
    return `${prefix} · ${urlTitle(url)}`;
  }
  return urlTitle(url || "Single Listing");
}

function createAuditTextBlock(label, value) {
  const block = document.createElement("div");
  block.className = "usage-audit-copy";
  const title = document.createElement("span");
  title.textContent = label;
  const text = document.createElement("p");
  text.textContent = String(value || "—");
  block.append(title, text);
  return block;
}

function createAuditSection(titleText) {
  const section = document.createElement("section");
  section.className = "usage-audit-detail-section";
  const title = document.createElement("div");
  title.className = "usage-audit-detail-title";
  title.textContent = titleText;
  section.append(title);
  return section;
}

function createFileList(files, emptyText = "未采集到文件元数据") {
  const wrap = document.createElement("div");
  wrap.className = "usage-audit-file-list";
  const items = Array.isArray(files) ? files : [];
  if (!items.length) {
    const empty = document.createElement("span");
    empty.className = "usage-audit-empty-inline";
    empty.textContent = emptyText;
    wrap.append(empty);
    return wrap;
  }
  items.forEach((file) => {
    const chip = document.createElement("span");
    chip.className = "secure-pill usage-audit-file-chip";
    const size = asNumber(file?.size_bytes);
    const hasSize = Number.isFinite(Number(file?.size_bytes)) && Number(file?.size_bytes) > 0;
    const sizeText = hasSize
      ? (size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : size >= 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`)
      : "大小未采集";
    chip.textContent = `${file?.name || "file"} · ${sizeText}`;
    wrap.append(chip);
  });
  return wrap;
}

function optionalNumber(source, key) {
  if (!source || typeof source !== "object" || !Object.prototype.hasOwnProperty.call(source, key)) return null;
  const parsed = Number(source[key]);
  return Number.isFinite(parsed) ? parsed : null;
}

function basenameFromPath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.split(/[\\/]/).filter(Boolean).pop() || "";
}

function materialUsageEvidence(audit, input, result) {
  const selectedFiles = Array.isArray(input?.customer_files) ? input.customer_files : [];
  const executorReport = result?.executor_report && typeof result.executor_report === "object" ? result.executor_report : {};
  const photoUpload = executorReport?.photo_upload && typeof executorReport.photo_upload === "object" ? executorReport.photo_upload : null;
  const reportItems = Array.isArray(photoUpload?.items) ? photoUpload.items : [];
  const reportFiles = reportItems.map((item) => ({
    name: String(item?.name || basenameFromPath(item?.path) || `image-${asNumber(item?.index) || "?"}`),
    extension: String(item?.extension || ""),
    size_bytes: Number.isFinite(Number(item?.size_bytes)) ? Number(item.size_bytes) : 0
  }));
  const files = selectedFiles.length ? selectedFiles : reportFiles;

  const requested = optionalNumber(photoUpload, "requested");
  const attempted = optionalNumber(photoUpload, "attempted");
  const staged = optionalNumber(photoUpload, "staged");
  const persisted = optionalNumber(photoUpload, "persisted");
  const finalCount = optionalNumber(photoUpload, "final_count");
  const alreadyPersisted = optionalNumber(photoUpload, "already_persisted");
  const hasExecutionEvidence = Boolean(photoUpload && Object.keys(photoUpload).length);
  const confirmedSaved = Math.max(persisted ?? 0, finalCount ?? 0, alreadyPersisted ?? 0);
  const detected = Math.max(requested ?? 0, attempted ?? 0, staged ?? 0, reportItems.length, selectedFiles.length);
  const legacyBatch = input?.audit_scope === "batch_link_legacy" || Boolean(audit?._legacy_parent_audit_id);

  let label = "未采集到资料状态（不能判定客户未上传）";
  let state = "neutral";
  if (confirmedSaved > 0) {
    const target = Math.max(requested ?? 0, attempted ?? 0, confirmedSaved);
    label = `已实际使用并保存 ${confirmedSaved}${target ? ` / ${target}` : ""} 张商品图片`;
    state = "ok";
  } else if (detected > 0) {
    label = hasExecutionEvidence
      ? `已检测到 ${detected} 张商品图片，尚未确认持久化结果`
      : `已采集 ${selectedFiles.length} 个客户资料文件`;
    state = "ok";
  } else if (hasExecutionEvidence && requested === 0 && attempted === 0 && !legacyBatch) {
    label = "执行报告确认本次没有使用商品图片";
  }

  return {
    files, label, state, selectedCount: selectedFiles.length, hasExecutionEvidence, requested, attempted, persisted, finalCount, confirmedSaved,
    emptyText: hasExecutionEvidence ? "执行报告没有可展示的文件名元数据" : "未采集到文件元数据（不等于客户未上传）"
  };
}

function appendMaterialEvidence(section, audit, input, result) {
  const evidence = materialUsageEvidence(audit, input, result);
  const panel = document.createElement("div");
  panel.className = "account-status-panel usage-audit-status-panel";
  const selectedText = evidence.selectedCount > 0 ? `${evidence.selectedCount} 个文件` : "未采集到可靠选择记录";
  const executionText = evidence.hasExecutionEvidence
    ? `${evidence.attempted ?? evidence.requested ?? 0} 尝试 · ${evidence.confirmedSaved} 已保存`
    : "未采集到执行侧图片证据";
  panel.append(
    createStatusLine("资料判定", evidence.label, evidence.state),
    createStatusLine("GUI 选择记录", selectedText),
    createStatusLine("执行侧图片", executionText, evidence.confirmedSaved > 0 ? "ok" : "neutral")
  );
  section.append(panel, createFileList(evidence.files, evidence.emptyText));
  return evidence;
}

function createAuditTable(headers, rows) {
  const scroller = document.createElement("div");
  scroller.className = "usage-audit-table-scroll";
  const table = document.createElement("table");
  table.className = "usage-audit-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = String(value ?? "—");
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(thead, tbody);
  scroller.append(table);
  return scroller;
}

function createRawAudit(audit) {
  const details = document.createElement("details");
  details.className = "usage-audit-raw";
  const summary = document.createElement("summary");
  summary.textContent = "查看完整原始审计 JSON";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(audit, null, 2);
  details.append(summary, pre);
  return details;
}

function createDiagnosticDetails(label, value, { json = false } = {}) {
  const details = document.createElement("details");
  details.className = "usage-audit-raw";
  const summary = document.createElement("summary");
  summary.textContent = label;
  const pre = document.createElement("pre");
  pre.textContent = json ? JSON.stringify(value ?? {}, null, 2) : String(value || "—");
  details.append(summary, pre);
  return details;
}

function createFailureDiagnosticSection(diagnostic, label = "运行故障诊断") {
  const section = createAuditSection(label);
  const panel = document.createElement("div");
  panel.className = "account-status-panel usage-audit-status-panel";
  const activeStages = Array.isArray(diagnostic?.active_stages) ? diagnostic.active_stages.join(" → ") : "";
  panel.append(
    createStatusLine("失败阶段", diagnostic?.failed_stage || "—", "warn"),
    createStatusLine("异常类型", diagnostic?.error_type || "—", "warn"),
    createStatusLine("UI Phase", diagnostic?.ui_phase || "—"),
    createStatusLine("Workflow", diagnostic?.workflow_mode || "—"),
    createStatusLine("Run ID", diagnostic?.run_id || "—"),
    createStatusLine("失败耗时", diagnostic?.elapsed_seconds ? `${asNumber(diagnostic.elapsed_seconds).toFixed(3)}s` : "—"),
    createStatusLine("Active Stages", activeStages || "—"),
    createStatusLine("结构化现场", diagnostic?.diagnostic_source_available ? "AVAILABLE" : "FALLBACK", diagnostic?.diagnostic_source_available ? "ok" : "warn")
  );
  section.append(panel, createAuditTextBlock("错误信息", diagnostic?.error_message || "—"));
  const stages = Array.isArray(diagnostic?.stage_summary) ? diagnostic.stage_summary : [];
  if (stages.length) {
    section.append(createAuditTable(
      ["Stage", "Event", "UI Phase", "Elapsed", "Detail"],
      stages.map((item) => [item?.stage || "—", item?.event || "—", item?.ui_phase || "—", asNumber(item?.elapsed_seconds) ? `${asNumber(item.elapsed_seconds).toFixed(3)}s` : "—", item?.detail || "—"])
    ));
  }
  if (diagnostic?.traceback) section.append(createDiagnosticDetails("查看完整 Traceback", diagnostic.traceback));
  if (Array.isArray(diagnostic?.timeline) && diagnostic.timeline.length) section.append(createDiagnosticDetails(`查看 WORKFLOW_DIAG 时间线 · ${diagnostic.timeline.length} events`, diagnostic.timeline, { json: true }));
  if (diagnostic?.failed_event && typeof diagnostic.failed_event === "object") section.append(createDiagnosticDetails("查看 FAILED Event", diagnostic.failed_event, { json: true }));
  if (diagnostic?.manifest && typeof diagnostic.manifest === "object" && Object.keys(diagnostic.manifest).length) section.append(createDiagnosticDetails("查看 Run Manifest", diagnostic.manifest, { json: true }));
  return section;
}

function appendFieldsAndCandidates(section, result) {
  const fields = Array.isArray(result?.fields) ? result.fields : [];
  if (fields.length) {
    const fieldsSection = createAuditSection(`AI / Fill Plan 字段 · ${fields.length}`);
    fieldsSection.append(createAuditTable(
      ["字段", "AI结果", "AI状态", "最终状态", "Blocked reason", "来源"],
      fields.map((field) => [field?.field_name || field?.field_id || "—", field?.ai_result || "—", field?.ai_status || "—", field?.final_status || "—", field?.blocked_reason || "—", field?.source || "—"])
    ));
    section.append(fieldsSection);
  }
  const candidates = Array.isArray(result?.web_candidates) ? result.web_candidates : [];
  if (candidates.length) {
    const webSection = createAuditSection(`Web Candidates · ${candidates.length}`);
    webSection.append(createAuditTable(
      ["Match", "Title", "URL", "Reason"],
      candidates.map((item) => [item?.match || "—", item?.title || "—", item?.url || "—", item?.reason || "—"])
    ));
    section.append(webSection);
  }
}

function renderTaskAudit(audit, usersById) {
  const user = auditUser(audit, usersById);
  const input = audit?.input_data && typeof audit.input_data === "object" ? audit.input_data : {};
  const result = audit?.result_data && typeof audit.result_data === "object" ? audit.result_data : {};
  const card = document.createElement("details");
  card.className = "account-card cards usage-task-card";
  card.dataset.auditId = String(audit?.id || "");
  card.dataset.sourceAuditId = String(audit?.source_audit_id || audit?.id || "").split(":")[0];
  card.dataset.hydrated = audit?.summary_only ? "false" : "true";

  const summary = document.createElement("summary");
  summary.className = "usage-task-summary";
  const identity = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  const scope = audit?.task_kind === "batch" ? `BATCH LINK${input.job_id || result.job_id ? ` · ${input.job_id || result.job_id}` : ""}` : "SINGLE";
  kicker.textContent = `${scope} · ${String(audit?.phase || "—").toUpperCase()}`;
  const title = document.createElement("h2");
  title.textContent = auditTitle(audit);
  const sub = document.createElement("p");
  sub.className = "usage-account-email";
  sub.textContent = `${user?.display_name || user?.email || audit?.user_id || "未知账号"} · ${formatTime(audit?.updated_at)}`;
  identity.append(kicker, title, sub);
  const pill = document.createElement("span");
  pill.className = "secure-pill usage-task-status";
  pill.dataset.state = auditStatusState(audit?.status);
  pill.textContent = auditStatusLabel(audit?.status);
  summary.append(identity, pill);
  card.append(summary);

  const body = document.createElement("div");
  body.className = "usage-task-body";
  const metrics = document.createElement("div");
  metrics.className = "release-meta usage-task-metrics";
  metrics.append(
    createMetaItem("账号", user?.email || audit?.user_id || "—"),
    createMetaItem("客户端版本", audit?.app_version || "—"),
    createMetaItem("设备", String(audit?.device_id || "—").slice(0, 16)),
    createMetaItem("开始", formatTime(audit?.started_at)),
    createMetaItem("完成", formatTime(audit?.completed_at)),
    createMetaItem("耗时", formatDuration(audit?.started_at, audit?.completed_at))
  );
  body.append(metrics);

  if (audit?.summary_only) {
    const loadingNote = document.createElement("div");
    loadingNote.className = "usage-empty";
    loadingNote.textContent = "打开详情时读取这一条完整任务审计";
    body.append(loadingNote);
    card.append(body);
    return card;
  }

  const inputSection = createAuditSection("客户输入");
  const inputPanel = document.createElement("div");
  inputPanel.className = "account-status-panel usage-audit-status-panel";
  if (audit?.task_kind === "batch") {
    inputPanel.append(
      createStatusLine("Supplier URL", input.supplier_url || audit?.product_url || "—"),
      createStatusLine("Batch ID", input.batch_id || result.batch_id || "—"),
      createStatusLine("Job ID", input.job_id || result.job_id || "—"),
      createStatusLine("链接位置", `${asNumber(input.batch_index || result.batch_index) || "—"} / ${asNumber(input.batch_size || result.batch_size) || "—"}`),
      createStatusLine("销售规格 / 套装", input.listing_intent || "—")
    );
    inputSection.append(inputPanel);
  } else {
    inputPanel.append(
      createStatusLine("Supplier URL", input.supplier_url || audit?.product_url || "—"),
      createStatusLine("销售规格 / 套装", input.listing_intent || "—"),
      createStatusLine("指定 Vertical", input.requested_vertical || "自动"),
      createStatusLine("执行范围", input.execution_scope || "—")
    );
    inputSection.append(inputPanel, createAuditTextBlock("AI 引导", input.ai_guidance || "—"), createAuditTextBlock("Model Name 流量词", input.model_name_keywords || "—"));
  }
  const materialBlock = createAuditSection("客户资料与实际图片");
  const materialEvidence = appendMaterialEvidence(materialBlock, audit, input, result);
  inputSection.append(materialBlock);
  body.append(inputSection);

  const resultSection = createAuditSection("任务结果");
  const resultPanel = document.createElement("div");
  resultPanel.className = "account-status-panel usage-audit-status-panel";
  if (audit?.task_kind === "batch") {
    resultPanel.append(
      createStatusLine("Job 状态", result.job_status || audit?.status || "—", auditStatusState(audit?.status)),
      createStatusLine("进度", `${asNumber(result.progress)}%`),
      createStatusLine("商品", result.product_name || "—"),
      createStatusLine("Vertical", result.vertical || "—"),
      createStatusLine("Brand", result.brand || "—"),
      createStatusLine("READY / BLOCKED", `${asNumber(result.ready)} / ${asNumber(result.blocked)}`),
      createStatusLine("MISSING / CONFLICT", `${asNumber(result.missing)} / ${asNumber(result.conflict)}`),
      createStatusLine("Required blocked", asNumber(result.required_blocked)),
      createStatusLine("实际图片", materialEvidence.label, materialEvidence.state),
      createStatusLine("Makro target", result.makro_target_id || "—"),
      createStatusLine("Run ID", result.run_id || "—"),
      createStatusLine("当前阶段", result.stage_detail || "—")
    );
  } else {
    resultPanel.append(
      createStatusLine("Workflow", result.workflow_status || audit?.status || "—", auditStatusState(audit?.status)),
      createStatusLine("Vertical", result.vertical || "—"),
      createStatusLine("Brand", result.brand || "—"),
      createStatusLine("READY / BLOCKED", `${asNumber(result.ready)} / ${asNumber(result.blocked)}`),
      createStatusLine("MISSING / CONFLICT", `${asNumber(result.missing)} / ${asNumber(result.conflict)}`),
      createStatusLine("Live Fields", asNumber(result.live_field_count)),
      createStatusLine("实际图片", materialEvidence.label, materialEvidence.state)
    );
  }
  resultSection.append(resultPanel);
  if (result?.error || audit?.error_text) resultSection.append(createAuditTextBlock("错误 / Review reason", result?.error || audit?.error_text));
  appendFieldsAndCandidates(resultSection, result);
  if (result?.executor_report && typeof result.executor_report === "object") {
    resultSection.append(createDiagnosticDetails("查看 Executor Report", result.executor_report, { json: true }));
  }
  body.append(resultSection);

  if (result?.failure_diagnostic && typeof result.failure_diagnostic === "object") {
    body.append(createFailureDiagnosticSection(result.failure_diagnostic));
  }
  body.append(createRawAudit(audit));
  card.append(body);
  return card;
}

async function hydrateTaskAuditCard(card) {
  if (!(card instanceof HTMLDetailsElement) || !card.matches(".usage-task-card")) return card;
  if (card.dataset.hydrated === "true") return card;
  if (!supabase) throw new Error("usage_client_unavailable");

  const auditId = String(card.dataset.auditId || "");
  const sourceAuditId = String(card.dataset.sourceAuditId || auditId).split(":")[0];
  if (!sourceAuditId) throw new Error("task_audit_id_missing");
  if (card.dataset.loading === "true") return card;

  card.dataset.loading = "true";
  try {
    const { data, error } = await supabase.functions.invoke("portal-usage-admin", {
      body: { scope: "task_detail", audit_id: auditId, source_audit_id: sourceAuditId }
    });
    if (error || !data?.task_audit) throw error || new Error("task_detail_missing");

    const usersById = new Map(currentUsers.map((user) => [String(user.user_id || ""), user]));
    const hydrated = renderTaskAudit(data.task_audit, usersById);
    const hydratedBody = hydrated.querySelector(":scope > .usage-task-body");
    const currentBody = card.querySelector(":scope > .usage-task-body");
    if (!hydratedBody || !currentBody) throw new Error("task_detail_render_failed");
    currentBody.replaceWith(hydratedBody);
    card.dataset.hydrated = "true";
    return card;
  } finally {
    card.dataset.loading = "false";
  }
}

window.UsageMonitorTaskDetail = Object.freeze({ hydrate: hydrateTaskAuditCard });

function auditMatches(audit, usersById) {
  const filter = String(auditFilter?.value || "all");
  const status = String(audit?.status || "").toLowerCase();
  const kind = String(audit?.task_kind || "").toLowerCase();
  if (filter !== "all" && filter !== kind && filter !== status) return false;
  const query = String(auditSearch?.value || "").trim().toLowerCase();
  if (!query) return true;
  const user = auditUser(audit, usersById);
  const haystack = [user?.email, user?.display_name, audit?.product_url, audit?.app_version, audit?.phase, audit?.status].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function renderTaskAudits() {
  const usersById = new Map(currentUsers.map((user) => [String(user.user_id || ""), user]));
  const visible = currentAudits.filter((audit) => auditMatches(audit, usersById));
  taskAuditPanel.replaceChildren(...(visible.length ? visible.map((audit) => renderTaskAudit(audit, usersById)) : [renderAuditEmptyNode()]));
  const suffix = currentAuditLimit ? ` · 最近最多 ${currentAuditLimit} 条轻量摘要` : "";
  auditHint.textContent = `${visible.length} / ${currentAudits.length} 个商品任务${suffix}`;
  taskAuditSection.hidden = false;
}

function renderSnapshot(snapshot) {
  const users = Array.isArray(snapshot?.users) ? snapshot.users : [];
  currentSnapshot = snapshot;
  currentUsers = users;
  currentAudits = Array.isArray(snapshot?.task_audits) ? snapshot.task_audits : [];
  currentAuditLimit = asNumber(snapshot?.task_audit_limit);
  usersPanel.replaceChildren(...(users.length ? users.map(renderUser) : [renderEmptyNode()]));

  const totalOnline = users.filter((user) => Boolean(user.online)).length;
  const launches = users.reduce((sum, user) => sum + asNumber(user.launch_count), 0);
  const activeDevices = users.reduce((sum, user) => sum + asNumber(user.active_devices), 0);
  const maxDevices = users.reduce((sum, user) => sum + asNumber(user.max_devices), 0);
  const stats = auditStats(currentAudits);
  const attempts = stats.success + stats.failed;
  const globalSuccess = attempts ? `${((stats.success / attempts) * 100).toFixed(1)}%` : "—";

  onlineCount.textContent = String(totalOnline);
  onlineRatio.textContent = users.length ? `${totalOnline} / ${users.length} 个账号在线` : "暂无账号";
  accountCount.textContent = String(users.length);
  launchCount.textContent = String(launches);
  activeDeviceCount.textContent = String(activeDevices);
  deviceCapacityText.textContent = `${activeDevices} / ${maxDevices || 0} 已授权容量`;
  singleDoneCount.textContent = String(stats.singleCompleted);
  batchDoneCount.textContent = String(stats.batchCompleted);
  successRate.textContent = globalSuccess;
  successRateMeta.textContent = attempts ? `${stats.success} 商品任务成功 · ${stats.failed} 失败` : "暂无商品任务";
  failureCount.textContent = String(stats.failed);

  const onlineWindow = asNumber(snapshot?.online_window_seconds);
  windowText.textContent = onlineWindow ? `${onlineWindow} 秒` : "—";
  generatedAt.textContent = formatTime(snapshot?.generated_at);
  accountsHint.textContent = users.length ? `${totalOnline} 在线 · ${users.length - totalOnline} 离线` : "暂无账号";
  summaryGrid.hidden = false;
  accountsSection.hidden = false;
  renderSelectedActivity();
  renderTaskAudits();
  hasRenderedData = true;
  setStatus(users.length ? `Telemetry 正常 · ${users.length} 个账号 · ${currentAudits.length} 个商品任务摘要` : `Telemetry 正常 · ${currentAudits.length} 个商品任务摘要`, "ok");
}

function renderEmptyNode() {
  const empty = document.createElement("div");
  empty.className = "usage-empty";
  empty.textContent = "暂无 Usage Telemetry 数据";
  return empty;
}

function renderAuditEmptyNode() {
  const empty = document.createElement("div");
  empty.className = "usage-empty";
  empty.textContent = currentAudits.length ? "当前筛选条件下没有商品任务" : "暂无商品任务审计数据";
  return empty;
}

function hideData() {
  summaryGrid.hidden = true;
  activitySection.hidden = true;
  accountsSection.hidden = true;
  taskAuditSection.hidden = true;
  windowText.textContent = "—";
  hasRenderedData = false;
}

async function refresh() {
  if (!supabase || refreshing) return;
  refreshing = true;
  refreshButton.disabled = true;
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session) {
      hideData();
      generatedAt.textContent = "—";
      setStatus("当前没有登录。请先返回下载页，用 Owner 账号登录后再打开这里。", "warn");
      return;
    }
    const { data, error } = await supabase.functions.invoke("portal-usage-admin", { body: { scope: "core" } });
    if (error) throw error;
    renderSnapshot(data ?? {});
  } catch (error) {
    console.error("usage dashboard refresh failed", error);
    if (!hasRenderedData) {
      hideData();
      generatedAt.textContent = "—";
      setStatus("Usage 数据服务暂时不可用。", "warn");
    } else {
      setStatus("本次刷新失败 · 当前保留上次成功数据", "warn");
    }
  } finally {
    refreshing = false;
    refreshButton.disabled = false;
  }
}

async function init() {
  if (!auth.supabaseUrl || !auth.supabaseAnonKey) {
    setStatus("Supabase 配置缺失。", "warn");
    return;
  }
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(auth.supabaseUrl, auth.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  refreshButton.addEventListener("click", () => void refresh());
  auditFilter?.addEventListener("change", renderTaskAudits);
  auditSearch?.addEventListener("input", renderTaskAudits);
  await refresh();
  autoRefresh = window.setInterval(() => void refresh(), 30_000);
}

window.addEventListener("pagehide", () => {
  if (autoRefresh) window.clearInterval(autoRefresh);
});

void init();
