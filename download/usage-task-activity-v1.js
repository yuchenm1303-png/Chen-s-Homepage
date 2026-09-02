import { createClient } from "https://esm.sh/@supabase/supabase-js@2?bundle";

const TIME_ZONE = "Asia/Shanghai";
const HOUR_MS = 60 * 60 * 1000;
const STATUS_ORDER = ["completed", "running", "ready", "cancelled", "failed", "review"];
const STATUS_LABELS = Object.freeze({
  completed: "完成",
  running: "运行中",
  ready: "待执行",
  cancelled: "已取消",
  failed: "失败",
  review: "Review"
});

const RANGE_SPECS = Object.freeze({
  "24h": Object.freeze({ key: "24h", mode: "hour", count: 24 }),
  "7d": Object.freeze({ key: "7d", mode: "hour", count: 168 }),
  "30d": Object.freeze({ key: "30d", mode: "day", count: 30 })
});

const shanghaiDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE
});

let client = null;
let latestPayload = null;
let lifecycleRefreshing = false;
let refreshTimer = null;

function ensureStylesheet() {
  if (document.getElementById("usageTaskActivityStyles")) return;
  const link = document.createElement("link");
  link.id = "usageTaskActivityStyles";
  link.rel = "stylesheet";
  link.href = "./usage-task-activity-v1.css?v=20260902-lifecycle-motion-2";
  document.head.append(link);
}

function monitorView() {
  const path = String(window.location?.pathname || "").replace(/\/+$/, "");
  return path.endsWith("/tenant-usage.html") ? "tenant" : "admin";
}

function currentRangeSpec() {
  const selected = document.querySelector('#activityRangeControl [data-range][aria-pressed="true"]');
  return RANGE_SPECS[String(selected?.dataset?.range || "24h")] || RANGE_SPECS["24h"];
}

function asCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function emptyCounts() {
  return { completed: 0, running: 0, ready: 0, cancelled: 0, failed: 0, review: 0 };
}

function normalizedCounts(row) {
  const counts = emptyCounts();
  STATUS_ORDER.forEach((status) => { counts[status] = asCount(row?.[status]); });
  return counts;
}

function totalCount(counts) {
  return STATUS_ORDER.reduce((sum, status) => sum + asCount(counts?.[status]), 0);
}

function addCounts(target, source) {
  STATUS_ORDER.forEach((status) => { target[status] += asCount(source?.[status]); });
  return target;
}

function totalsForBuckets(buckets) {
  return buckets.reduce((totals, bucket) => addCounts(totals, bucket.counts), emptyCounts());
}

function shanghaiDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = shanghaiDateFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDateKeyDays(dateKey, delta) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const stamp = Date.UTC(year, month - 1, day) + delta * 24 * HOUR_MS;
  const date = new Date(stamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function buildDescriptors(payload, spec) {
  const generated = new Date(payload?.generated_at || Date.now());
  if (spec.mode === "day") {
    const endKey = shanghaiDateKey(generated) || shanghaiDateKey(new Date());
    return Array.from({ length: spec.count }, (_, index) => {
      const key = addDateKeyDays(endKey, index - spec.count + 1);
      return { key, date: new Date(`${key}T00:00:00+08:00`) };
    });
  }

  const end = Math.floor(generated.getTime() / HOUR_MS) * HOUR_MS;
  return Array.from({ length: spec.count }, (_, index) => {
    const stamp = end - (spec.count - 1 - index) * HOUR_MS;
    return { key: String(stamp), date: new Date(stamp) };
  });
}

function rowKey(row, spec) {
  if (spec.mode === "day") return String(row?.activity_date || "");
  const stamp = Date.parse(String(row?.bucket_start || ""));
  return Number.isFinite(stamp) ? String(Math.floor(stamp / HOUR_MS) * HOUR_MS) : "";
}

function rowsForSpec(payload, spec) {
  return spec.mode === "day"
    ? (Array.isArray(payload?.daily) ? payload.daily : [])
    : (Array.isArray(payload?.hourly) ? payload.hourly : []);
}

function bucketsForUser(payload, spec, userId, descriptors) {
  const byKey = new Map();
  rowsForSpec(payload, spec).forEach((row) => {
    if (String(row?.user_id || "") !== String(userId || "")) return;
    const key = rowKey(row, spec);
    if (key) byKey.set(key, normalizedCounts(row));
  });
  return descriptors.map((descriptor) => ({ ...descriptor, counts: byKey.get(descriptor.key) || emptyCounts() }));
}

function globalBuckets(payload, spec, descriptors) {
  const byKey = new Map();
  rowsForSpec(payload, spec).forEach((row) => {
    const key = rowKey(row, spec);
    if (!key) return;
    const counts = byKey.get(key) || emptyCounts();
    byKey.set(key, addCounts(counts, normalizedCounts(row)));
  });
  return descriptors.map((descriptor) => ({ ...descriptor, counts: byKey.get(descriptor.key) || emptyCounts() }));
}

function captureClientActivity(rail, expectedLength) {
  if (!rail) return Array(expectedLength).fill(false);
  const nodes = Array.from(rail.children).filter((node) => node instanceof HTMLElement);
  const lifecycleNodes = nodes.length > 0 && nodes.every((node) => node.dataset.lifecycleSegment === "true");
  if (!lifecycleNodes && nodes.length === expectedLength) {
    rail.__usageClientActivity = nodes.map((node) => node.classList.contains("is-active"));
  }
  const stored = rail.__usageClientActivity;
  return Array.isArray(stored) && stored.length === expectedLength
    ? stored.slice()
    : Array(expectedLength).fill(false);
}

function statusGradient(counts) {
  const total = totalCount(counts);
  if (!total) return "transparent";
  let cursor = 0;
  const stops = [];
  STATUS_ORDER.forEach((status) => {
    const count = asCount(counts[status]);
    if (!count) return;
    const start = (cursor / total) * 100;
    cursor += count;
    const end = (cursor / total) * 100;
    const color = `var(--usage-status-${status})`;
    stops.push(`${color} ${start.toFixed(3)}%`, `${color} ${end.toFixed(3)}%`);
  });
  if (stops.length === 2) return stops[0].split(" ")[0];
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function formatBucketLabel(bucket, spec, detailed = false) {
  if (spec.mode === "day" || spec.key === "7d") {
    return new Intl.DateTimeFormat("zh-CN", {
      ...(detailed ? { year: "numeric" } : {}),
      month: "2-digit",
      day: "2-digit",
      ...(detailed && spec.mode === "hour" ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
      timeZone: TIME_ZONE
    }).format(bucket.date);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    ...(detailed ? { month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE
  }).format(bucket.date);
}

function lifecycleDescription(counts) {
  const parts = STATUS_ORDER
    .filter((status) => asCount(counts[status]) > 0)
    .map((status) => `${STATUS_LABELS[status]} ${asCount(counts[status])}`);
  return parts.join(" · ");
}

function renderPresence(rail, buckets, spec, clientActivity) {
  if (!rail) return;
  rail.classList.toggle("is-dense", buckets.length > 48);
  rail.style.gridTemplateColumns = `repeat(${Math.max(1, buckets.length)}, minmax(0, 1fr))`;
  const nodes = buckets.map((bucket, index) => {
    const segment = document.createElement("span");
    segment.className = "usage-presence-segment";
    segment.dataset.lifecycleSegment = "true";
    const taskTotal = totalCount(bucket.counts);
    const clientActive = Boolean(clientActivity[index]);
    if (taskTotal > 0) {
      segment.classList.add("has-lifecycle");
      if (asCount(bucket.counts.running) > 0) segment.classList.add("has-running");
      segment.style.setProperty("--usage-lifecycle-strip", statusGradient(bucket.counts));
    } else if (clientActive) {
      segment.classList.add("is-client-active");
    } else {
      segment.classList.add("is-idle");
    }
    if (index === buckets.length - 1) segment.classList.add("is-current");
    const taskText = lifecycleDescription(bucket.counts);
    segment.title = `${formatBucketLabel(bucket, spec, true)} · ${taskText || (clientActive ? "客户端活跃" : "无任务记录")}`;
    return segment;
  });
  rail.replaceChildren(...nodes);
}

function renderThroughput(chart, buckets, spec) {
  if (!chart) return;
  chart.classList.toggle("is-dense", buckets.length > 48);
  chart.style.gridTemplateColumns = `repeat(${Math.max(1, buckets.length)}, minmax(0, 1fr))`;
  const maxValue = Math.max(1, ...buckets.map((bucket) => totalCount(bucket.counts)));
  const columns = buckets.map((bucket) => {
    const column = document.createElement("div");
    column.className = "usage-throughput-column";
    column.dataset.lifecycleColumn = "true";
    const description = lifecycleDescription(bucket.counts);
    column.title = `${formatBucketLabel(bucket, spec, true)} · ${description || "无任务记录"}`;
    STATUS_ORDER.forEach((status) => {
      const count = asCount(bucket.counts[status]);
      if (!count) return;
      const state = document.createElement("span");
      state.className = `usage-throughput-state is-${status}`;
      state.style.height = `${(count / maxValue) * 100}%`;
      state.setAttribute("aria-label", `${STATUS_LABELS[status]} ${count}`);
      column.append(state);
    });
    return column;
  });
  chart.replaceChildren(...columns);
}

function renderAxis(target, buckets, spec) {
  if (!target || !buckets.length) return;
  const last = buckets.length - 1;
  const indexes = [0, Math.floor(last / 2), last];
  target.replaceChildren(...indexes.map((index) => {
    const span = document.createElement("span");
    span.textContent = formatBucketLabel(buckets[index], spec, false);
    return span;
  }));
}

function compactSummary(totals, activeBuckets = null, spec = null) {
  const parts = [];
  if (activeBuckets !== null && spec) parts.push(`${activeBuckets}${spec.mode === "day" ? "天" : "h"} 活跃`);
  parts.push(`${totals.completed} 完成`);
  if (totals.running) parts.push(`${totals.running} 运行`);
  if (totals.ready) parts.push(`${totals.ready} 待执行`);
  if (totals.cancelled) parts.push(`${totals.cancelled} 取消`);
  if (totals.failed) parts.push(`${totals.failed} 失败`);
  if (totals.review) parts.push(`${totals.review} Review`);
  return parts.join(" · ");
}

function renderAccountCharts(payload, spec, descriptors) {
  const users = Array.isArray(payload?.users) ? payload.users : [];
  const byEmail = new Map(users.map((user) => [String(user?.email || "").trim().toLowerCase(), user]));

  document.querySelectorAll("#usersPanel > .usage-account-card").forEach((card) => {
    const email = String(card.querySelector(".usage-account-email")?.textContent || "").trim().toLowerCase();
    const user = byEmail.get(email);
    if (!user) return;
    const monitor = card.querySelector(".usage-account-monitor");
    if (!monitor) return;
    const rail = monitor.querySelector(".usage-presence-rail");
    const chart = monitor.querySelector(".usage-throughput-chart");
    const axis = monitor.querySelector(".usage-monitor-axis");
    const summary = monitor.querySelector(".usage-account-monitor-head strong");
    const clientActivity = captureClientActivity(rail, descriptors.length);
    const buckets = bucketsForUser(payload, spec, user.user_id, descriptors);
    const totals = totalsForBuckets(buckets);
    const activeBuckets = buckets.reduce((count, bucket, index) => count + (clientActivity[index] || totalCount(bucket.counts) > 0 ? 1 : 0), 0);
    renderPresence(rail, buckets, spec, clientActivity);
    renderThroughput(chart, buckets, spec);
    renderAxis(axis, buckets, spec);
    if (summary) summary.textContent = compactSummary(totals, activeBuckets, spec);
  });
}

function renderGlobalCharts(payload, spec, descriptors) {
  const buckets = globalBuckets(payload, spec, descriptors);
  const rail = document.getElementById("globalPresenceRail");
  const chart = document.getElementById("globalTaskSpark");
  const clientActivity = captureClientActivity(rail, descriptors.length);
  renderPresence(rail, buckets, spec, clientActivity);
  renderThroughput(chart, buckets, spec);
  renderAxis(document.getElementById("globalPresenceAxis"), buckets, spec);
  renderAxis(document.getElementById("globalTaskAxis"), buckets, spec);
  const totals = totalsForBuckets(buckets);
  const summary = document.getElementById("throughputSummary");
  if (summary) summary.textContent = compactSummary(totals);
}

function renderLegend() {
  const legend = document.querySelector(".usage-monitor-legend");
  if (!legend) return;
  const entries = [
    ["is-client-active", "客户端活跃"],
    ["is-completed", "完成"],
    ["is-running", "运行中"],
    ["is-ready", "待执行"],
    ["is-cancelled", "已取消"],
    ["is-failed-lifecycle", "失败"],
    ["is-review", "Review"],
    ["is-idle", "无记录"]
  ];
  const nodes = entries.map(([state, label]) => {
    const item = document.createElement("span");
    const dot = document.createElement("i");
    dot.className = `usage-legend-dot ${state}`;
    item.append(dot, document.createTextNode(label));
    return item;
  });
  const note = document.createElement("span");
  note.textContent = "格与柱均按真实任务生命周期着色";
  nodes.push(note);
  legend.dataset.lifecycleLegend = "true";
  legend.replaceChildren(...nodes);
}

function renderLatest() {
  if (!latestPayload) return;
  const spec = currentRangeSpec();
  const descriptors = buildDescriptors(latestPayload, spec);
  renderAccountCharts(latestPayload, spec, descriptors);
  renderGlobalCharts(latestPayload, spec, descriptors);
  renderLegend();
}

function getClient() {
  if (client) return client;
  const auth = window.DOWNLOAD_PORTAL_CONFIG?.auth ?? {};
  if (!auth.supabaseUrl || !auth.supabaseAnonKey) return null;
  client = createClient(auth.supabaseUrl, auth.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  return client;
}

async function refreshLifecycle() {
  if (lifecycleRefreshing) return;
  const lifecycleClient = getClient();
  if (!lifecycleClient) return;
  lifecycleRefreshing = true;
  try {
    const { data: sessionData, error: sessionError } = await lifecycleClient.auth.getSession();
    if (sessionError || !sessionData?.session) return;
    const { data, error } = await lifecycleClient.rpc("get_listing_task_lifecycle_activity_v1", {
      p_view: monitorView(),
      p_hours: 168,
      p_days: 30
    });
    if (error) throw error;
    latestPayload = data || null;
    renderLatest();
  } catch (error) {
    console.warn("usage lifecycle activity unavailable", error);
  } finally {
    lifecycleRefreshing = false;
  }
}

function scheduleRefresh(delay = 80) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshLifecycle, delay);
}

function install() {
  ensureStylesheet();
  document.getElementById("activityRangeControl")?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-range]")) return;
    window.setTimeout(renderLatest, 80);
  });

  const usersPanel = document.getElementById("usersPanel");
  if (usersPanel) {
    new MutationObserver(() => window.setTimeout(renderLatest, 0))
      .observe(usersPanel, { childList: true });
  }

  const generatedAt = document.getElementById("generatedAt");
  if (generatedAt) {
    new MutationObserver(() => scheduleRefresh())
      .observe(generatedAt, { childList: true, characterData: true, subtree: true });
  }

  void refreshLifecycle();
  window.setInterval(() => void refreshLifecycle(), 30_000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
