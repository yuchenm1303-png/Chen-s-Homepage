function ensureStylesheet(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}

function ensureModal() {
  let layer = document.getElementById("usageDetailModal");
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = "modal-layer usage-detail-modal";
  layer.id = "usageDetailModal";
  layer.hidden = true;
  layer.innerHTML = `
    <div class="modal-mask" id="usageDetailModalMask"></div>
    <article class="modal-card cards" role="dialog" aria-modal="true" aria-labelledby="usageDetailModalTitle">
      <button class="modal-close" id="usageDetailModalClose" type="button" aria-label="关闭">×</button>
      <p class="modal-kicker" id="usageDetailModalKicker">DETAIL</p>
      <h2 id="usageDetailModalTitle">详情</h2>
      <div class="modal-body" id="usageDetailModalBody"></div>
    </article>`;
  document.body.append(layer);
  return layer;
}

ensureStylesheet("usageTaskListStyles", "./usage-task-list-v1.css?v=20260818-1234");
ensureStylesheet("usageDetailModalStyles", "./usage-detail-modal-v1.css?v=20260826-2035");

const modalLayer = ensureModal();
const modalMask = document.getElementById("usageDetailModalMask");
const modalClose = document.getElementById("usageDetailModalClose");
const modalCard = modalLayer?.querySelector(".modal-card") || null;
const modalKicker = document.getElementById("usageDetailModalKicker");
const modalTitle = document.getElementById("usageDetailModalTitle");
const modalBody = document.getElementById("usageDetailModalBody");

let lastTrigger = null;
let detailRequestId = 0;
const modalViewStack = [];
const hydratePromises = new WeakMap();

function directSummary(details) {
  return [...details.children].find((child) => child.tagName === "SUMMARY") || null;
}

function detailBody(details) {
  return [...details.children].find((child) =>
    child.classList?.contains("usage-task-body") || child.classList?.contains("usage-diagnostic-body")
  ) || null;
}

function isPortalDetail(details) {
  if (!(details instanceof HTMLDetailsElement)) return false;
  if (details.matches(".usage-task-card[data-task-history-day]")) return false;
  if (details.matches(".usage-task-card")) return true;
  if (details.matches("#deviceHealthPanel > .usage-diagnostic-item")) return true;
  if (details.matches("#diagnosticsPanel > .usage-diagnostic-item")) return true;
  return false;
}

function animateModalView() {
  if (!modalBody) return;
  modalBody.classList.remove("fade");
  void modalBody.offsetWidth;
  modalBody.classList.add("fade");
}

function captureCurrentModalView(trigger) {
  if (!modalLayer || modalLayer.hidden || !modalBody || !(trigger instanceof Node) || !modalBody.contains(trigger)) return;

  const fragment = document.createDocumentFragment();
  while (modalBody.firstChild) fragment.append(modalBody.firstChild);
  modalViewStack.push({
    kicker: modalKicker?.textContent || "DETAIL",
    title: modalTitle?.textContent || "详情",
    body: fragment,
    scrollTop: modalCard?.scrollTop || 0,
    focusTarget: trigger instanceof HTMLElement ? trigger : null,
    previousTrigger: lastTrigger
  });
}

function restorePreviousModalView() {
  const view = modalViewStack.pop();
  if (!view || !modalBody || !modalKicker || !modalTitle) return false;

  detailRequestId += 1;
  modalKicker.textContent = view.kicker;
  modalTitle.textContent = view.title;
  modalBody.replaceChildren(view.body);
  animateModalView();
  lastTrigger = view.previousTrigger || null;

  const restoreScroll = () => {
    if (modalCard) modalCard.scrollTop = view.scrollTop;
  };
  restoreScroll();
  requestAnimationFrame(() => {
    restoreScroll();
    if (view.focusTarget instanceof HTMLElement && view.focusTarget.isConnected) {
      view.focusTarget.focus({ preventScroll: true });
    }
  });
  return true;
}

function closeDetailModal() {
  if (!modalLayer || modalLayer.hidden) return;
  if (restorePreviousModalView()) return;

  detailRequestId += 1;
  modalViewStack.length = 0;
  modalLayer.hidden = true;
  document.documentElement.classList.remove("usage-detail-modal-open");
  modalBody?.replaceChildren();
  if (lastTrigger instanceof HTMLElement && lastTrigger.isConnected) lastTrigger.focus({ preventScroll: true });
  lastTrigger = null;
}

function modalHeadingFromSummary(summary) {
  return {
    kicker: summary?.querySelector(".kicker")?.textContent?.trim() || "DETAIL",
    title: summary?.querySelector("h2, h3")?.textContent?.trim() || "详情"
  };
}

function makeImmediateDetailNode(details, summary) {
  const source = detailBody(details);
  if (source) {
    const clone = source.cloneNode(true);
    clone.classList.add("usage-modal-clone");
    return clone;
  }

  const fallback = document.createElement("div");
  const panel = document.createElement("div");
  panel.className = "account-status-panel usage-audit-status-panel";

  const status = summary?.querySelector(".usage-task-status")?.textContent?.trim() || "—";
  const meta = summary?.querySelector(".usage-account-email")?.textContent?.trim() || "—";
  panel.append(
    evidenceLine("任务状态", status),
    evidenceLine("任务摘要", meta)
  );
  fallback.append(panel);
  return fallback;
}

function showImmediateDetailModal(details, trigger) {
  if (!modalLayer || !modalBody || !modalTitle || !modalKicker) return 0;
  const summary = directSummary(details);
  if (!summary) return 0;

  captureCurrentModalView(trigger);
  lastTrigger = trigger instanceof HTMLElement ? trigger : summary;
  const heading = modalHeadingFromSummary(summary);
  modalKicker.textContent = heading.kicker;
  modalTitle.textContent = heading.title;
  modalBody.replaceChildren(makeImmediateDetailNode(details, summary));

  modalLayer.hidden = false;
  document.documentElement.classList.add("usage-detail-modal-open");
  if (modalCard) modalCard.scrollTop = 0;
  animateModalView();
  modalClose?.focus({ preventScroll: true });
  return ++detailRequestId;
}

function renderDetailModal(details, requestId) {
  if (!requestId || requestId !== detailRequestId || !modalLayer || modalLayer.hidden || !modalBody) return false;
  const source = detailBody(details);
  if (!source) return false;

  details.open = false;
  const clone = source.cloneNode(true);
  clone.classList.add("usage-modal-clone");
  modalBody.replaceChildren(clone);
  if (modalCard) modalCard.scrollTop = 0;
  animateModalView();
  return true;
}

function renderDetailError(summary, error, requestId) {
  if (!requestId || requestId !== detailRequestId || !modalLayer || modalLayer.hidden || !modalBody || !modalTitle || !modalKicker) return;
  console.error("usage task detail hydration failed", error);
  const heading = modalHeadingFromSummary(summary);
  modalKicker.textContent = heading.kicker === "DETAIL" ? "TASK DETAIL" : heading.kicker;
  modalTitle.textContent = heading.title === "详情" ? "任务详情" : heading.title;

  const source = summary?.parentElement instanceof HTMLDetailsElement ? detailBody(summary.parentElement) : null;
  if (source) {
    const clone = source.cloneNode(true);
    clone.classList.add("usage-modal-clone");
    modalBody.replaceChildren(clone);
  } else {
    const message = document.createElement("div");
    message.className = "usage-empty";
    message.textContent = "完整审计暂时无法读取，已保留当前任务摘要。";
    modalBody.replaceChildren(message);
  }
  animateModalView();
}

async function hydrateIfNeeded(details) {
  if (!details.matches(".usage-task-card")) return;
  if (details.dataset.hydrated === "true") return;

  const existing = hydratePromises.get(details);
  if (existing) return existing;

  const loader = window.UsageMonitorTaskDetail?.hydrate;
  if (typeof loader !== "function") throw new Error("task_detail_loader_unavailable");

  const promise = Promise.resolve(loader(details)).finally(() => hydratePromises.delete(details));
  hydratePromises.set(details, promise);
  return promise;
}

function rawTaskAudit(details) {
  const source = detailBody(details);
  if (!source) return null;
  const rawBlocks = [...source.querySelectorAll("details.usage-audit-raw")];
  for (const block of rawBlocks.reverse()) {
    const label = block.querySelector(":scope > summary")?.textContent || "";
    if (!label.includes("完整原始审计 JSON")) continue;
    const text = block.querySelector(":scope > pre")?.textContent || "";
    try {
      const payload = JSON.parse(text);
      if (payload && typeof payload === "object") return payload;
    } catch {
      return null;
    }
  }
  return null;
}

function bytesFromBase64(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function gunzipChunkedText(blob) {
  if (!blob || blob.encoding !== "gzip+base64-chunks" || !Array.isArray(blob.chunks)) return "";
  if (typeof DecompressionStream !== "function") throw new Error("browser_gzip_decoder_unavailable");
  const compressed = bytesFromBase64(blob.chunks.join(""));
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function lineCount(text) {
  if (!text) return 0;
  return String(text).split(/\r\n|\r|\n/).filter((_, index, parts) => index < parts.length - 1 || parts[index] !== "").length;
}

function evidenceSection(titleText) {
  const section = document.createElement("section");
  section.className = "usage-audit-detail-section usage-failure-evidence";
  const title = document.createElement("div");
  title.className = "usage-audit-detail-title";
  title.textContent = titleText;
  section.append(title);
  return section;
}

function evidenceLine(label, value, state = "neutral") {
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

function evidenceDetails(label, text) {
  const details = document.createElement("details");
  details.className = "usage-audit-raw";
  const summary = document.createElement("summary");
  summary.textContent = label;
  const pre = document.createElement("pre");
  pre.textContent = String(text || "—");
  details.append(summary, pre);
  return details;
}

async function enhanceFailureEvidence(details) {
  if (!details.matches(".usage-task-card")) return;
  const source = detailBody(details);
  if (!source || source.dataset.failureEvidenceHydrated === "true") return;

  const audit = rawTaskAudit(details);
  const diagnostic = audit?.result_data?.failure_diagnostic;
  if (!diagnostic || typeof diagnostic !== "object") {
    source.dataset.failureEvidenceHydrated = "true";
    return;
  }

  const section = evidenceSection("完整错误定位证据");
  const stageLog = diagnostic.stage_log && typeof diagnostic.stage_log === "object" ? diagnostic.stage_log : null;
  const panel = document.createElement("div");
  panel.className = "account-status-panel usage-audit-status-panel";
  panel.append(
    evidenceLine("Truth source", diagnostic.truth_source || "—", diagnostic.truth_source === "stage_log" ? "ok" : "warn"),
    evidenceLine("Stage log", diagnostic.stage_log_name || stageLog?.name || "—"),
    evidenceLine("日志行数", diagnostic.line_count ?? stageLog?.line_count ?? "—"),
    evidenceLine("日志字节", diagnostic.byte_count ?? stageLog?.byte_count ?? "—"),
    evidenceLine("Traceback 数", diagnostic.traceback_count ?? (Array.isArray(diagnostic.tracebacks) ? diagnostic.tracebacks.length : 0)),
    evidenceLine("Exception 数", diagnostic.exception_count ?? (Array.isArray(diagnostic.exceptions) ? diagnostic.exceptions.length : 0)),
    evidenceLine("SHA-256", diagnostic.sha256 || stageLog?.sha256 || "—")
  );
  section.append(panel);

  const exceptions = Array.isArray(diagnostic.exceptions) ? diagnostic.exceptions : [];
  if (exceptions.length) section.append(evidenceDetails(`全部 Exception · ${exceptions.length}`, JSON.stringify(exceptions, null, 2)));

  const tracebacks = Array.isArray(diagnostic.tracebacks) ? diagnostic.tracebacks : [];
  for (let index = 0; index < tracebacks.length; index += 1) {
    const traceback = tracebacks[index];
    try {
      const text = await gunzipChunkedText(traceback);
      section.append(evidenceDetails(
        `Traceback ${index + 1}/${tracebacks.length} · lines ${traceback?.start_line || "?"}-${traceback?.end_line || "?"}`,
        text
      ));
    } catch (error) {
      section.append(evidenceDetails(`Traceback ${index + 1}/${tracebacks.length} · 解码失败`, String(error?.message || error)));
    }
  }

  if (stageLog) {
    try {
      const text = await gunzipChunkedText(stageLog);
      const bytes = new TextEncoder().encode(text).byteLength;
      const lines = lineCount(text);
      const digest = await sha256Hex(text);
      const expectedBytes = Number(stageLog.byte_count ?? diagnostic.byte_count ?? -1);
      const expectedLines = Number(stageLog.line_count ?? diagnostic.line_count ?? -1);
      const expectedDigest = String(stageLog.sha256 || diagnostic.sha256 || "").toLowerCase();
      const byteOk = expectedBytes < 0 || expectedBytes === bytes;
      const lineOk = expectedLines < 0 || expectedLines === lines;
      const hashOk = !expectedDigest || expectedDigest === digest;
      const integrity = byteOk && lineOk && hashOk;
      panel.append(
        evidenceLine("完整性校验", integrity ? "PASS" : "FAILED", integrity ? "ok" : "warn"),
        evidenceLine("重建字节/行", `${bytes} B / ${lines} lines`, integrity ? "ok" : "warn")
      );
      section.append(evidenceDetails(`完整 Stage Log · ${stageLog.name || diagnostic.stage_log_name || "stage.log"}`, text));
    } catch (error) {
      panel.append(evidenceLine("完整 Stage Log 解码", `FAILED · ${String(error?.message || error)}`, "warn"));
    }
  }

  const rawAnchor = [...source.children].find((node) => node.matches?.("details.usage-audit-raw"));
  if (rawAnchor) source.insertBefore(section, rawAnchor);
  else source.append(section);
  source.dataset.failureEvidenceHydrated = "true";
}

document.addEventListener("click", async (event) => {
  const summary = event.target instanceof Element ? event.target.closest("summary") : null;
  if (!summary) return;
  const details = summary.parentElement;
  if (!isPortalDetail(details) || directSummary(details) !== summary) return;

  event.preventDefault();
  event.stopPropagation();

  const requestId = showImmediateDetailModal(details, summary);
  if (!requestId) return;

  try {
    await hydrateIfNeeded(details);
    if (requestId !== detailRequestId) return;

    renderDetailModal(details, requestId);
    await enhanceFailureEvidence(details);
    if (requestId !== detailRequestId) return;
    renderDetailModal(details, requestId);
  } catch (error) {
    renderDetailError(summary, error, requestId);
  }
}, true);

modalClose?.addEventListener("click", closeDetailModal);
modalMask?.addEventListener("click", closeDetailModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalLayer && !modalLayer.hidden) closeDetailModal();
});

window.addEventListener("pagehide", () => {
  detailRequestId += 1;
  modalViewStack.length = 0;
  if (modalLayer) modalLayer.hidden = true;
  document.documentElement.classList.remove("usage-detail-modal-open");
  modalBody?.replaceChildren();
});
