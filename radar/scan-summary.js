(() => {
  const SCAN_API = "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/lead-radar-scan";

  function num(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function friendlyError(value) {
    const text = String(value || "").trim();
    if (/INSUFFICIENT BALANCE|business code 601/i.test(text)) return "Just One 余额不足，本次扫描未返回任何帖子。";
    return text || "采集任务执行失败，本次扫描没有产生帖子。";
  }

  function renderRetrievalMeta(status) {
    const meta = document.getElementById("scanButtonMeta");
    if (!meta) return;
    const retrieval = status?.retrieval && typeof status.retrieval === "object" ? status.retrieval : null;
    const queries = num(retrieval?.manual_queries_per_scan);
    const calls = num(retrieval?.manual_provider_calls_per_scan);
    if (queries > 0 && calls > 0) {
      meta.textContent = `${queries} 路检索 · 最多 ${calls} 次调用`;
      return;
    }
    meta.textContent = status?.retrieval_version ? "多路检索 · 智能调度" : "多路检索";
  }

  function ensurePanel() {
    let panel = document.getElementById("scanSummaryPanel");
    if (panel) return panel;
    const consoleCard = document.querySelector(".radar-scan-console");
    const consoleData = consoleCard?.querySelector(".console-data");
    if (!consoleCard || !consoleData) return null;

    panel = document.createElement("section");
    panel.id = "scanSummaryPanel";
    panel.className = "scan-summary-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="scan-summary-head">
        <span>本次扫描</span>
        <strong id="scanSummaryHeadline">—</strong>
      </div>
      <div class="scan-summary-grid">
        <div><span>原始</span><strong id="scanSummaryScanned">0</strong></div>
        <div><span>24H 新鲜</span><strong id="scanSummaryFresh">0</strong></div>
        <div><span>过滤</span><strong id="scanSummaryFiltered">0</strong></div>
        <div><span>新增潜客</span><strong id="scanSummaryStored">0</strong></div>
      </div>
      <p id="scanSummaryNote"></p>`;
    consoleData.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function setNumbers(scanned, fresh, filtered, stored) {
    document.getElementById("scanSummaryScanned").textContent = String(scanned);
    document.getElementById("scanSummaryFresh").textContent = String(fresh);
    document.getElementById("scanSummaryFiltered").textContent = String(filtered);
    document.getElementById("scanSummaryStored").textContent = String(stored);
  }

  function renderSuccess(result) {
    const panel = ensurePanel();
    if (!panel || !result || typeof result !== "object") return;

    const scanned = num(result.scanned);
    const fresh = num(result.fresh ?? result.scanned);
    const filtered = num(result.filtered);
    const stored = num(result.stored);
    const duplicates = num(result.duplicates);

    if (!scanned && !fresh && !filtered && !stored && !duplicates) return;

    panel.hidden = false;
    panel.classList.remove("is-error");
    setNumbers(scanned, fresh, filtered, stored);

    document.getElementById("scanSummaryHeadline").textContent = stored > 0
      ? `新增 ${stored} 条潜客`
      : "没有帖子通过潜客筛选";

    const notes = [];
    const queryCount = Array.isArray(result.queries) ? result.queries.length : (result.query ? 1 : 0);
    const providerCalls = num(result.provider_calls);
    if (queryCount > 0) notes.push(`${queryCount} 路检索${providerCalls > 0 ? ` · ${providerCalls} 次 API 调用` : ""}`);
    if (fresh > 0 && filtered > 0) notes.push(`${filtered} 条候选被规则 / AI 判定为非甲方需求`);
    if (duplicates > 0) notes.push(`${duplicates} 条已看过，已自动去重`);
    if (stored === 0 && scanned > 0) notes.push("机会列表只显示通过筛选的真实潜客，所以这里可能仍为 0");
    document.getElementById("scanSummaryNote").textContent = notes.join(" · ");
  }

  function renderFailure(request, status) {
    const panel = ensurePanel();
    if (!panel) return;
    const message = friendlyError(request?.error);
    panel.hidden = false;
    panel.classList.add("is-error");
    setNumbers("—", "—", "—", "—");
    document.getElementById("scanSummaryHeadline").textContent = "本次扫描失败";
    document.getElementById("scanSummaryNote").textContent = `${message} 上方旧统计不代表本次请求。`;

    const scanStatus = document.getElementById("scanStatus");
    const scanButton = document.getElementById("scanButton");
    const scanButtonText = document.getElementById("scanButtonText");
    if (scanStatus) scanStatus.textContent = /余额不足/.test(message) ? "Just One 余额不足" : "扫描失败";
    if (scanButtonText) scanButtonText.textContent = status?.queue_available ? "重试扫描" : "稍后重试";
    if (scanButton) scanButton.disabled = !status?.queue_available;
  }

  async function load() {
    try {
      const response = await fetch(`${SCAN_API}/api/v1/status`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      renderRetrievalMeta(data);
      const latest = data?.latest_request || null;
      if (latest?.status === "failed") {
        renderFailure(latest, data);
        return;
      }
      const result = latest?.result || data?.active_request?.result || data?.last_scan || null;
      renderSuccess(result);
    } catch {}
  }

  load();
  window.setInterval(load, 5000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load();
  });
})();
