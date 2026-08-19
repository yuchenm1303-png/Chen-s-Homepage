const SELECTOR = ".usage-throughput-column, .usage-presence-segment, .usage-daily-cell";
const STYLE_ID = "usage-chart-tooltip-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .usage-chart-hover-target {
      outline: 1px solid rgba(190, 237, 255, .34);
      outline-offset: 2px;
      filter: brightness(1.12);
    }
    .usage-chart-tooltip {
      position: fixed;
      z-index: 9999;
      width: max-content;
      min-width: 184px;
      max-width: min(280px, calc(100vw - 24px));
      padding: 10px 11px;
      border: 1px solid rgba(183, 226, 244, .18);
      border-radius: 10px;
      background: rgba(7, 20, 35, .96);
      box-shadow: 0 12px 32px rgba(0, 0, 0, .28);
      color: var(--text, #eef7ff);
      font: 500 .61rem/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: none;
      opacity: 0;
      transform: translateY(3px);
      transition: opacity 90ms ease, transform 90ms ease;
      backdrop-filter: blur(12px);
    }
    .usage-chart-tooltip.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .usage-chart-tooltip-time {
      margin-bottom: 7px;
      color: var(--text, #eef7ff);
      font-size: .66rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: .01em;
    }
    .usage-chart-tooltip-grid {
      display: grid;
      grid-template-columns: auto auto;
      gap: 4px 14px;
      align-items: baseline;
    }
    .usage-chart-tooltip-label {
      color: var(--soft, rgba(220, 235, 245, .62));
      white-space: nowrap;
    }
    .usage-chart-tooltip-value {
      color: var(--muted, rgba(235, 246, 255, .86));
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .usage-chart-tooltip-value[data-kind="success"] {
      color: #8ce9c8;
    }
    .usage-chart-tooltip-value[data-kind="failure"] {
      color: #ffd09b;
    }
    @media (prefers-reduced-motion: reduce) {
      .usage-chart-tooltip { transition: none; }
    }
  `;
  document.head.append(style);
}

function createTooltip() {
  const tooltip = document.createElement("div");
  tooltip.className = "usage-chart-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);
  return tooltip;
}

function labelFor(raw) {
  const label = String(raw || "").trim();
  if (label === "启动") return "客户端启动";
  if (label === "完成" || label === "成功") return "成功商品任务";
  if (label === "失败") return "失败商品任务";
  return label || "详情";
}

function kindFor(label) {
  if (label === "完成" || label === "成功") return "success";
  if (label === "失败") return "failure";
  return "neutral";
}

function parseDetail(raw) {
  const text = String(raw || "").trim();
  const numeric = text.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)$/);
  if (numeric) {
    return {
      label: labelFor(numeric[1]),
      value: numeric[2],
      kind: kindFor(numeric[1])
    };
  }
  return { label: "状态", value: text || "—", kind: "neutral" };
}

function rawTooltipText(target) {
  const stored = String(target?.dataset?.chartTooltipRaw || "").trim();
  if (stored) return stored;
  const title = String(target?.getAttribute?.("title") || "").trim();
  if (!title) return "";
  target.dataset.chartTooltipRaw = title;
  target.setAttribute("aria-label", title);
  target.removeAttribute("title");
  return title;
}

function renderTooltip(tooltip, raw) {
  const parts = String(raw || "").split(" · ").map((item) => item.trim()).filter(Boolean);
  tooltip.replaceChildren();

  const time = document.createElement("div");
  time.className = "usage-chart-tooltip-time";
  time.textContent = parts.shift() || "任务详情";
  tooltip.append(time);

  if (!parts.length) return;
  const grid = document.createElement("div");
  grid.className = "usage-chart-tooltip-grid";
  parts.forEach((part) => {
    const detail = parseDetail(part);
    const label = document.createElement("span");
    label.className = "usage-chart-tooltip-label";
    label.textContent = detail.label;
    const value = document.createElement("strong");
    value.className = "usage-chart-tooltip-value";
    value.dataset.kind = detail.kind;
    value.textContent = detail.value;
    grid.append(label, value);
  });
  tooltip.append(grid);
}

function positionTooltip(tooltip, clientX, clientY) {
  const gap = 14;
  const viewportPadding = 10;
  const rect = tooltip.getBoundingClientRect();
  let left = clientX + gap;
  let top = clientY + gap;
  if (left + rect.width > window.innerWidth - viewportPadding) {
    left = clientX - rect.width - gap;
  }
  if (top + rect.height > window.innerHeight - viewportPadding) {
    top = clientY - rect.height - gap;
  }
  tooltip.style.left = `${Math.max(viewportPadding, left)}px`;
  tooltip.style.top = `${Math.max(viewportPadding, top)}px`;
}

function chartTarget(node) {
  return node instanceof Element ? node.closest(SELECTOR) : null;
}

ensureStyle();
const tooltip = createTooltip();
let activeTarget = null;

function show(target, event) {
  const raw = rawTooltipText(target);
  if (!raw) return;
  activeTarget?.classList.remove("usage-chart-hover-target");
  activeTarget = target;
  activeTarget.classList.add("usage-chart-hover-target");
  renderTooltip(tooltip, raw);
  tooltip.hidden = false;
  tooltip.classList.add("is-visible");
  positionTooltip(tooltip, event.clientX, event.clientY);
}

function hide() {
  activeTarget?.classList.remove("usage-chart-hover-target");
  activeTarget = null;
  tooltip.classList.remove("is-visible");
  tooltip.hidden = true;
}

document.addEventListener("pointerover", (event) => {
  const target = chartTarget(event.target);
  if (!target || target === activeTarget) return;
  show(target, event);
});

document.addEventListener("pointermove", (event) => {
  if (!activeTarget || tooltip.hidden) return;
  positionTooltip(tooltip, event.clientX, event.clientY);
});

document.addEventListener("pointerout", (event) => {
  if (!activeTarget) return;
  const from = chartTarget(event.target);
  if (from !== activeTarget) return;
  const next = chartTarget(event.relatedTarget);
  if (next === activeTarget) return;
  hide();
});

window.addEventListener("blur", hide);
window.addEventListener("pagehide", () => tooltip.remove());
