const PANEL_ID = "taskAuditPanel";
const CARD_SELECTOR = ":scope > .usage-task-card";
const PAGE_SIZE = 8;

const openDays = new Set();
const loadedByDay = new Map();
let groupedDays = [];
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

function statsText(cards) {
  const stats = groupStats(cards);
  const parts = [`${stats.total} 个任务`];
  if (stats.success) parts.push(`${stats.success} 完成`);
  if (stats.failed) parts.push(`${stats.failed} 异常`);
  if (stats.running) parts.push(`${stats.running} 运行中`);
  return parts.join(" · ");
}

function makeDayHeader(day) {
  const header = document.createElement("div");
  header.className = "usage-section-head";

  const identity = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "TASK HISTORY";
  const title = document.createElement("h2");
  title.textContent = dayLabel(day.key);
  identity.append(kicker, title);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "switch-account-button usage-refresh";
  toggle.textContent = openDays.has(day.key)
    ? `${statsText(day.cards)} · 收起`
    : `${statsText(day.cards)} · 展开`;
  toggle.addEventListener("click", () => {
    if (openDays.has(day.key)) {
      openDays.delete(day.key);
    } else {
      openDays.add(day.key);
      if (!loadedByDay.has(day.key)) loadedByDay.set(day.key, PAGE_SIZE);
    }
    renderGroupedPanel();
  });

  header.append(identity, toggle);
  return header;
}

function makeLoadMore(day, shown) {
  const footer = document.createElement("div");
  footer.className = "usage-section-head";

  const progress = document.createElement("span");
  progress.textContent = `已显示 ${shown} / ${day.cards.length}`;

  const more = document.createElement("button");
  more.type = "button";
  more.className = "switch-account-button usage-refresh";
  more.textContent = `加载更多 · 剩余 ${day.cards.length - shown}`;
  more.addEventListener("click", () => {
    loadedByDay.set(day.key, Math.min(day.cards.length, shown + PAGE_SIZE));
    renderGroupedPanel();
  });

  footer.append(progress, more);
  return footer;
}

function renderGroupedPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel || !groupedDays.length) return;

  organizing = true;
  observer?.disconnect();
  try {
    const nodes = [];
    groupedDays.forEach((day) => {
      nodes.push(makeDayHeader(day));
      if (!openDays.has(day.key)) return;

      const shown = Math.min(day.cards.length, loadedByDay.get(day.key) || PAGE_SIZE);
      nodes.push(...day.cards.slice(0, shown));
      if (shown < day.cards.length) nodes.push(makeLoadMore(day, shown));
    });
    panel.replaceChildren(...nodes);
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

  const cards = Array.from(panel.querySelectorAll(CARD_SELECTOR));
  if (!cards.length) return;

  const groups = new Map();
  cards.forEach((card) => {
    const key = dayKeyFromCard(card);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  });

  groupedDays = Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, dayCards]) => ({ key, cards: dayCards }));

  if (!openDays.size && groupedDays.length) openDays.add(groupedDays[0].key);
  groupedDays.forEach((day) => {
    if (!loadedByDay.has(day.key)) loadedByDay.set(day.key, PAGE_SIZE);
  });

  renderGroupedPanel();
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
    const hasFreshCards = records.some((record) =>
      Array.from(record.addedNodes).some((node) =>
        node instanceof Element && node.matches?.(".usage-task-card")
      )
    );
    if (hasFreshCards) scheduleOrganize();
  });
  observer.observe(panel, { childList: true });
  scheduleOrganize();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
