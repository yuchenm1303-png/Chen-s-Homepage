const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const auth = config.auth ?? {};

const statusPanel = document.getElementById("statusPanel");
const summaryGrid = document.getElementById("summaryGrid");
const accountsSection = document.getElementById("accountsSection");
const usersPanel = document.getElementById("usersPanel");
const generatedAt = document.getElementById("generatedAt");
const refreshButton = document.getElementById("refreshButton");
const onlineCount = document.getElementById("onlineCount");
const onlineRatio = document.getElementById("onlineRatio");
const accountCount = document.getElementById("accountCount");
const accountCountText = document.getElementById("accountCountText");
const windowText = document.getElementById("windowText");
const launchCount = document.getElementById("launchCount");
const activeDeviceCount = document.getElementById("activeDeviceCount");
const deviceCapacityText = document.getElementById("deviceCapacityText");
const singleDoneCount = document.getElementById("singleDoneCount");
const batchDoneCount = document.getElementById("batchDoneCount");
const successRate = document.getElementById("successRate");
const successRateMeta = document.getElementById("successRateMeta");
const failureCount = document.getElementById("failureCount");
const accountsHint = document.getElementById("accountsHint");

let supabase = null;
let refreshing = false;
let autoRefresh = null;

function asNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function formatCompactTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function setStatus(text, state = "neutral") {
  statusPanel.textContent = text;
  statusPanel.dataset.state = state;
}

function totalsForUser(user) {
  const completed =
    asNumber(user.listing_prepare_completed) +
    asNumber(user.listing_execute_completed) +
    asNumber(user.batch_prepare_completed) +
    asNumber(user.batch_execute_completed);
  const failed =
    asNumber(user.listing_prepare_failed) +
    asNumber(user.listing_execute_failed) +
    asNumber(user.batch_prepare_failed) +
    asNumber(user.batch_execute_failed);
  return { completed, failed, attempts: completed + failed };
}

function createMiniStat(label, value, note = "") {
  const item = document.createElement("div");
  item.className = "usage-mini-stat";

  const key = document.createElement("span");
  key.textContent = label;
  const data = document.createElement("strong");
  data.textContent = String(value ?? "—");
  item.append(key, data);

  if (note) {
    const small = document.createElement("small");
    small.textContent = note;
    item.append(small);
  }

  return item;
}

function completedFailedText(completed, failed) {
  return `${asNumber(completed)} / ${asNumber(failed)}`;
}

function renderUser(user) {
  const card = document.createElement("article");
  card.className = `usage-user-card${user.online ? " is-online" : ""}`;

  const totals = totalsForUser(user);
  const health = totals.attempts > 0 ? (totals.completed / totals.attempts) * 100 : 0;
  if (totals.failed > 0) card.classList.add("has-failures");

  const header = document.createElement("div");
  header.className = "usage-user-header";

  const identity = document.createElement("div");
  identity.className = "usage-user-identity";
  const name = document.createElement("strong");
  name.textContent = user.display_name || user.email || "Unnamed user";
  const email = document.createElement("span");
  email.textContent = user.email || "—";
  identity.append(name, email);

  const version = document.createElement("div");
  version.className = "usage-user-version";
  const versionLabel = document.createElement("span");
  versionLabel.textContent = "VERSION";
  const versionValue = document.createElement("strong");
  versionValue.textContent = user.latest_app_version || "—";
  version.append(versionLabel, versionValue);

  const presence = document.createElement("div");
  presence.className = `usage-user-presence${user.online ? " online" : ""}`;
  const presenceDot = document.createElement("i");
  const presenceText = document.createElement("span");
  presenceText.textContent = user.online ? "在线" : "离线";
  presence.append(presenceDot, presenceText);

  header.append(identity, version, presence);

  const healthBlock = document.createElement("div");
  healthBlock.className = "usage-user-health";
  const healthHead = document.createElement("div");
  healthHead.className = "usage-health-head";
  const healthLabel = document.createElement("span");
  healthLabel.textContent = "TASK SUCCESS";
  const healthValue = document.createElement("strong");
  healthValue.textContent = totals.attempts ? `${health.toFixed(1)}%` : "—";
  healthHead.append(healthLabel, healthValue);

  const healthTrack = document.createElement("div");
  healthTrack.className = "usage-health-track";
  const healthFill = document.createElement("div");
  healthFill.className = "usage-health-fill";
  healthFill.style.setProperty("--health", `${clamp(health, 0, 100)}%`);
  healthTrack.append(healthFill);
  healthBlock.append(healthHead, healthTrack);

  const stats = document.createElement("div");
  stats.className = "usage-user-stats";
  stats.append(
    createMiniStat("启动", asNumber(user.launch_count), "sessions"),
    createMiniStat("单准备", completedFailedText(user.listing_prepare_completed, user.listing_prepare_failed), "完成 / 失败"),
    createMiniStat("单执行", completedFailedText(user.listing_execute_completed, user.listing_execute_failed), "完成 / 失败"),
    createMiniStat("批准备", completedFailedText(user.batch_prepare_completed, user.batch_prepare_failed), "完成 / 失败"),
    createMiniStat("批执行", completedFailedText(user.batch_execute_completed, user.batch_execute_failed), "完成 / 失败"),
    createMiniStat("设备", `${asNumber(user.active_devices)} / ${asNumber(user.max_devices)}`, "active / max")
  );

  const footer = document.createElement("div");
  footer.className = "usage-user-footer";
  const lastSeen = document.createElement("span");
  lastSeen.textContent = `最后活跃 ${formatCompactTime(user.last_seen_at)}`;
  const state = document.createElement("strong");
  state.textContent = user.enabled ? "AUTHORIZED" : "DISABLED";
  footer.append(lastSeen, state);

  card.append(header, healthBlock, stats, footer);
  return card;
}

function renderEmptyState() {
  const empty = document.createElement("div");
  empty.className = "usage-empty";
  empty.textContent = "暂无 Usage Telemetry 数据";
  usersPanel.replaceChildren(empty);
}

function renderSnapshot(snapshot) {
  const users = Array.isArray(snapshot?.users) ? snapshot.users : [];
  if (users.length) {
    usersPanel.replaceChildren(...users.map(renderUser));
  } else {
    renderEmptyState();
  }

  const totalOnline = users.filter((user) => Boolean(user.online)).length;
  const launches = users.reduce((sum, user) => sum + asNumber(user.launch_count), 0);
  const activeDevices = users.reduce((sum, user) => sum + asNumber(user.active_devices), 0);
  const maxDevices = users.reduce((sum, user) => sum + asNumber(user.max_devices), 0);
  const singleDone = users.reduce((sum, user) => sum + asNumber(user.listing_execute_completed), 0);
  const batchDone = users.reduce((sum, user) => sum + asNumber(user.batch_execute_completed), 0);

  const taskTotals = users.reduce(
    (acc, user) => {
      const totals = totalsForUser(user);
      acc.completed += totals.completed;
      acc.failed += totals.failed;
      return acc;
    },
    { completed: 0, failed: 0 }
  );
  const taskAttempts = taskTotals.completed + taskTotals.failed;
  const globalSuccess = taskAttempts > 0 ? (taskTotals.completed / taskAttempts) * 100 : null;

  onlineCount.textContent = String(totalOnline);
  onlineRatio.textContent = users.length ? `${((totalOnline / users.length) * 100).toFixed(0)}% of accounts` : "暂无账号";
  accountCount.textContent = String(users.length);
  accountCountText.textContent = `${users.length} accounts`;
  launchCount.textContent = String(launches);
  activeDeviceCount.textContent = String(activeDevices);
  deviceCapacityText.textContent = `${activeDevices} / ${maxDevices || 0} capacity`;
  singleDoneCount.textContent = String(singleDone);
  batchDoneCount.textContent = String(batchDone);
  successRate.textContent = globalSuccess === null ? "—" : `${globalSuccess.toFixed(1)}%`;
  successRateMeta.textContent = taskAttempts ? `${taskTotals.completed} 完成 · ${taskTotals.failed} 失败` : "暂无任务";
  failureCount.textContent = String(taskTotals.failed);

  const onlineWindow = asNumber(snapshot?.online_window_seconds);
  windowText.textContent = onlineWindow ? `${onlineWindow}s online window` : "—";
  generatedAt.textContent = formatTime(snapshot?.generated_at);
  accountsHint.textContent = users.length ? `${totalOnline} 在线 · ${users.length - totalOnline} 离线` : "暂无账号";

  summaryGrid.hidden = false;
  accountsSection.hidden = false;
  setStatus(
    users.length ? `Telemetry 正常 · 已同步 ${users.length} 个已登记账号` : "Telemetry 正常 · 暂无使用记录",
    "ok"
  );
}

function hideData() {
  summaryGrid.hidden = true;
  accountsSection.hidden = true;
  accountCountText.textContent = "0 accounts";
  windowText.textContent = "—";
}

async function refresh() {
  if (!supabase || refreshing) return;
  refreshing = true;
  refreshButton.disabled = true;
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session) {
      hideData();
      generatedAt.textContent = "—";
      setStatus("当前没有登录。请先返回下载页，用 Owner 账号登录后再打开这里。", "warn");
      return;
    }

    const { data, error } = await supabase.functions.invoke("portal-usage-admin", { body: {} });
    if (error) throw error;
    renderSnapshot(data ?? {});
  } catch (error) {
    console.error("usage dashboard refresh failed", error);
    hideData();
    generatedAt.textContent = "—";
    setStatus("当前账号不是 Usage 管理员，或使用数据服务暂时不可用。", "warn");
  } finally {
    refreshing = false;
    refreshButton.disabled = false;
  }
}

async function init() {
  if (!auth.supabaseUrl || !auth.supabaseAnonKey) {
    setStatus("Supabase 配置缺失。", "warn");
    return;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(auth.supabaseUrl, auth.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  refreshButton.addEventListener("click", () => void refresh());
  await refresh();
  autoRefresh = window.setInterval(() => void refresh(), 30_000);
}

window.addEventListener("pagehide", () => {
  if (autoRefresh) window.clearInterval(autoRefresh);
});

void init();
