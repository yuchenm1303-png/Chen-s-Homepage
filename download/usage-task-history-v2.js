const PANEL_ID = "taskAuditPanel";
const CARD_SELECTOR = ":scope > .usage-task-card";
const PAGE_SIZE = 8;

const openDays = new Set();
const deferredByGroup = new WeakMap();
let observer = null;
let organizing = false;
let scheduled = false;

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

function makeSummary(key, cards) {
  const stats = groupStats(cards);
  const summary = document.createElement("summary");
  summary.className = "usage-task-day-summary";

  const identity = document.createElement("div");
  identity.className = "usage-task-day-identity";
  const kicker = document.createElement("span");
  kicker.className = "kicker";
  kicker.textContent = "TASK HISTORY";
  const title = document.createElement("strong");
  title.textContent = dayLabel(key);
  identity.append(kicker, title);

  const counters = document.createElement("div");
  counters.className = "usage-task-day-counters";
  const total = document.createElement("span");
  total.textContent = `${stats.total} 个任务`;
  counters.append(total);
  if (stats.success) {
    const success = document.createElement("span");
    success.dataset.state = "ok";
    success.textContent = `${stats.success} 完成`;
    counters.append(success);
  }
  if (stats.failed) {
    const failed = document.createElement("span");
    failed.dataset.state = "warn";
    failed.textContent = `${stats.failed} 异常`;
    counters.append(failed);
  }
  if (stats.running) {
    const running = document.createElement("span");
    running.textContent = `${stats.running} 运行中`;
    counters.append(running);
  }

  summary.append(identity, counters);
  return summary;
}

function appendNextPage(group) {
  const state = deferredByGroup.get(group);
  if (!state) return;
  const next = state.remaining.splice(0, PAGE_SIZE);
  state.list.append(...next);
  if (!state.remaining.length) {
    state.more.remove();
    deferredByGroup.delete(group);
    return;
  }
  state.more.textContent = `加载更多 · 剩余 ${state.remaining.length}`;
}

function makeGroup(key, cards, isNewest) {
  const group = document.createElement("details");
  group.className = "usage-task-day-group";
  group.dataset.day = key;
  group.open = openDays.has(key) || (isNewest && !openDays.size);
  group.append(makeSummary(key, cards));

  const list = document.createElement("div");
  list.className = "usage-task-day-list";
  const initial = cards.slice(0, PAGE_SIZE);
  list.append(...initial);
  group.append(list);

  const remaining = cards.slice(PAGE_SIZE);
  if (remaining.length) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "usage-task-day-more";
    more.textContent = `加载更多 · 剩余 ${remaining.length}`;
    more.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      appendNextPage(group);
    });
    group.append(more);
    deferredByGroup.set(group, { remaining, list, more });
  }

  group.addEventListener("toggle", () => {
    if (group.open) openDays.add(key);
    else openDays.delete(key);
  });
  return group;
}

function organize() {
  scheduled = false;
  if (organizing) return;
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  const cards = Array.from(panel.querySelectorAll(CARD_SELECTOR));
  if (!cards.length) return;

  organizing = true;
  observer?.disconnect();
  try {
    const groups = new Map();
    cards.forEach((card) => {
      const key = dayKeyFromCard(card);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    });

    const ordered = Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
    const nodes = ordered.map(([key, dayCards], index) => makeGroup(key, dayCards, index === 0));
    panel.replaceChildren(...nodes);
  } finally {
    organizing = false;
    observer?.observe(panel, { childList: true });
  }
}

function scheduleOrganize() {
  if (scheduled || organizing) return;
  scheduled = true;
  queueMicrotask(organize);
}

function install() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel || observer) return;
  observer = new MutationObserver((records) => {
    if (records.some((record) => Array.from(record.addedNodes).some((node) => node instanceof Element && node.matches?.(".usage-task-card")))) {
      scheduleOrganize();
    }
  });
  observer.observe(panel, { childList: true });
  scheduleOrganize();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
