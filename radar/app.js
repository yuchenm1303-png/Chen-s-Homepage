const API_BASE = "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/lead-radar-api";
const SCAN_API_BASE = "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/lead-radar-scan";
const labels = { new: "新发现", saved: "已收藏", contacted: "已联系", ignored: "已忽略" };
const urgencyLabels = { low: "普通", medium: "较急", high: "紧急" };
let leads = [];
let currentFilter = "high";
let activeLeadId = null;
let activeScanRequestId = null;
let scanPollTimer = null;
let apiLoading = true;
let apiError = "";
const $ = (id) => document.getElementById(id);
const leadList = $("leadList"), resultCount = $("resultCount"), highCount = $("highCount"), heroHighCount = $("heroHighCount"), newCount = $("newCount"), savedCount = $("savedCount"), contactedCount = $("contactedCount"), searchInput = $("searchInput"), scanButton = $("scanButton"), scanButtonText = $("scanButtonText"), scanStatus = $("scanStatus"), scanPulse = $("scanPulse"), lastScan = $("lastScan"), toast = $("toast"), leadModal = $("leadModal"), leadModalClose = $("leadModalClose"), leadModalTitle = $("leadModalTitle"), leadModalKicker = $("leadModalKicker"), leadModalBody = $("leadModalBody"), importButton = $("importButton"), serviceStatusText = $("serviceStatusText");

function escapeHTML(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function safeUrl(value) { if (!value) return ""; try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } }
async function requestJson(base, path, options = {}) { const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 12000); try { const response = await fetch(`${base}${path}`, { cache: "no-store", ...options, signal: controller.signal, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.detail || `API ${response.status}`); error.status = response.status; error.retryAfterSeconds = Number(data.retry_after_seconds || 0); throw error; } return data; } finally { window.clearTimeout(timeout); } }
async function api(path, options = {}) { return requestJson(API_BASE, path, options); }
async function scanApi(path, options = {}) { return requestJson(SCAN_API_BASE, path, options); }
function formatAge(value) { if (!value) return "发布时间未知"; const timestamp = new Date(value).getTime(); if (!Number.isFinite(timestamp)) return "发布时间未知"; const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000)); if (minutes < 1) return "刚刚"; if (minutes < 60) return `${minutes} 分钟前`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} 小时前`; const days = Math.floor(hours / 24); if (days < 30) return `${days} 天前`; return new Date(value).toLocaleDateString("zh-CN"); }
function formatDateTime(value) { if (!value) return "—"; const date = new Date(value); if (!Number.isFinite(date.getTime())) return "—"; return date.toLocaleString("zh-CN", { hour12: false }); }
function nextStepFor(lead) { if (lead.score >= 90) return "优先打开原帖确认细节，先问范围、交付时间与预算，再给出最小可行方案和报价。"; if (lead.urgency === "high") return "尽快确认数据/功能边界和交付时间，避免在需求仍模糊时直接报价。"; if (lead.score >= 80) return "值得跟进，先确认核心功能、预算区间和上线时间，再判断是否进入报价。"; return "先收藏观察；补充需求、预算或明确交付信号后再决定是否联系。"; }
function normalizeLead(raw) { return { id: Number(raw.id), source: raw.source || "公开来源", title: raw.title || "未命名需求", excerpt: raw.excerpt || "", category: raw.category || "其他开发", score: Number(raw.score || 0), intent: Number(raw.intent_score || 0), clarity: Number(raw.confidence || 0), fit: Number(raw.fit_score || 0), freshness: Number(raw.freshness_score || 0), urgency: raw.urgency || "low", age: formatAge(raw.published_at), publishedAt: raw.published_at || null, discoveredAt: raw.discovered_at || raw.created_at || null, budget: raw.budget || "未公开", status: labels[raw.status] ? raw.status : "new", signals: Array.isArray(raw.signals) ? raw.signals : [], reason: raw.reason || "当前没有额外判断说明。", priority: raw.priority || "low", url: safeUrl(raw.url), nextStep: "" }; }
function showToast(message) { if (!toast) return; toast.textContent = message; toast.classList.add("show"); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3000); }
function priorityLabel(lead) { if (lead.priority === "high" || lead.score >= 90) return "优先联系"; if (lead.score >= 80) return "值得跟进"; return "低优先"; }
function updateCounts() { const high = leads.filter((lead) => lead.score >= 80 && lead.status !== "ignored").length; highCount.textContent = String(high); heroHighCount.textContent = String(high); newCount.textContent = String(leads.filter((lead) => lead.status === "new").length); savedCount.textContent = String(leads.filter((lead) => lead.status === "saved").length); contactedCount.textContent = String(leads.filter((lead) => lead.status === "contacted").length); }
function matchesFilter(lead) { if (currentFilter === "all") return true; if (currentFilter === "high") return lead.score >= 80 && lead.status !== "ignored"; return lead.status === currentFilter; }
function actionClass(lead, status, primary = false) { const classes = ["login-button", "cards", "radar-action"]; if (primary) classes.push("is-primary"); if (lead.status === status) classes.push("is-current"); return classes.join(" "); }

function render() {
  updateCounts();
  if (apiLoading) { resultCount.textContent = "—"; leadList.innerHTML = '<div class="empty-state radar-loading-state">正在读取真实潜客数据库…</div>'; return; }
  if (apiError) { resultCount.textContent = "0"; leadList.innerHTML = `<div class="empty-state radar-error-state"><div><strong>真实 Lead API 暂不可用</strong><p>${escapeHTML(apiError)}</p><button class="login-button cards radar-retry-button" id="retryLoadButton" type="button">重新连接</button></div></div>`; $("retryLoadButton")?.addEventListener("click", () => loadLeads()); return; }
  const query = searchInput.value.trim().toLowerCase();
  const visible = leads.filter((lead) => { const haystack = `${lead.title} ${lead.excerpt} ${lead.category} ${lead.source} ${lead.budget} ${lead.signals.join(" ")}`.toLowerCase(); return (!query || haystack.includes(query)) && matchesFilter(lead); }).sort((a, b) => b.score - a.score || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  resultCount.textContent = String(visible.length);
  if (!visible.length) { const copy = leads.length ? "没有符合当前筛选条件的项目。换个关键词或筛选条件试试。" : "数据库暂时没有通过筛选的潜客。可以点击“立即扫描”发现最新公开需求，或手动导入你已经看到的公开帖子。"; leadList.innerHTML = `<div class="empty-state">${copy}</div>`; return; }
  leadList.innerHTML = visible.map((lead) => {
    const originalLink = lead.url ? `<a class="release-badge radar-source-link" href="${escapeHTML(lead.url)}" target="_blank" rel="noopener noreferrer">打开原帖 ↗</a>` : "";
    return `<article class="lead-card cards fade"><div class="lead-rank"><span class="lead-score-label">AI SCORE</span><div class="lead-score-value"><strong>${lead.score}</strong><small>/100</small></div><div class="score-track" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, lead.score))}%"></i></div></div><div class="lead-main"><div class="lead-topline"><span class="release-badge">${escapeHTML(lead.source)}</span><span>${escapeHTML(lead.age)}</span><span class="release-badge">${escapeHTML(labels[lead.status])}</span><button class="release-badge filter-chip" type="button" data-view-id="${lead.id}">查看分析 ↗</button>${originalLink}</div><h3>${escapeHTML(lead.title)}</h3><p>${escapeHTML(lead.excerpt)}</p><div class="lead-context"><span>${escapeHTML(lead.category)}</span><span>${escapeHTML(lead.budget)}</span><span>${escapeHTML(priorityLabel(lead))}</span></div><div class="signal-row">${lead.signals.map((s) => `<span class="release-badge">${escapeHTML(s)}</span>`).join("")}</div></div><div class="lead-actions"><button class="${actionClass(lead, "contacted", true)}" type="button" data-id="${lead.id}" data-status="contacted">已联系</button><button class="${actionClass(lead, "saved")}" type="button" data-id="${lead.id}" data-status="saved">收藏</button><button class="${actionClass(lead, "ignored")}" type="button" data-id="${lead.id}" data-status="ignored">忽略</button></div></article>`;
  }).join("");
  leadList.querySelectorAll("button[data-status]").forEach((button) => button.addEventListener("click", async () => setLeadStatus(leads.find((x) => x.id === Number(button.dataset.id)), button.dataset.status, button)));
  leadList.querySelectorAll("button[data-view-id]").forEach((button) => button.addEventListener("click", () => { const lead = leads.find((x) => x.id === Number(button.dataset.viewId)); if (lead) openLeadModal(lead); }));
}

async function loadLeads({ silent = false } = {}) { if (!silent) apiLoading = true; apiError = ""; render(); try { const data = await api("/api/v1/leads?limit=200"); leads = Array.isArray(data) ? data.map(normalizeLead) : []; leads.forEach((lead) => { lead.nextStep = nextStepFor(lead); }); apiLoading = false; if (serviceStatusText) serviceStatusText.textContent = "Radar Online"; render(); } catch (error) { apiLoading = false; apiError = error.name === "AbortError" ? "连接超时，请稍后重试。" : (error.message || "无法连接 API"); if (serviceStatusText) serviceStatusText.textContent = "API Offline"; scanStatus.textContent = "API 暂不可用"; render(); } }
function stopScanPolling() { if (scanPollTimer) window.clearTimeout(scanPollTimer); scanPollTimer = null; }
function scheduleScanPolling() { stopScanPolling(); scanPollTimer = window.setTimeout(async () => { await loadMonitorStatus(); }, 8000); }
function scanCompletionMessage(request) { const result = request?.result || {}; const scanned = Number(result.scanned || 0), stored = Number(result.stored || 0), filtered = Number(result.filtered || 0), duplicates = Number(result.duplicates || 0); if (stored > 0) return `扫描完成 · 检查 ${scanned} 条 · 新增 ${stored} 条潜客`; return `扫描完成 · 检查 ${scanned} 条 · 暂无新潜客（过滤 ${filtered} · 重复 ${duplicates}）`; }
async function loadMonitorStatus() {
  try {
    const [queueStatus, monitor] = await Promise.all([scanApi("/api/v1/status"), api("/api/v1/monitor/status")]);
    if ($("scannerPlatform")) $("scannerPlatform").textContent = queueStatus.platform || "小红书 · Just One V4";
    if ($("scannerProvider")) $("scannerProvider").textContent = String(monitor.ai_provider || "rules").toUpperCase();
    lastScan.textContent = queueStatus.last_scan_at ? formatAge(queueStatus.last_scan_at) : "等待首次扫描";

    const active = queueStatus.active_request;
    if (active?.id) activeScanRequestId = Number(active.id);
    if (queueStatus.running) {
      scanStatus.textContent = "扫描处理中";
      scanButtonText.textContent = "扫描中…";
      scanButton.disabled = true;
      scanPulse.classList.add("is-scanning");
      scheduleScanPolling();
      return queueStatus;
    }
    if (queueStatus.queued) {
      scanStatus.textContent = "已排队 · 等待采集";
      scanButtonText.textContent = "已排队";
      scanButton.disabled = true;
      scanPulse.classList.add("is-scanning");
      scheduleScanPolling();
      return queueStatus;
    }

    stopScanPolling();
    scanPulse.classList.remove("is-scanning");
    const completedRequest = activeScanRequestId && Number(queueStatus.latest_request?.id) === Number(activeScanRequestId) ? queueStatus.latest_request : null;
    if (completedRequest) {
      activeScanRequestId = null;
      if (completedRequest.status === "success") {
        showToast(scanCompletionMessage(completedRequest));
        await loadLeads({ silent: true });
      } else if (completedRequest.status === "failed") {
        showToast(`扫描失败：${completedRequest.error || "采集任务执行失败"}`);
      }
    }

    if (queueStatus.queue_available) {
      scanStatus.textContent = "实时采集就绪";
      scanButtonText.textContent = "立即扫描";
      scanButton.disabled = false;
    } else {
      scanStatus.textContent = "额度保护中";
      scanButtonText.textContent = "稍后再扫";
      scanButton.disabled = true;
    }
    return queueStatus;
  } catch (error) {
    stopScanPolling();
    scanPulse.classList.remove("is-scanning");
    scanStatus.textContent = "扫描服务暂不可用";
    scanButtonText.textContent = "立即扫描";
    scanButton.disabled = false;
    throw error;
  }
}
async function setLeadStatus(lead, status, button = null) { if (!lead || !labels[status]) return; if (button) button.disabled = true; try { const updated = normalizeLead(await api(`/api/v1/leads/${lead.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) })); updated.nextStep = nextStepFor(updated); const index = leads.findIndex((x) => x.id === lead.id); if (index >= 0) leads[index] = updated; render(); showToast(`已写入数据库：${labels[updated.status]}`); if (activeLeadId === updated.id && leadModal && !leadModal.hidden) renderLeadModal(updated); } catch (error) { showToast(`状态保存失败：${error.message || "网络错误"}`); } finally { if (button) button.disabled = false; } }

function renderLeadModal(lead) {
  const originalActions = lead.url ? `<div class="radar-source-actions"><a class="login-button cards radar-action is-primary" href="${escapeHTML(lead.url)}" target="_blank" rel="noopener noreferrer">打开原帖 ↗</a><button class="login-button cards radar-action" type="button" data-copy-url>复制链接</button></div>` : "";
  leadModalKicker.textContent = `${lead.source} · ${lead.age} · ${lead.category}`; leadModalTitle.textContent = lead.title;
  leadModalBody.innerHTML = `<div class="release-head"><span class="release-badge">AI SCORE · ${lead.score} / 100</span><span class="release-badge">${escapeHTML(priorityLabel(lead))}</span></div><p>${escapeHTML(lead.excerpt)}</p><div class="release-meta radar-analysis-grid"><div class="meta-item"><span>需求意向</span><strong>${lead.intent} / 100</strong></div><div class="meta-item"><span>能力匹配</span><strong>${lead.fit} / 100</strong></div><div class="meta-item"><span>时效评分</span><strong>${lead.freshness} / 100</strong></div><div class="meta-item"><span>判断置信度</span><strong>${lead.clarity} / 100</strong></div></div><div class="spec-row"><span>紧急度</span><strong>${escapeHTML(urgencyLabels[lead.urgency] || lead.urgency)}</strong></div><div class="spec-row"><span>预算信号</span><strong>${escapeHTML(lead.budget)}</strong></div><div class="spec-row"><span>发布时间</span><strong>${escapeHTML(formatDateTime(lead.publishedAt))}</strong></div><div class="spec-row"><span>发现时间</span><strong>${escapeHTML(formatDateTime(lead.discoveredAt))}</strong></div><div class="spec-row"><span>当前状态</span><strong>${escapeHTML(labels[lead.status])}</strong></div><div class="spec-row radar-reason-row"><span>AI 判断</span><strong>${escapeHTML(lead.reason)}</strong></div><div class="spec-row radar-reason-row"><span>建议动作</span><strong>${escapeHTML(lead.nextStep)}</strong></div><div class="signal-row">${lead.signals.map((s) => `<span class="release-badge">${escapeHTML(s)}</span>`).join("")}</div>${originalActions}<div class="lead-actions radar-modal-status-actions"><button class="${actionClass(lead, "contacted", true)}" type="button" data-modal-status="contacted">标记已联系</button><button class="${actionClass(lead, "saved")}" type="button" data-modal-status="saved">收藏机会</button><button class="${actionClass(lead, "ignored")}" type="button" data-modal-status="ignored">忽略机会</button></div>`;
  leadModalBody.querySelectorAll("button[data-modal-status]").forEach((button) => button.addEventListener("click", async () => setLeadStatus(lead, button.dataset.modalStatus, button)));
  leadModalBody.querySelector("[data-copy-url]")?.addEventListener("click", () => copyUrl(lead.url));
}
function openLeadModal(lead) { activeLeadId = lead.id; renderLeadModal(lead); leadModal.hidden = false; document.body.style.overflow = "hidden"; window.setTimeout(() => leadModalClose?.focus(), 0); }
function closeLeadModal() { if (!leadModal || leadModal.hidden) return; leadModal.hidden = true; activeLeadId = null; document.body.style.overflow = ""; }
async function copyUrl(url) { if (!url) return; try { await navigator.clipboard.writeText(url); } catch { const textarea = document.createElement("textarea"); textarea.value = url; textarea.style.position = "fixed"; textarea.style.opacity = "0"; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove(); } showToast("原帖链接已复制"); }

function createImportModal() {
  const layer = document.createElement("div"); layer.className = "modal-layer"; layer.id = "importModal"; layer.hidden = true;
  layer.innerHTML = `<div class="modal-mask" data-close-import-modal></div><article class="modal-card cards radar-import-modal" role="dialog" aria-modal="true" aria-labelledby="importModalTitle"><button class="modal-close" id="importModalClose" type="button" aria-label="关闭导入">×</button><p class="modal-kicker">SAFE SOURCE INGEST</p><h2 id="importModalTitle">导入公开需求</h2><p class="radar-import-intro">把你已经能正常看到的公开帖子信息粘进来。系统只保存判断所需的最小字段，并自动去重、过滤和评分。</p><form id="importForm" class="radar-import-form"><div class="radar-form-grid"><label><span>来源</span><input id="importSource" value="小红书" maxlength="40" required></label><label><span>发布时间</span><input id="importPublishedAt" type="datetime-local" required></label></div><label><span>需求标题 *</span><input id="importTitle" maxlength="240" placeholder="例如：有没有会做微信小程序的，有偿" required></label><label><span>帖子摘要</span><textarea id="importExcerpt" rows="4" maxlength="1600" placeholder="只粘贴判断需求所需的公开文字"></textarea></label><div class="radar-form-grid"><label><span>原帖链接</span><input id="importUrl" type="url" placeholder="https://..."></label><label><span>预算信息</span><input id="importBudget" maxlength="100" placeholder="如：预算可聊"></label></div><div class="radar-import-note">不会自动私信、评论或关注，也不会绕验证码、登录保护或平台风控。</div><button class="download-button cards radar-import-submit" id="importSubmit" type="submit"><span class="download-copy"><strong>分析并入库</strong><small>prefilter → score → dedupe → store</small></span><span class="download-arrow">→</span></button></form></article>`;
  document.body.appendChild(layer); const close = () => { layer.hidden = true; document.body.style.overflow = ""; }; $("importModalClose")?.addEventListener("click", close); layer.querySelector("[data-close-import-modal]")?.addEventListener("click", close); $("importForm")?.addEventListener("submit", submitImport); return { layer, close };
}
const importDialog = createImportModal();
function openImportModal() { const field = $("importPublishedAt"); if (field && !field.value) { const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); field.value = now.toISOString().slice(0, 16); } importDialog.layer.hidden = false; document.body.style.overflow = "hidden"; window.setTimeout(() => $("importTitle")?.focus(), 0); }
async function submitImport(event) { event.preventDefault(); const submit = $("importSubmit"); if (submit) submit.disabled = true; try { const payload = { items: [{ source: $("importSource").value.trim() || "小红书", title: $("importTitle").value.trim(), excerpt: $("importExcerpt").value.trim(), url: $("importUrl").value.trim() || null, published_at: new Date($("importPublishedAt").value).toISOString(), budget: $("importBudget").value.trim() || null }] }; const result = await api("/api/v1/ingest/manual", { method: "POST", body: JSON.stringify(payload) }); if (result.stored > 0) { showToast(`已分析并入库 ${result.stored} 条需求`); $("importForm").reset(); importDialog.close(); await loadLeads({ silent: true }); } else if (result.duplicates > 0) { showToast("这条需求已经在数据库中，没有重复入库"); } else showToast("未通过需求筛选：更像学习/讨论或购买意向不足"); } catch (error) { showToast(`导入失败：${error.message || "网络错误"}`); } finally { if (submit) submit.disabled = false; } }

document.querySelectorAll(".radar-filters .filter-chip[data-filter]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll(".radar-filters .filter-chip[data-filter]").forEach((x) => x.classList.remove("active")); button.classList.add("active"); currentFilter = button.dataset.filter || "all"; render(); }));
searchInput.addEventListener("input", render); leadModalClose?.addEventListener("click", closeLeadModal); leadModal?.querySelector("[data-close-lead-modal]")?.addEventListener("click", closeLeadModal); importButton?.addEventListener("click", openImportModal);
document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; if (!importDialog.layer.hidden) importDialog.close(); else closeLeadModal(); });
scanButton.addEventListener("click", async () => {
  if (scanButton.disabled) return;
  scanButton.disabled = true;
  scanButtonText.textContent = "提交中…";
  scanPulse.classList.add("is-scanning");
  scanStatus.textContent = "正在提交安全扫描";
  try {
    const result = await scanApi("/api/v1/request", { method: "POST" });
    if (result.request?.id) activeScanRequestId = Number(result.request.id);
    showToast(result.existing ? "已有扫描任务 · 继续跟踪当前任务" : "已排队 · GitHub 安全采集器将在约 5 分钟内处理");
  } catch (error) {
    scanPulse.classList.remove("is-scanning");
    scanStatus.textContent = error.status === 429 ? "额度保护中" : "扫描请求失败";
    showToast(error.message || "扫描请求失败");
  } finally {
    try { await loadMonitorStatus(); } catch { scanButtonText.textContent = "立即扫描"; scanButton.disabled = false; }
  }
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "visible") return; Promise.allSettled([loadLeads({ silent: true }), loadMonitorStatus()]); });
window.addEventListener("beforeunload", stopScanPolling);
apiLoading = true; render(); Promise.allSettled([loadLeads(), loadMonitorStatus()]);
