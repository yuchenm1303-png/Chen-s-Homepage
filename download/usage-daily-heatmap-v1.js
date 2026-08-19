const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const auth = config.auth ?? {};
const STYLE_ID = "usage-daily-heatmap-style";
const CARD_ID = "dailyHeatmapCard";
const REFRESH_MS = 5 * 60 * 1000;

let client = null;
let timer = null;

function asNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .usage-daily-heatmap-card {
      margin-top: 10px;
      padding: 18px;
    }
    .usage-daily-heatmap-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
    }
    .usage-daily-heatmap-head h2 {
      margin: 4px 0 0;
      font-size: 1rem;
      line-height: 1.15;
    }
    .usage-daily-heatmap-summary {
      margin-top: 5px;
      color: var(--soft);
      font-size: .61rem;
      line-height: 1.45;
    }
    .usage-daily-heatmap-scroll {
      margin-top: 14px;
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 4px;
      scrollbar-width: thin;
    }
    .usage-daily-heatmap-frame {
      width: max-content;
      min-width: 100%;
      display: grid;
      grid-template-columns: 28px auto;
      grid-template-rows: 18px auto;
      column-gap: 7px;
      row-gap: 4px;
      align-items: start;
    }
    .usage-daily-months {
      grid-column: 2;
      display: grid;
      gap: 3px;
      min-height: 16px;
      color: var(--soft);
      font-size: .49rem;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .usage-daily-months span {
      align-self: end;
      white-space: nowrap;
    }
    .usage-daily-weekdays {
      grid-row: 2;
      display: grid;
      grid-template-rows: repeat(7, 12px);
      gap: 3px;
      color: var(--soft);
      font-size: .46rem;
      line-height: 12px;
      text-align: right;
    }
    .usage-daily-grid {
      grid-column: 2;
      grid-row: 2;
      display: grid;
      grid-auto-flow: column;
      grid-template-rows: repeat(7, 12px);
      grid-auto-columns: 12px;
      gap: 3px;
    }
    .usage-daily-cell {
      position: relative;
      width: 12px;
      height: 12px;
      border: 0;
      border-radius: 2px;
      background: rgba(255, 255, 255, .07);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .045);
    }
    .usage-daily-cell[data-level="1"] { background: rgba(86, 199, 166, .26); }
    .usage-daily-cell[data-level="2"] { background: rgba(86, 199, 166, .46); }
    .usage-daily-cell[data-level="3"] { background: rgba(86, 199, 166, .68); }
    .usage-daily-cell[data-level="4"] { background: rgba(86, 199, 166, .94); }
    .usage-daily-cell[data-failed="true"]::after {
      content: "";
      position: absolute;
      inset: 1px;
      border-radius: 1px;
      box-shadow: inset 0 0 0 1px rgba(255, 191, 126, .95);
      pointer-events: none;
    }
    .usage-daily-cell.is-padding {
      visibility: hidden;
      pointer-events: none;
    }
    .usage-daily-heatmap-footer {
      margin-top: 11px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      color: var(--soft);
      font-size: .54rem;
    }
    .usage-daily-legend {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .usage-daily-legend-cell {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      background: rgba(255,255,255,.07);
    }
    .usage-daily-legend-cell[data-level="1"] { background: rgba(86, 199, 166, .26); }
    .usage-daily-legend-cell[data-level="2"] { background: rgba(86, 199, 166, .46); }
    .usage-daily-legend-cell[data-level="3"] { background: rgba(86, 199, 166, .68); }
    .usage-daily-legend-cell[data-level="4"] { background: rgba(86, 199, 166, .94); }
    .usage-daily-failure-key {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      box-shadow: inset 0 0 0 1px rgba(255, 191, 126, .95);
    }
    @media (max-width: 680px) {
      .usage-daily-heatmap-card { padding: 15px; }
      .usage-daily-heatmap-head { display: block; }
      .usage-daily-heatmap-head .secure-pill { margin-top: 9px; }
    }
  `;
  document.head.append(style);
}

function ensureCard() {
  const existing = document.getElementById(CARD_ID);
  if (existing) return existing;
  const section = document.getElementById("activitySection");
  if (!section) return null;

  const card = document.createElement("article");
  card.id = CARD_ID;
  card.className = "account-card cards usage-daily-heatmap-card";
  card.innerHTML = `
    <div class="usage-daily-heatmap-head">
      <div>
        <p class="kicker">365D DAILY ACTIVITY</p>
        <h2>年度使用热力图</h2>
        <p class="usage-daily-heatmap-summary" data-role="summary">正在读取每天的商品任务记录…</p>
      </div>
      <span class="secure-pill" data-role="timezone">UTC+8</span>
    </div>
    <div class="usage-daily-heatmap-scroll">
      <div class="usage-daily-heatmap-frame" data-role="frame">
        <div></div>
        <div class="usage-daily-months" data-role="months"></div>
        <div class="usage-daily-weekdays" aria-hidden="true">
          <span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span>
        </div>
        <div class="usage-daily-grid" data-role="grid" aria-label="过去365天每日商品任务热力图"></div>
      </div>
    </div>
    <div class="usage-daily-heatmap-footer">
      <span data-role="footnote">每个 Batch Supplier Link 独立计数</span>
      <span class="usage-daily-legend">
        <span>少</span>
        <i class="usage-daily-legend-cell" data-level="0"></i>
        <i class="usage-daily-legend-cell" data-level="1"></i>
        <i class="usage-daily-legend-cell" data-level="2"></i>
        <i class="usage-daily-legend-cell" data-level="3"></i>
        <i class="usage-daily-legend-cell" data-level="4"></i>
        <span>多</span>
        <i class="usage-daily-failure-key"></i>
        <span>有失败</span>
      </span>
    </div>
  `;
  section.append(card);
  return card;
}

function dateFromKey(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function keyFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function mondayIndex(date) {
  return (date.getUTCDay() + 6) % 7;
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", timeZone: "UTC" }).format(date);
}

function displayDate(key) {
  const date = dateFromKey(key);
  if (!date) return key;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "UTC"
  }).format(date);
}

function quantile(sorted, fraction) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function thresholds(days) {
  const values = days.map((day) => asNumber(day?.tasks)).filter((value) => value > 0).sort((a, b) => a - b);
  return [quantile(values, .25), quantile(values, .5), quantile(values, .75)];
}

function levelFor(value, cuts) {
  if (value <= 0) return 0;
  if (value <= cuts[0]) return 1;
  if (value <= cuts[1]) return 2;
  if (value <= cuts[2]) return 3;
  return 4;
}

function renderHeatmap(payload) {
  const card = ensureCard();
  if (!card) return;
  const days = Array.isArray(payload?.days) ? payload.days : [];
  const summary = card.querySelector('[data-role="summary"]');
  const timezone = card.querySelector('[data-role="timezone"]');
  const grid = card.querySelector('[data-role="grid"]');
  const months = card.querySelector('[data-role="months"]');
  const frame = card.querySelector('[data-role="frame"]');
  if (!grid || !months || !frame) return;

  if (!days.length) {
    summary.textContent = "暂无每日记录";
    grid.replaceChildren();
    months.replaceChildren();
    return;
  }

  const first = dateFromKey(days[0]?.date);
  const last = dateFromKey(days[days.length - 1]?.date);
  if (!first || !last) return;
  const start = addDays(first, -mondayIndex(first));
  const end = addDays(last, 6 - mondayIndex(last));
  const weekCount = Math.floor((end.getTime() - start.getTime()) / (7 * 86400000)) + 1;
  months.style.gridTemplateColumns = `repeat(${weekCount}, 12px)`;

  const byDate = new Map(days.map((day) => [String(day?.date || ""), day]));
  const cuts = thresholds(days);
  const cells = [];
  let cursor = start;
  while (cursor <= end) {
    const key = keyFromDate(cursor);
    const day = byDate.get(key);
    const cell = document.createElement("span");
    cell.className = "usage-daily-cell";
    if (!day) {
      cell.classList.add("is-padding");
    } else {
      const tasks = asNumber(day.tasks);
      const failed = asNumber(day.failed);
      cell.dataset.level = String(levelFor(tasks, cuts));
      cell.dataset.failed = failed > 0 ? "true" : "false";
      cell.title = [
        displayDate(key),
        `商品任务 ${tasks}`,
        `成功 ${asNumber(day.success)}`,
        `失败 ${failed}`,
        `复核 ${asNumber(day.review)}`,
        `运行中 ${asNumber(day.running)}`,
        `Single ${asNumber(day.single)}`,
        `Batch ${asNumber(day.batch)}`,
        `活跃客户 ${asNumber(day.active_accounts)}`,
        `启动 ${asNumber(day.launches)}`,
        `Crash ${asNumber(day.crashes)}`
      ].join(" · ");
    }
    cells.push(cell);
    cursor = addDays(cursor, 1);
  }
  grid.replaceChildren(...cells);

  const monthNodes = [];
  const seen = new Set();
  days.forEach((day) => {
    const date = dateFromKey(day?.date);
    if (!date || date.getUTCDate() !== 1) return;
    const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    if (seen.has(monthKey)) return;
    seen.add(monthKey);
    const week = Math.floor((date.getTime() - start.getTime()) / (7 * 86400000));
    const label = document.createElement("span");
    label.textContent = monthLabel(date);
    label.style.gridColumn = `${week + 1} / span 4`;
    monthNodes.push(label);
  });
  months.replaceChildren(...monthNodes);

  const totals = days.reduce((acc, day) => {
    acc.tasks += asNumber(day.tasks);
    acc.success += asNumber(day.success);
    acc.failed += asNumber(day.failed);
    acc.activeDays += (asNumber(day.tasks) > 0 || asNumber(day.launches) > 0 || asNumber(day.active_accounts) > 0) ? 1 : 0;
    return acc;
  }, { tasks: 0, success: 0, failed: 0, activeDays: 0 });
  const successRate = totals.success + totals.failed > 0
    ? `${((totals.success / (totals.success + totals.failed)) * 100).toFixed(1)}%`
    : "—";
  summary.textContent = `过去 ${asNumber(payload?.window_days) || days.length} 天 · ${totals.activeDays} 个活跃日 · ${totals.tasks} 个独立商品任务 · 成功率 ${successRate}`;
  timezone.textContent = String(payload?.timezone || "UTC+8").replace("Asia/Shanghai", "UTC+8");
  frame.style.setProperty("--usage-daily-weeks", String(weekCount));
}

async function refreshHeatmap() {
  if (!auth.supabaseUrl || !auth.supabaseAnonKey) return;
  try {
    if (!client) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      client = createClient(auth.supabaseUrl, auth.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    }
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData?.session) return;
    const { data, error } = await client.functions.invoke("portal-usage-admin", { body: {} });
    if (error) throw error;
    renderHeatmap(data?.daily_activity || {});
  } catch (error) {
    console.error("daily usage heatmap refresh failed", error);
    const card = ensureCard();
    const summary = card?.querySelector('[data-role="summary"]');
    if (summary) summary.textContent = "每日热力图暂时无法读取";
  }
}

ensureStyle();
ensureCard();
void refreshHeatmap();
timer = window.setInterval(() => void refreshHeatmap(), REFRESH_MS);
window.addEventListener("pagehide", () => {
  if (timer) window.clearInterval(timer);
});
