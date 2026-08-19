const COPY_VERSION = "20260819-0957";
const COPY_BUTTON_CLASS = "usage-copy-button";
const COPY_UI_CLASS = "usage-copy-ui";

function ensureStylesheet() {
  if (document.getElementById("usageCopyStyles")) return;
  const link = document.createElement("link");
  link.id = "usageCopyStyles";
  link.rel = "stylesheet";
  link.href = `./usage-copy-v1.css?v=${COPY_VERSION}`;
  document.head.append(link);
}

function normalizedText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

async function writeClipboard(value) {
  const text = normalizedText(value);
  if (!text) throw new Error("empty copy payload");

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "-9999px auto auto -9999px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("clipboard copy failed");
}

function copyButton({ label = "复制", mode = "text", selector = "", ariaLabel = "" } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${COPY_BUTTON_CLASS} ${COPY_UI_CLASS}`;
  button.textContent = label;
  button.dataset.copyMode = mode;
  if (selector) button.dataset.copySelector = selector;
  button.dataset.copyLabel = label;
  button.setAttribute("aria-label", ariaLabel || label);
  return button;
}

function setButtonState(button, label, state) {
  button.textContent = label;
  button.dataset.copyState = state;
  window.clearTimeout(Number(button.dataset.copyTimer || 0));
  const timer = window.setTimeout(() => {
    button.textContent = button.dataset.copyLabel || "复制";
    delete button.dataset.copyState;
    delete button.dataset.copyTimer;
  }, 1400);
  button.dataset.copyTimer = String(timer);
}

function copyPayloadForButton(button) {
  const mode = button.dataset.copyMode || "text";
  const selector = button.dataset.copySelector || "";

  if (mode === "task-error") {
    const body = button.closest(".usage-task-body");
    return collectTaskError(body);
  }

  if (mode === "diagnostic-json") {
    const body = button.closest(".usage-diagnostic-body");
    return normalizedText(body?.querySelector(".usage-diagnostic-json")?.textContent);
  }

  const host = button.closest(".usage-audit-copy, .usage-audit-raw, .usage-diagnostic-body") || button.parentElement;
  if (!host) return "";
  if (selector) return normalizedText(host.querySelector(selector)?.textContent);
  return normalizedText(host.textContent);
}

function collectTaskError(body) {
  if (!body) return "";
  const chunks = [];

  const metrics = body.querySelector(".usage-task-metrics");
  if (metrics) chunks.push(`[任务上下文]\n${normalizedText(metrics.textContent)}`);

  const inputSection = [...body.querySelectorAll(":scope > .usage-audit-detail-section")].find((section) =>
    normalizedText(section.querySelector(":scope > .usage-audit-detail-title")?.textContent) === "客户输入"
  );
  if (inputSection) chunks.push(`[客户输入]\n${normalizedText(inputSection.textContent)}`);

  for (const block of body.querySelectorAll(".usage-audit-copy")) {
    const label = normalizedText(block.querySelector(":scope > span")?.textContent).toLowerCase();
    if (!/(错误|error|review|异常|失败)/i.test(label)) continue;
    const value = normalizedText(block.querySelector(":scope > p")?.textContent);
    if (value) chunks.push(`[${normalizedText(block.querySelector(":scope > span")?.textContent) || "错误"}]\n${value}`);
  }

  for (const section of body.querySelectorAll(".usage-audit-detail-section")) {
    const title = normalizedText(section.querySelector(":scope > .usage-audit-detail-title")?.textContent);
    if (!/(故障诊断|failure|diagnostic)/i.test(title)) continue;
    const clone = section.cloneNode(true);
    clone.querySelectorAll(`.${COPY_UI_CLASS}`).forEach((node) => node.remove());
    chunks.push(`[${title || "运行故障诊断"}]\n${normalizedText(clone.textContent)}`);
  }

  for (const details of body.querySelectorAll(".usage-audit-raw")) {
    const label = normalizedText(details.querySelector(":scope > summary")?.childNodes?.[0]?.textContent || details.querySelector(":scope > summary")?.textContent);
    if (!/(traceback|workflow_diag|failed event|run manifest|原始审计|错误|error|失败)/i.test(label)) continue;
    const value = normalizedText(details.querySelector(":scope > pre")?.textContent);
    if (value) chunks.push(`[${label || "诊断详情"}]\n${value}`);
  }

  if (!chunks.length) {
    const clone = body.cloneNode(true);
    clone.querySelectorAll(`.${COPY_UI_CLASS}`).forEach((node) => node.remove());
    return normalizedText(clone.textContent);
  }
  return chunks.join("\n\n");
}

function taskNeedsErrorCopy(card) {
  if (!(card instanceof HTMLElement)) return false;
  const status = normalizedText(card.querySelector(":scope > summary .usage-task-status")?.textContent).toUpperCase();
  if (["FAILED", "REVIEW", "CANCELLED"].includes(status)) return true;
  const body = card.querySelector(":scope > .usage-task-body");
  if (!body) return false;
  return /运行故障诊断|错误\s*\/\s*Review reason|Traceback|FAILED Event/i.test(body.textContent || "");
}

function enhanceTaskCard(card) {
  if (!(card instanceof HTMLElement) || card.dataset.copyErrorEnhanced === "1") return;
  if (!taskNeedsErrorCopy(card)) return;
  const body = card.querySelector(":scope > .usage-task-body");
  if (!body) return;

  const toolbar = document.createElement("div");
  toolbar.className = `usage-error-copy-toolbar ${COPY_UI_CLASS}`;
  const label = document.createElement("span");
  label.textContent = "ERROR CONTEXT";
  toolbar.append(label, copyButton({
    label: "复制完整错误",
    mode: "task-error",
    ariaLabel: "复制该任务的完整错误与诊断上下文"
  }));
  body.prepend(toolbar);
  card.dataset.copyErrorEnhanced = "1";
}

function enhanceTextBlock(block) {
  if (!(block instanceof HTMLElement) || block.dataset.copyEnhanced === "1") return;
  const value = block.querySelector(":scope > p");
  if (!value || !normalizedText(value.textContent)) return;
  block.classList.add("usage-copyable-block");
  block.append(copyButton({ label: "复制", mode: "text", selector: ":scope > p", ariaLabel: "复制此信息" }));
  block.dataset.copyEnhanced = "1";
}

function enhanceRawDetails(details) {
  if (!(details instanceof HTMLElement) || details.dataset.copyEnhanced === "1") return;
  const summary = details.querySelector(":scope > summary");
  const pre = details.querySelector(":scope > pre");
  if (!summary || !pre || !normalizedText(pre.textContent)) return;
  summary.classList.add("usage-copy-summary");
  const label = normalizedText(summary.textContent);
  summary.append(copyButton({ label: "复制", mode: "text", selector: ":scope > pre", ariaLabel: `复制${label || "诊断详情"}` }));
  details.dataset.copyEnhanced = "1";
}

function enhanceCrashDiagnostic(details) {
  if (!(details instanceof HTMLElement) || details.dataset.copyDiagnosticEnhanced === "1") return;
  const body = details.querySelector(":scope > .usage-diagnostic-body");
  const raw = body?.querySelector(":scope > .usage-diagnostic-json");
  if (!body || !raw || !normalizedText(raw.textContent)) return;
  const toolbar = document.createElement("div");
  toolbar.className = `usage-error-copy-toolbar ${COPY_UI_CLASS}`;
  const label = document.createElement("span");
  label.textContent = "DIAGNOSTIC REPORT";
  toolbar.append(label, copyButton({
    label: "复制完整诊断",
    mode: "diagnostic-json",
    ariaLabel: "复制完整 Crash / Diagnostic 报告"
  }));
  body.prepend(toolbar);
  details.dataset.copyDiagnosticEnhanced = "1";
}

function enhance(root = document) {
  const scope = root instanceof Element || root instanceof Document ? root : document;
  if (scope instanceof Element) {
    if (scope.matches(".usage-task-card")) enhanceTaskCard(scope);
    if (scope.matches(".usage-audit-copy")) enhanceTextBlock(scope);
    if (scope.matches(".usage-audit-raw")) enhanceRawDetails(scope);
    if (scope.matches("#diagnosticsPanel > .usage-diagnostic-item")) enhanceCrashDiagnostic(scope);
  }
  scope.querySelectorAll?.(".usage-task-card").forEach(enhanceTaskCard);
  scope.querySelectorAll?.(".usage-audit-copy").forEach(enhanceTextBlock);
  scope.querySelectorAll?.(".usage-audit-raw").forEach(enhanceRawDetails);
  scope.querySelectorAll?.("#diagnosticsPanel > .usage-diagnostic-item").forEach(enhanceCrashDiagnostic);
}

ensureStylesheet();
enhance(document);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) enhance(node);
    }
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("click", async (event) => {
  const button = event.target instanceof Element ? event.target.closest(`.${COPY_BUTTON_CLASS}`) : null;
  if (!(button instanceof HTMLButtonElement)) return;
  event.preventDefault();
  event.stopPropagation();

  try {
    await writeClipboard(copyPayloadForButton(button));
    setButtonState(button, "已复制", "ok");
  } catch (error) {
    console.error("copy diagnostic failed", error);
    setButtonState(button, "复制失败", "error");
  }
}, true);

window.addEventListener("pagehide", () => observer.disconnect());
