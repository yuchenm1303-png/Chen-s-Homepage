const PANEL_ID = "taskAuditPanel";
const CARD_SELECTOR = ":scope > .usage-task-card:not([data-task-history-day])";
const PAGE_SIZE = 8;
const DETAIL_MODAL_MODULE = "./usage-detail-modal-v1.js?v=20260826-2035";

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

function cloneTaskCard(card) {
  const clone = card.cloneNode(true);
  if (clone instanceof HTMLDetailsElement) clone.open = false;
  return clone;
}

function renderDayModalBody(day) {
  const modalBody = document.getElementById("usageDetailModalBody");
  if (!modalBody) return;

  const shown = Math.min(day.cards.length, loadedByDay.get(day.key) || PAGE_SIZE);
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
      loadedByDay.set(day.key, Math.min(day.cards.length, shown + PAGE_SIZE));
      renderDayModalBody(day);
    });

    footer.append(progress, more);
    content.append(footer);
  }

  modalBody.replaceChildren(content);
}

async function openDayModal(day, trigger) {
  if (!loadedByDay.has(day.key)) loadedByDay.set(day.key, PAGE_SIZE);

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

function renderGroupedPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel || !groupedDays.length) return;

  organizing = true;
  observer?.disconnect();
  try {
    panel.replaceChildren(...groupedDays.map(makeDayCard));
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
        node instanceof Element && node.matches?.(".usage-task-card:not([data-task-history-day])")
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
