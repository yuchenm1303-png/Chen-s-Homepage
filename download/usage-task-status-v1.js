const STATUS_SELECTOR = ".usage-task-status";
const STATUS_STATES = new Map([
  ["COMPLETED", "completed"],
  ["RUNNING", "running"],
  ["READY", "ready"],
  ["WAITING", "waiting"],
  ["STALE", "stale"],
  ["CANCELLED", "cancelled"],
  ["FAILED", "failed"],
  ["REVIEW", "review"]
]);

function ensureStylesheet() {
  if (document.getElementById("usageTaskStatusStyles")) return;
  const link = document.createElement("link");
  link.id = "usageTaskStatusStyles";
  link.rel = "stylesheet";
  link.href = "./usage-task-status-v1.css?v=20260902-waiting-stale-1";
  document.head.append(link);
}

function normalizeStatusNode(node) {
  if (!(node instanceof HTMLElement) || !node.matches(STATUS_SELECTOR)) return;
  const label = String(node.textContent || "").trim().toUpperCase();
  const state = STATUS_STATES.get(label);
  if (state) node.dataset.state = state;
}

function normalizeStatusTree(root) {
  if (!(root instanceof Element || root instanceof Document)) return;
  if (root instanceof Element && root.matches(STATUS_SELECTOR)) normalizeStatusNode(root);
  root.querySelectorAll?.(STATUS_SELECTOR).forEach(normalizeStatusNode);
}

function install() {
  ensureStylesheet();
  normalizeStatusTree(document);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") {
        const parent = record.target.parentElement;
        if (parent) normalizeStatusNode(parent);
        continue;
      }
      for (const node of record.addedNodes) {
        if (node instanceof Element) normalizeStatusTree(node);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
