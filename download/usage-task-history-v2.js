const PANEL_ID = "taskAuditPanel";
const CARD_SELECTOR = ":scope > .usage-task-card:not([data-task-history-day])";
const MODAL_PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 120;
const DETAIL_MODAL_MODULE = "./usage-detail-modal-v1.js?v=20261010-full-logs-1";
const HISTORY_FUNCTION = "portal-task-history";
const HISTORY_VIEW = "revisions";
const HISTORY_REFRESH_MS = 30_000;

const loadedByDay = new Map();
const taskCards = new Map();
let groupedDays = [];
let observer = null;
let organizing = false;
let scheduled = false;
let historyClient = null;
let historyCursor = null;
let historyHasMore = true;
let historyLoading = false;
let historyInitialized = false;
let historyError = "";
let historyComplete = false;
const historyRows = new Map();
let historyRefreshBusy = false;
let focusedUserId = "";

function dayKeyFromCard(card) {
  const meta = card.querySelector(".usage-task-summary .usage-account-email");
  const text = String(meta?.textContent || "");
  const match = text.match(/(20\d{2})\D(\d{1,2})\D(\d{1,2})/);
  if (!match) return "recent";
  const [, year, month, day] = match;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayLabel(key) {
  if (key === "recent") return "最近任务";
  const date = new Date(`${key}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Shanghai"
  }).format(date);
}

function statusOf(card) {
  return String(card.querySelector(".usage-task-status")?.textContent || "").trim().toUpperCase();
}

function groupStats(cards) {
  return cards.reduce((stats, card) => {
    const status = statusOf(card);
    stats.total += 1;
    if (status === "COMPLETED" || status === "READY") stats.success += 1;
    else if (status === "FAILED" || status === "CANCELLED" || status === "REVIEW") stats.failed += 1;
    else if (status === "RUNNING") stats.running += 1;
    return stats;
  }, { total: 0, success: 0, failed: 0, running: 0 });
}

function statsText(cards) {
  const stats = groupStats(cards);
  const parts = [`${stats.total} 个任务`];
  if (stats.success) parts.push(`${stats.success} 完成`);
  if (stats.failed) parts.push(`${stats.failed} 异常`);
  if (stats.running) parts.push(`${stats.running} 运行中`);
  return parts.join(" · ");
}

function cloneTaskCard(card) {
  const clone = card.cloneNode(true);
  if (clone instanceof HTMLDetailsElement) clone.open = false;
  return clone;
}

function renderDayModalBody(day) {
  const modalBody = document.getElementById("usageDetailModalBody");
  if (!modalBody) return;

  const shown = Math.min(day.cards.length, loadedByDay.get(day.key) || MODAL_PAGE_SIZE);
  const content = document.createElement("div");

  const list = document.createElement("div");
  list.className = "usage-task-audit-list";
  list.append(...day.cards.slice(0, shown).map(cloneTaskCard));
  content.append(list);

  if (shown < day.cards.length) {
    const footer = document.createElement("div");
    footer.className = "account-footer";

    const progress = document.createElement("span");
    progress.textContent = `已显示 ${shown} / ${day.cards.length}`;

    const more = document.createElement("button");
    more.type = "button";
    more.className = "switch-account-button usage-refresh";
    more.textContent = `加载更多（${day.cards.length - shown}）`;
    more.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      loadedByDay.set(day.key, Math.min(day.cards.length, shown + MODAL_PAGE_SIZE));
      renderDayModalBody(day);
    });

    footer.append(progress, more);
    content.append(footer);
  }

  modalBody.replaceChildren(content);
}

async function openDayModal(day, trigger) {
  if (!loadedByDay.has(day.key)) loadedByDay.set(day.key, MODAL_PAGE_SIZE);

  try {
    await import(DETAIL_MODAL_MODULE);
  } catch (error) {
    console.error("usage task history modal unavailable", error);
    return;
  }

  const layer = document.getElementById("usageDetailModal");
  const kicker = document.getElementById("usageDetailModalKicker");
  const title = document.getElementById("usageDetailModalTitle");
  const close = document.getElementById("usageDetailModalClose");
  if (!layer || !kicker || !title) return;

  kicker.textContent = "TASK HISTORY";
  title.textContent = dayLabel(day.key);
  renderDayModalBody(day);

  layer.hidden = false;
  document.documentElement.classList.add("usage-detail-modal-open");
  if (trigger instanceof HTMLElement) trigger.blur();
  close?.focus({ preventScroll: true });
}

function makeDayCard(day) {
  const card = document.createElement("article");
  card.className = "account-card cards usage-task-card";
  card.dataset.taskHistoryDay = day.key;

  const header = document.createElement("div");
  header.className = "usage-task-summary";
  header.setAttribute("role", "button");
  header.setAttribute("tabindex", "0");
  header.setAttribute("aria-label", `查看 ${dayLabel(day.key)} 的任务记录`);

  const identity = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "TASK HISTORY";
  const title = document.createElement("h2");
  title.textContent = dayLabel(day.key);
  const meta = document.createElement("p");
  meta.className = "usage-account-email";
  meta.textContent = statsText(day.cards);
  identity.append(kicker, title, meta);
  header.append(identity);

  header.addEventListener("click", () => openDayModal(day, header));
  header.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDayModal(day, header);
  });

  card.append(header);
  return card;
}

function formatTaskTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(date);
}

function compactTaskTitle(audit) {
  const url = String(audit?.product_url || "").trim();
  if (!url) return "历史商品任务";
  try {
    const parsed = new URL(url);
    const tail = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    return tail || parsed.hostname || "历史商品任务";
  } catch {
    return url.length > 88 ? `${url.slice(0, 85)}…` : url;
  }
}

function makeStatusLine(label, value) {
  const line = document.createElement("div");
  line.className = "account-status-line";
  const key = document.createElement("span");
  key.textContent = label;
  const data = document.createElement("strong");
  data.textContent = String(value || "—");
  line.append(key, data);
  return line;
}

function makePagedTaskCard(audit) {
  const card = document.createElement("details");
  card.className = "account-card cards usage-task-card";
  card.dataset.auditId = String(audit?.id || "");
  card.dataset.sourceAuditId = String(audit?.source_audit_id || audit?.id || "").split(":")[0];
  card.dataset.hydrated = "false";
  card.dataset.userId = String(audit?.user_id || "");
  card.dataset.revisionId = String(audit?.revision_id || "");
  card.dataset.searchText = [audit?.user_id, audit?.product_url, audit?.error_text, audit?.phase,
    audit?.review_reason, audit?.app_version, audit?.snapshot_origin].filter(Boolean).join(" ").toLowerCase();
  card.dataset.taskKind = String(audit?.task_kind || "").toLowerCase();
  card.dataset.taskStatus = String(audit?.status || "").toLowerCase();

  const summary = document.createElement("summary");
  summary.className = "usage-task-summary";
  const identity = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = `${String(audit?.task_kind || "TASK").toUpperCase()} · ${String(audit?.phase || "HISTORY").toUpperCase()}`;
  const title = document.createElement("h2");
  title.textContent = compactTaskTitle(audit);
  const meta = document.createElement("p");
  meta.className = "usage-account-email";
  meta.textContent = [
    formatTaskTime(audit?.updated_at || audit?.created_at),
    audit?.app_version ? `v${audit.app_version}` : "",
    audit?.product_url || ""
  ].filter(Boolean).join(" · ");
  identity.append(kicker, title, meta);

  const status = document.createElement("span");
  status.className = "usage-task-status";
  status.textContent = String(audit?.status || "unknown").toUpperCase();
  summary.append(identity, status);

  const body = document.createElement("div");
  body.className = "usage-task-body";
  const panel = document.createElement("div");
  panel.className = "account-status-panel usage-audit-status-panel";
  panel.append(
    makeStatusLine("任务状态", status.textContent),
    makeStatusLine("任务阶段", audit?.phase || "—"),
    makeStatusLine("商品链接", audit?.product_url || "—"),
    makeStatusLine("详情", "打开后按需读取完整审计")
  );
  body.append(panel);
  card.append(summary, body);
  return card;
}

function captureTaskCards(cards) {
  cards.forEach((card) => {
    const id = String(card?.dataset?.auditId || card?.dataset?.sourceAuditId || "").trim();
    if (!id || (historyInitialized && !card.dataset.revisionId)) return;
    const existing = taskCards.get(id);
    if (!existing || card.dataset.hydrated === "true" || existing.dataset.hydrated !== "true") {
      taskCards.set(id, card);
    }
  });
}

function cardMatchesCurrentFilter(card) {
  const search = String(document.getElementById("auditSearch")?.value || "").trim().toLowerCase();
  const filter = String(document.getElementById("auditFilter")?.value || "all").toLowerCase();
  const status = String(card.dataset.taskStatus || statusOf(card)).toLowerCase();
  const account = window.UsageMonitorUsersById?.get(String(card.dataset.userId || ""));
  const text = [card.textContent, card.dataset.searchText, account?.email, account?.display_name]
    .filter(Boolean).join(" ").toLowerCase();
  if (focusedUserId && String(card.dataset.userId || "") !== focusedUserId) return false;
  const kind = String(card.dataset.taskKind || (text.includes("batch") ? "batch" : text.includes("single") ? "single" : "")).toLowerCase();

  if (filter === "single" && kind !== "single") return false;
  if (filter === "batch" && kind !== "batch") return false;
  if (filter === "running" && status !== "running") return false;
  if (filter === "failed" && status !== "failed" && status !== "cancelled" && status !== "review") return false;
  if (filter === "completed" && status !== "completed") return false;
  if (filter === "ready" && status !== "ready") return false;
  if (search && !text.includes(search)) return false;
  return true;
}

function historyFooter() {
  const footer = document.createElement("div");
  footer.className = "account-footer usage-history-progress";
  footer.dataset.taskHistoryPager = "true";
  const progress = document.createElement("span");
  progress.setAttribute("role", "status");
  const loaded = historyRows.size;
  if (historyError) progress.textContent = `历史记录同步中断 · 已加载 ${loaded} 条状态记录 · ${historyError}`;
  else if (historyComplete) progress.textContent = `完整历史已同步 · ${loaded} 条状态记录（不含未上报的数据）`;
  else progress.textContent = `正在自动同步全部历史 · 已读取 ${loaded} 条状态记录…`;
  footer.append(progress);
  if (historyError || !historyComplete) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "switch-account-button usage-refresh";
    retry.textContent = historyLoading ? "正在同步…" : historyError ? "重试继续同步" : "继续同步";
    retry.disabled = historyLoading;
    retry.addEventListener("click", historyComplete ? syncNewRevisions : loadOlderTasks);
    footer.append(retry);
  }
  if (focusedUserId) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "switch-account-button usage-refresh";
    clear.textContent = "取消账号筛选";
    clear.addEventListener("click", () => {
      focusedUserId = "";
      scheduleOrganize();
    });
    footer.append(clear);
  }
  return footer;
}

function updateAuditHint(visibleCount) {
  const hint = document.getElementById("auditHint");
  if (!hint) return;
  const state = historyError ? "同步失败，可重试" : historyComplete ? "全部已入库历史已加载" : "正在自动同步";
  hint.textContent = `${visibleCount} 条匹配 · ${historyRows.size} 条状态历史 · ${state}`;
}

function publishHistoryProgress() {
  window.dispatchEvent(new CustomEvent("usage:task-history-progress", {
    detail: {
      rows: Array.from(historyRows.values()),
      loaded: historyRows.size,
      complete: historyComplete,
      loading: historyLoading,
      error: historyError
    }
  }));
}

function renderGroupedPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  organizing = true;
  observer?.disconnect();
  try {
    const nodes = groupedDays.map(makeDayCard);
    if (!nodes.length) {
      const empty = document.createElement("div");
      empty.className = "usage-empty";
      empty.textContent = taskCards.size
        ? "当前筛选下没有任务记录。可取消筛选查看全部。"
        : (historyError ? "历史加载失败，请使用下方按钮重试。" :
           historyComplete ? "数据库没有可显示的历史任务。" : "正在读取完整历史任务…");
      nodes.push(empty);
    }
    nodes.push(historyFooter());
    panel.replaceChildren(...nodes);
    updateAuditHint(groupedDays.reduce((count, day) => count + day.cards.length, 0));
  } finally {
    organizing = false;
    observer?.observe(panel, { childList: true });
  }
}

function organize() {
  scheduled = false;
  if (organizing) return;
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const freshCards = Array.from(panel.querySelectorAll(CARD_SELECTOR));
  captureTaskCards(freshCards);
  const groups = new Map();
  Array.from(taskCards.values()).filter(cardMatchesCurrentFilter).forEach((card) => {
    const key = dayKeyFromCard(card);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  });

  groupedDays = Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, dayCards]) => ({ key, cards: dayCards }));

  groupedDays.forEach((day) => {
    if (!loadedByDay.has(day.key)) loadedByDay.set(day.key, MODAL_PAGE_SIZE);
  });

  renderGroupedPanel();
}

function scheduleOrganize() {
  if (scheduled || organizing) return;
  scheduled = true;
  queueMicrotask(organize);
}

async function getHistoryClient() {
  if (historyClient) return historyClient;
  const auth = window.DOWNLOAD_PORTAL_CONFIG?.auth ?? {};
  if (!auth.supabaseUrl || !auth.supabaseAnonKey) throw new Error("监控登录配置缺失");
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  historyClient = createClient(auth.supabaseUrl, auth.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  return historyClient;
}

function mergeHistoryAudits(audits) {
  let added = 0;
  for (const audit of audits) {
    const id = String(audit?.id || "").trim();
    if (!id || !audit?.revision_id || historyRows.has(id)) continue;
    historyRows.set(id, audit);
    taskCards.set(id, makePagedTaskCard(audit));
    added++;
  }
  return added;
}

async function requestHistoryPage(beforeRevisionId) {
  const client = await getHistoryClient();
  const body = { view: HISTORY_VIEW, limit: HISTORY_PAGE_SIZE };
  if (beforeRevisionId) body.before_revision_id = beforeRevisionId;
  const { data, error } = await client.functions.invoke(HISTORY_FUNCTION, { body });
  if (error) throw error;
  if (!data || data.query_architecture !== "usage_monitor_task_revisions_v1" ||
      !Array.isArray(data.task_audits)) throw new Error("历史修订接口不可用或响应不完整");
  if (data.has_more && !data.next_before_revision_id) throw new Error("服务端还有数据，但未提供下一页游标");
  return data;
}

async function loadOlderTasks(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (historyLoading || historyComplete) return;
  historyLoading = true;
  historyError = "";
  publishHistoryProgress();
  scheduleOrganize();
  try {
    const client = await getHistoryClient();
    const { data: authData, error: authError } = await client.auth.getSession();
    if (authError || !authData?.session) throw new Error("未登录管理员账号，无法读取历史记录");
    const visitedCursors = new Set();
    while (!historyComplete) {
      const before = historyInitialized ? historyCursor : null;
      if (before && visitedCursors.has(before)) throw new Error("历史分页游标重复，已停止以防漏数");
      if (before) visitedCursors.add(before);
      const page = await requestHistoryPage(before);
      if (!historyInitialized) {
        historyRows.clear();
        taskCards.clear();
      }
      historyInitialized = true;
      mergeHistoryAudits(page.task_audits);
      historyHasMore = Boolean(page.has_more);
      historyCursor = page.next_before_revision_id ? String(page.next_before_revision_id) : null;
      historyComplete = !historyHasMore;
      if (historyHasMore && !historyCursor) throw new Error("历史分页不完整，缺失下一页位置");
      publishHistoryProgress();
      scheduleOrganize();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  } catch (error) {
    console.error("usage exhaustive task history sync failed", error);
    historyError = String(error?.message || error || "未知错误");
  } finally {
    historyLoading = false;
    publishHistoryProgress();
    scheduleOrganize();
  }
}

async function syncNewRevisions() {
  if (!historyComplete || historyLoading || historyRefreshBusy || !document.getElementById(PANEL_ID)) return;
  historyRefreshBusy = true;
  const oldIds = new Set(historyRows.keys());
  let before = null;
  const visited = new Set();
  try {
    while (true) {
      if (before && visited.has(before)) throw new Error("增量历史分页游标重复");
      if (before) visited.add(before);
      const page = await requestHistoryPage(before);
      const overlap = page.task_audits.some((entry) => oldIds.has(String(entry?.id || "")));
      mergeHistoryAudits(page.task_audits);
      if (overlap || !page.has_more) break;
      before = page.next_before_revision_id ? String(page.next_before_revision_id) : "";
      if (!before) throw new Error("增量任务分页中断");
    }
    historyError = "";
  } catch (error) {
    historyError = `新增历史校验失败：${String(error?.message || error || "未知错误")}`;
    console.error("usage task history incremental refresh failed", error);
  } finally {
    historyRefreshBusy = false;
    publishHistoryProgress();
    scheduleOrganize();
  }
}

function install() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel || observer) return;
  observer = new MutationObserver((records) => {
    const fresh = [];
    records.forEach((record) => {
      Array.from(record.addedNodes).forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.(".usage-task-card:not([data-task-history-day])")) fresh.push(node);
        fresh.push(...node.querySelectorAll?.(".usage-task-card:not([data-task-history-day])") || []);
      });
    });
    if (fresh.length) {
      captureTaskCards(fresh);
      scheduleOrganize();
    }
  });
  observer.observe(panel, { childList: true });

  window.addEventListener("usage:core-audits-rendered", scheduleOrganize);
  document.getElementById("auditSearch")?.addEventListener("input", scheduleOrganize);
  document.getElementById("auditFilter")?.addEventListener("change", scheduleOrganize);
  window.addEventListener("usage:monitor-user-filter", (event) => {
    focusedUserId = String(event?.detail?.userId || "");
    const search = document.getElementById("auditSearch");
    const filter = document.getElementById("auditFilter");
    if (search) search.value = "";
    if (filter) filter.value = "all";
    scheduleOrganize();
    document.getElementById("taskAuditSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  window.setTimeout(() => void loadOlderTasks(), 400);
  window.setInterval(() => {
    if (historyComplete) void syncNewRevisions();
    else if (!historyLoading) void loadOlderTasks();
  }, HISTORY_REFRESH_MS);
  scheduleOrganize();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
