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
const activityWindowBadge = document.getElementById("activityWindowBadge");
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

function asNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function formatHour(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
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

function totalsForUser(user) {
  const completed =
    asNumber(user.listing_prepare_completed) +
    asNumber(user.listing_execute_completed) +
    asNumber(user.batch_prepare_completed) +
    asNumber(user.batch_execute_completed);
  const failed =
    asNumber(user.listing_prepare_failed) +
    asNumber(user.listing_execute_failed) +
    asNumber(user.batch_prepare_failed) +
    asNumber(user.batch_execute_failed);
  return { completed, failed, attempts: completed + failed };
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
  return buckets.reduce(
    (acc, bucket) => {
      if (bucket.active) acc.activeHours += 1;
      acc.launches += asNumber(bucket.launches);
      acc.completed += asNumber(bucket.completed);
      acc.failed += asNumber(bucket.failed);
      return acc;
    },
    { activeHours: 0, launches: 0, completed: 0, failed: 0 }
  );
}

function aggregateActivity(users) {
  const histories = users.map(activityForUser);
  const bucketCount = histories.reduce((max, history) => Math.max(max, history.length), 0);
  const result = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const source = histories.find((history) => history[index]?.bucket_start)?.[index];
    const bucket = {
      bucket_start: source?.bucket_start || null,
      active_count: 0,
      launches: 0,
      completed: 0,
      failed: 0
    };
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

function completedFailedText(completed, failed) {
  return `${asNumber(completed)} / ${asNumber(failed)}`;
}

function renderAxis(target, buckets) {
  target.replaceChildren();
  if (!buckets.length) return;
  const first = buckets[0]?.bucket_start;
  const middle = buckets[Math.floor((buckets.length - 1) / 2)]?.bucket_start;
  const last = buckets[buckets.length - 1]?.bucket_start;
  [first, middle, last].forEach((value) => {
    const label = document.createElement("span");
    label.textContent = formatHour(value);
    target.append(label);
  });
}

function renderPresenceRail(target, buckets, { totalUsers = 1, global = false } = {}) {
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
    segment.title = `${formatHour(bucket.bucket_start)} · ${stateText} · 启动 ${asNumber(bucket.launches)} · 完成 ${asNumber(bucket.completed)} · 失败 ${asNumber(bucket.failed)}`;
    return segment;
  });
  target.replaceChildren(...nodes);
}

function renderThroughputChart(target, buckets) {
  const maxValue = Math.max(1, ...buckets.map((bucket) => asNumber(bucket.completed) + asNumber(bucket.failed)));
  const columns = buckets.map((bucket) => {
    const completed = asNumber(bucket.completed);
    const failed = asNumber(bucket.failed);
    const column = document.createElement("div");
    column.className = "usage-throughput-column";
    column.title = `${formatHour(bucket.bucket_start)} · 完成 ${completed} · 失败 ${failed} · 启动 ${asNumber(bucket.launches)}`;

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

function renderUser(user) {
  const card = document.createElement("article");
  card.className = "account-card cards usage-account-card";

  const totals = totalsForUser(user);
  const success = totals.attempts ? `${((totals.completed / totals.attempts) * 100).toFixed(1)}%` : "—";

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
    createStatusLine("任务成功率", success, totals.attempts ? (totals.failed ? "warn" : "ok") : "neutral")
  );

  const metrics = document.createElement("div");
  metrics.className = "release-meta usage-account-metrics";
  metrics.append(
    createMetaItem("程序启动", asNumber(user.launch_count)),
    createMetaItem("单商品准备 完成/失败", completedFailedText(user.listing_prepare_completed, user.listing_prepare_failed)),
    createMetaItem("单商品执行 完成/失败", completedFailedText(user.listing_execute_completed, user.listing_execute_failed)),
    createMetaItem("批量准备 完成/失败", completedFailedText(user.batch_prepare_completed, user.batch_prepare_failed)),
    createMetaItem("批量执行 完成/失败", completedFailedText(user.batch_execute_completed, user.batch_execute_failed)),
    createMetaItem("授权设备", `${asNumber(user.active_devices)} / ${asNumber(user.max_devices)}`)
  );

  const footer = document.createElement("div");
  footer.className = "account-footer";
  const telemetry = document.createElement("span");
  telemetry.textContent = "Usage telemetry · 24h history";
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
  const totals = buckets.reduce(
    (acc, bucket) => {
      acc.launches += asNumber(bucket.launches);
      acc.completed += asNumber(bucket.completed);
      acc.failed += asNumber(bucket.failed);
      if (asNumber(bucket.active_count) > 0) acc.activeHours += 1;
      acc.peakOnline = Math.max(acc.peakOnline, asNumber(bucket.active_count));
      return acc;
    },
    { launches: 0, completed: 0, failed: 0, activeHours: 0, peakOnline: 0 }
  );

  activityWindowBadge.textContent = `${hours} HOURS`;
  activityMeta.textContent = `${activeUserCount} 个账号在过去 ${hours} 小时出现真实心跳 · ${totals.launches} 次客户端启动`;
  presenceSummary.textContent = `${totals.activeHours}/${hours} 小时有活动 · 峰值 ${totals.peakOnline} 在线`;
  throughputSummary.textContent = `${totals.completed} 完成 · ${totals.failed} 失败`;

  renderPresenceRail(globalPresenceRail, buckets, { totalUsers: users.length, global: true });
  renderAxis(globalPresenceAxis, buckets);
  renderThroughputChart(globalTaskSpark, buckets);
  renderAxis(globalTaskAxis, buckets);
  activitySection.hidden = false;
}

function auditUser(audit, usersById) {
  return usersById.get(String(audit?.user_id || "")) || null;
}

function auditStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  return ({
    running: "RUNNING",
    completed: "COMPLETED",
    failed: "FAILED",
    cancelled: "CANCELLED",
    review: "REVIEW",
    ready: "READY"
  })[normalized] || normalized.toUpperCase() || "UNKNOWN";
}

function auditStatusState(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed" || normalized === "ready") return "ok";
  if (normalized === "failed" || normalized === "cancelled") return "warn";
  return "neutral";
}

function auditTitle(audit) {
  const input = audit?.input_data || {};
  const result = audit?.result_data || {};
  if (audit?.task_kind === "batch") {
    const count = asNumber(input.item_count) || (Array.isArray(input.items) ? input.items.length : 0);
    return `Batch · ${count} items`;
  }
  const url = String(audit?.product_url || input.supplier_url || result.product_url || "").trim();
  if (!url) return "Single Listing";
  try {
    const parsed = new URL(url);
    const tail = parsed.pathname.split("/").filter(Boolean).slice(-2).join("/");
    return `${parsed.hostname}${tail ? ` · ${tail}` : ""}`;
  } catch {
    return url.slice(0, 90);
  }
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

function createFileList(files) {
  const wrap = document.createElement("div");
  wrap.className = "usage-audit-file-list";
  const items = Array.isArray(files) ? files : [];
  if (!items.length) {
    const empty = document.createElement("span");
    empty.className = "usage-audit-empty-inline";
    empty.textContent = "无上传资料";
    wrap.append(empty);
    return wrap;
  }
  items.forEach((file) => {
    const chip = document.createElement("span");
    chip.className = "secure-pill usage-audit-file-chip";
    const size = asNumber(file?.size_bytes);
    const sizeText = size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : size >= 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`;
    chip.textContent = `${file?.name || "file"} · ${sizeText}`;
    wrap.append(chip);
  });
  return wrap;
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

function renderTaskAudit(audit, usersById) {
  const user = auditUser(audit, usersById);
  const input = audit?.input_data && typeof audit.input_data === "object" ? audit.input_data : {};
  const result = audit?.result_data && typeof audit.result_data === "object" ? audit.result_data : {};

  const card = document.createElement("details");
  card.className = "account-card cards usage-task-card";

  const summary = document.createElement("summary");
  summary.className = "usage-task-summary";
  const identity = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = `${String(audit?.task_kind || "task").toUpperCase()} · ${String(audit?.phase || "—").toUpperCase()}`;
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

  const inputSection = createAuditSection("客户输入");
  const inputPanel = document.createElement("div");
  inputPanel.className = "account-status-panel usage-audit-status-panel";
  if (audit?.task_kind === "batch") {
    const items = Array.isArray(input.items) ? input.items : [];
    inputPanel.append(createStatusLine("Batch 商品数", items.length || asNumber(input.item_count)));
    inputSection.append(inputPanel);
    if (items.length) {
      inputSection.append(createAuditTable(
        ["#", "启用", "Supplier URL", "销售规格 / 套装", "资料"],
        items.map((item) => [
          item?.row || "—",
          item?.enabled ? "YES" : "NO",
          item?.supplier_url || "—",
          item?.listing_intent || "—",
          Array.isArray(item?.customer_files) ? item.customer_files.map((file) => file?.name || "file").join(" · ") || "—" : "—"
        ])
      ));
    }
  } else {
    inputPanel.append(
      createStatusLine("Supplier URL", input.supplier_url || audit?.product_url || "—"),
      createStatusLine("销售规格 / 套装", input.listing_intent || "—"),
      createStatusLine("指定 Vertical", input.requested_vertical || "自动"),
      createStatusLine("执行范围", input.execution_scope || "—")
    );
    inputSection.append(
      inputPanel,
      createAuditTextBlock("AI 引导", input.ai_guidance || "—"),
      createAuditTextBlock("Model Name 流量词", input.model_name_keywords || "—")
    );
    const fileBlock = createAuditSection("客户资料文件");
    fileBlock.append(createFileList(input.customer_files));
    inputSection.append(fileBlock);
  }
  body.append(inputSection);

  const resultSection = createAuditSection("任务结果");
  const resultPanel = document.createElement("div");
  resultPanel.className = "account-status-panel usage-audit-status-panel";
  if (audit?.task_kind === "batch") {
    const jobs = Array.isArray(result.jobs) ? result.jobs : [];
    resultPanel.append(
      createStatusLine("Batch 状态", result.batch_status || audit?.status || "—", auditStatusState(audit?.status)),
      createStatusLine("Job 数量", jobs.length || asNumber(result.job_count))
    );
    resultSection.append(resultPanel);
    if (jobs.length) {
      resultSection.append(createAuditTable(
        ["JOB", "状态", "进度", "Supplier URL", "Vertical", "Brand", "READY / BLOCKED", "Required blocked", "Images", "Detail / Error"],
        jobs.map((job) => [
          job?.job_id || "—",
          job?.status || "—",
          `${asNumber(job?.progress)}%`,
          job?.product_url || "—",
          job?.vertical || "—",
          job?.brand || "—",
          `${asNumber(job?.ready)} / ${asNumber(job?.blocked)}`,
          asNumber(job?.required_blocked),
          asNumber(job?.product_images),
          job?.error || job?.stage_detail || "—"
        ])
      ));
    }
  } else {
    resultPanel.append(
      createStatusLine("Workflow", result.workflow_status || audit?.status || "—", auditStatusState(audit?.status)),
      createStatusLine("Vertical", result.vertical || "—"),
      createStatusLine("Brand", result.brand || "—"),
      createStatusLine("READY / BLOCKED", `${asNumber(result.ready)} / ${asNumber(result.blocked)}`),
      createStatusLine("MISSING / CONFLICT", `${asNumber(result.missing)} / ${asNumber(result.conflict)}`),
      createStatusLine("Live Fields", asNumber(result.live_field_count))
    );
    resultSection.append(resultPanel);

    const fields = Array.isArray(result.fields) ? result.fields : [];
    if (fields.length) {
      const fieldsSection = createAuditSection(`AI / Fill Plan 字段 · ${fields.length}`);
      fieldsSection.append(createAuditTable(
        ["字段", "AI结果", "AI状态", "最终状态", "Blocked reason", "来源"],
        fields.map((field) => [
          field?.field_name || field?.field_id || "—",
          field?.ai_result || "—",
          field?.ai_status || "—",
          field?.final_status || "—",
          field?.blocked_reason || "—",
          field?.source || "—"
        ])
      ));
      resultSection.append(fieldsSection);
    }

    const candidates = Array.isArray(result.web_candidates) ? result.web_candidates : [];
    if (candidates.length) {
      const webSection = createAuditSection(`Web Candidates · ${candidates.length}`);
      webSection.append(createAuditTable(
        ["Match", "Title", "URL", "Reason"],
        candidates.map((item) => [item?.match || "—", item?.title || "—", item?.url || "—", item?.reason || "—"])
      ));
      resultSection.append(webSection);
    }
  }
  body.append(resultSection);

  if (audit?.error_text) {
    const errorSection = createAuditSection("错误 / Review reason");
    const error = document.createElement("pre");
    error.className = "usage-audit-error";
    error.textContent = String(audit.error_text);
    errorSection.append(error);
    body.append(errorSection);
  }

  body.append(createRawAudit(audit));
  card.append(body);
  return card;
}

function auditMatches(audit, usersById) {
  const filter = String(auditFilter?.value || "all");
  const status = String(audit?.status || "").toLowerCase();
  const kind = String(audit?.task_kind || "").toLowerCase();
  if (filter !== "all" && filter !== kind && filter !== status) return false;

  const query = String(auditSearch?.value || "").trim().toLowerCase();
  if (!query) return true;
  const user = auditUser(audit, usersById);
  const haystack = [
    user?.email,
    user?.display_name,
    audit?.product_url,
    audit?.app_version,
    audit?.phase,
    audit?.status,
    JSON.stringify(audit?.input_data || {}),
    JSON.stringify(audit?.result_data || {})
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function renderTaskAudits() {
  const usersById = new Map(currentUsers.map((user) => [String(user.user_id || ""), user]));
  const visible = currentAudits.filter((audit) => auditMatches(audit, usersById));
  taskAuditPanel.replaceChildren(...(visible.length ? visible.map((audit) => renderTaskAudit(audit, usersById)) : [renderAuditEmptyNode()]));
  const suffix = currentAuditLimit ? ` · 最近最多 ${currentAuditLimit} 条` : "";
  auditHint.textContent = `${visible.length} / ${currentAudits.length} 条${suffix}`;
  taskAuditSection.hidden = false;
}

function renderSnapshot(snapshot) {
  const users = Array.isArray(snapshot?.users) ? snapshot.users : [];
  usersPanel.replaceChildren(...(users.length ? users.map(renderUser) : [renderEmptyNode()]));

  const totalOnline = users.filter((user) => Boolean(user.online)).length;
  const launches = users.reduce((sum, user) => sum + asNumber(user.launch_count), 0);
  const activeDevices = users.reduce((sum, user) => sum + asNumber(user.active_devices), 0);
  const maxDevices = users.reduce((sum, user) => sum + asNumber(user.max_devices), 0);
  const singleDone = users.reduce((sum, user) => sum + asNumber(user.listing_execute_completed), 0);
  const batchDone = users.reduce((sum, user) => sum + asNumber(user.batch_execute_completed), 0);

  const taskTotals = users.reduce(
    (acc, user) => {
      const totals = totalsForUser(user);
      acc.completed += totals.completed;
      acc.failed += totals.failed;
      return acc;
    },
    { completed: 0, failed: 0 }
  );
  const taskAttempts = taskTotals.completed + taskTotals.failed;
  const globalSuccess = taskAttempts ? `${((taskTotals.completed / taskAttempts) * 100).toFixed(1)}%` : "—";

  onlineCount.textContent = String(totalOnline);
  onlineRatio.textContent = users.length ? `${totalOnline} / ${users.length} 个账号在线` : "暂无账号";
  accountCount.textContent = String(users.length);
  launchCount.textContent = String(launches);
  activeDeviceCount.textContent = String(activeDevices);
  deviceCapacityText.textContent = `${activeDevices} / ${maxDevices || 0} 已授权容量`;
  singleDoneCount.textContent = String(singleDone);
  batchDoneCount.textContent = String(batchDone);
  successRate.textContent = globalSuccess;
  successRateMeta.textContent = taskAttempts ? `${taskTotals.completed} 完成 · ${taskTotals.failed} 失败` : "暂无任务";
  failureCount.textContent = String(taskTotals.failed);

  const onlineWindow = asNumber(snapshot?.online_window_seconds);
  windowText.textContent = onlineWindow ? `${onlineWindow} 秒` : "—";
  generatedAt.textContent = formatTime(snapshot?.generated_at);
  accountsHint.textContent = users.length ? `${totalOnline} 在线 · ${users.length - totalOnline} 离线` : "暂无账号";

  currentUsers = users;
  currentAudits = Array.isArray(snapshot?.task_audits) ? snapshot.task_audits : [];
  currentAuditLimit = asNumber(snapshot?.task_audit_limit);

  summaryGrid.hidden = false;
  accountsSection.hidden = false;
  renderGlobalActivity(snapshot, users);
  renderTaskAudits();
  setStatus(users.length ? `Telemetry 正常 · 已同步 ${users.length} 个已登记账号 · ${currentAudits.length} 条任务审计` : `Telemetry 正常 · ${currentAudits.length} 条任务审计`, "ok");
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
  empty.textContent = currentAudits.length ? "当前筛选条件下没有任务" : "暂无任务审计数据；新版本客户端开始任务后会自动出现";
  return empty;
}

function hideData() {
  summaryGrid.hidden = true;
  activitySection.hidden = true;
  accountsSection.hidden = true;
  taskAuditSection.hidden = true;
  windowText.textContent = "—";
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

    const { data, error } = await supabase.functions.invoke("portal-usage-admin", { body: {} });
    if (error) throw error;
    renderSnapshot(data ?? {});
  } catch (error) {
    console.error("usage dashboard refresh failed", error);
    hideData();
    generatedAt.textContent = "—";
    setStatus("当前账号不是 Usage 管理员，或使用数据服务暂时不可用。", "warn");
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
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
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
