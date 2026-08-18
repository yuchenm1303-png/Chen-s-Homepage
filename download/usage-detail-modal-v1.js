const modalLayer = document.getElementById("usageDetailModal");
const modalMask = document.getElementById("usageDetailModalMask");
const modalClose = document.getElementById("usageDetailModalClose");
const modalKicker = document.getElementById("usageDetailModalKicker");
const modalTitle = document.getElementById("usageDetailModalTitle");
const modalBody = document.getElementById("usageDetailModalBody");

let lastTrigger = null;

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
  if (details.matches(".usage-task-card")) return true;
  if (details.matches("#deviceHealthPanel > .usage-diagnostic-item")) return true;
  if (details.matches("#diagnosticsPanel > .usage-diagnostic-item")) return true;
  return false;
}

function closeDetailModal() {
  if (!modalLayer || modalLayer.hidden) return;
  modalLayer.hidden = true;
  document.documentElement.classList.remove("usage-detail-modal-open");
  modalBody?.replaceChildren();
  if (lastTrigger instanceof HTMLElement && lastTrigger.isConnected) lastTrigger.focus({ preventScroll: true });
  lastTrigger = null;
}

function openDetailModal(details, trigger) {
  if (!modalLayer || !modalBody || !modalTitle || !modalKicker) return;
  const summary = directSummary(details);
  const source = detailBody(details);
  if (!summary || !source) return;

  details.open = false;
  lastTrigger = trigger instanceof HTMLElement ? trigger : summary;

  const kicker = summary.querySelector(".kicker")?.textContent?.trim();
  const title = summary.querySelector("h2, h3")?.textContent?.trim();
  modalKicker.textContent = kicker || "DETAIL";
  modalTitle.textContent = title || "详情";

  const clone = source.cloneNode(true);
  clone.classList.add("usage-modal-clone");
  modalBody.replaceChildren(clone);

  modalLayer.hidden = false;
  document.documentElement.classList.add("usage-detail-modal-open");
  modalClose?.focus({ preventScroll: true });
}

document.addEventListener("click", (event) => {
  const summary = event.target instanceof Element ? event.target.closest("summary") : null;
  if (!summary) return;
  const details = summary.parentElement;
  if (!isPortalDetail(details) || directSummary(details) !== summary) return;

  event.preventDefault();
  event.stopPropagation();
  openDetailModal(details, summary);
}, true);

modalClose?.addEventListener("click", closeDetailModal);
modalMask?.addEventListener("click", closeDetailModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalLayer && !modalLayer.hidden) closeDetailModal();
});

window.addEventListener("pagehide", closeDetailModal);
