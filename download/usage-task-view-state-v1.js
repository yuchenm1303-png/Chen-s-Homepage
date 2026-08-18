const STYLE_ID = "usageTaskListStyles";
const OPEN_TASKS_KEY = "listing-studio:owner-open-tasks:v1";
const OPEN_DETAILS_KEY = "listing-studio:owner-open-task-details:v1";

function loadSet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveSet(key, values) {
  try {
    sessionStorage.setItem(key, JSON.stringify([...values].slice(-80)));
  } catch {
    // Session persistence is optional; in-memory state still works.
  }
}

const openTasks = loadSet(OPEN_TASKS_KEY);
const openDetails = loadSet(OPEN_DETAILS_KEY);

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = "./usage-task-list-v1.css?v=20260818-1234";
  document.head.append(link);
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function taskKey(card) {
  const kicker = compactText(card.querySelector(":scope > .usage-task-summary .kicker")?.textContent)
    .replace(/\s*·\s*(BATCH_PREPARE|BATCH_EXECUTE|LISTING_PREPARE|LISTING_EXECUTE)\s*$/i, "");
  const title = compactText(card.querySelector(":scope > .usage-task-summary h2")?.textContent);
  return `${kicker}|${title}`;
}

function detailKey(details) {
  const card = details.closest(".usage-task-card");
  if (!card) return "";
  const label = compactText(details.querySelector(":scope > summary")?.textContent);
  return `${taskKey(card)}|${label}`;
}

function restoreOpenState(root = document) {
  root.querySelectorAll?.(".usage-task-card").forEach((card) => {
    const key = taskKey(card);
    if (key && openTasks.has(key)) card.open = true;
    card.querySelectorAll(".usage-task-body details").forEach((details) => {
      const key = detailKey(details);
      if (key && openDetails.has(key)) details.open = true;
    });
  });
}

function rememberTask(card) {
  const key = taskKey(card);
  if (!key) return;
  if (card.open) openTasks.add(key);
  else openTasks.delete(key);
  saveSet(OPEN_TASKS_KEY, openTasks);
}

function rememberDetails(details) {
  const key = detailKey(details);
  if (!key) return;
  if (details.open) openDetails.add(key);
  else openDetails.delete(key);
  saveSet(OPEN_DETAILS_KEY, openDetails);
}

installStyles();
restoreOpenState();

document.addEventListener("click", (event) => {
  const summary = event.target.closest?.("summary");
  if (!summary) return;

  const card = summary.closest(".usage-task-card");
  if (!card) return;

  const owner = summary.parentElement;
  window.setTimeout(() => {
    if (owner === card) rememberTask(card);
    else if (owner instanceof HTMLDetailsElement) rememberDetails(owner);
  }, 0);
}, true);

const panel = document.getElementById("taskAuditPanel");
if (panel) {
  const observer = new MutationObserver(() => restoreOpenState(panel));
  observer.observe(panel, { childList: true, subtree: true });
}
