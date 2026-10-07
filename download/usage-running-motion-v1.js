const STYLE_ID = "usageRunningMotionStyles";
const MOTION_PERIOD_MS = 1800;
const RUNNING_SELECTOR = [
  '.usage-presence-segment.has-running',
  '.usage-throughput-state.is-running',
  '.usage-legend-dot.is-running',
  '.usage-task-status[data-state="running"]',
  '.usage-chart-tooltip-value[data-kind="running"]'
].join(",");

function ensureStylesheet() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = "./usage-running-motion-v1.css?v=20260902-seamless-1";
  document.head.append(link);
}

function phaseDelay() {
  const now = typeof performance?.now === "function" ? performance.now() : Date.now();
  return `${-(now % MOTION_PERIOD_MS)}ms`;
}

function syncElement(element) {
  if (!(element instanceof HTMLElement) || !element.matches(RUNNING_SELECTOR)) return;
  element.style.setProperty("--usage-running-phase", phaseDelay());
}

function syncTree(root) {
  if (!(root instanceof Element || root instanceof Document)) return;
  if (root instanceof Element) syncElement(root);
  root.querySelectorAll?.(RUNNING_SELECTOR).forEach(syncElement);
}

function install() {
  ensureStylesheet();
  syncTree(document);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        syncElement(record.target);
        continue;
      }
      for (const node of record.addedNodes) {
        if (node instanceof Element) syncTree(node);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-state", "data-kind"]
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
