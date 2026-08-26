(() => {
  const SCAN_API = "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/lead-radar-scan";

  function num(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
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

  function render(result) {
    const panel = ensurePanel();
    if (!panel || !result || typeof result !== "object") return;

    const scanned = num(result.scanned);
    const fresh = num(result.fresh ?? result.scanned);
    const filtered = num(result.filtered);
    const stored = num(result.stored);
    const duplicates = num(result.duplicates);

    if (!scanned && !fresh && !filtered && !stored && !duplicates) return;

    panel.hidden = false;
    document.getElementById("scanSummaryScanned").textContent = String(scanned);
    document.getElementById("scanSummaryFresh").textContent = String(fresh);
    document.getElementById("scanSummaryFiltered").textContent = String(filtered);
    document.getElementById("scanSummaryStored").textContent = String(stored);

    const headline = stored > 0
      ? `新增 ${stored} 条潜客`
      : "没有帖子通过潜客筛选";
    document.getElementById("scanSummaryHeadline").textContent = headline;

    const notes = [];
    if (fresh > 0 && filtered > 0) notes.push(`${filtered} 条候选被规则 / AI 判定为非甲方需求`);
    if (duplicates > 0) notes.push(`${duplicates} 条已看过，已自动去重`);
    if (stored === 0 && scanned > 0) notes.push("机会列表只显示通过筛选的真实潜客，所以这里可能仍为 0");
    document.getElementById("scanSummaryNote").textContent = notes.join(" · ");
  }

  async function load() {
    try {
      const response = await fetch(`${SCAN_API}/api/v1/status`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const result = data?.latest_request?.result || data?.active_request?.result || data?.last_scan || null;
      render(result);
    } catch {}
  }

  load();
  window.setInterval(load, 10000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load();
  });
})();
