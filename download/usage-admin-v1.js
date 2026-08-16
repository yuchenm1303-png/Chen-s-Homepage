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

function createStatusLine(label, value, state = "neutral") {
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

function createMetaItem(label, value) {
  const item = document.createElement("div");
  item.className = "meta-item";
  const key = document.createElement("span");
  key.textContent = label;
  const data = document.createElement("strong");
  data.textContent = String(value ?? "—");
  item.append(key, data);
  return item;
}

function completedFailedText(completed, failed) {
  return `${asNumber(completed)} / ${asNumber(failed)}`;
}

function renderUser(user) {
  const card = document.createElement("article");
  card.className = "account-card cards usage-account-card";

  const totals = totalsForUser(user);
  const success = totals.attempts ? `${((totals.completed / totals.attempts) * 100).toFixed(1)}%` : "—";

  const head = document.createElement("div");
  head.className = "account-head";

  const identity = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "ACCOUNT";
  const name = document.createElement("h2");
  name.textContent = user.display_name || user.email || "Unnamed user";
  const email = document.createElement("p");
  email.className = "usage-account-email";
  email.textContent = user.email || "—";
  identity.append(kicker, name, email);

  const presence = document.createElement("span");
  presence.className = "secure-pill";
  presence.textContent = user.online ? "ONLINE" : "OFFLINE";
  head.append(identity, presence);

  const statePanel = document.createElement("div");
  statePanel.className = "account-status-panel";
  statePanel.append(
    createStatusLine("运行状态", user.online ? "在线" : "离线", user.online ? "ok" : "neutral"),
    createStatusLine("客户端版本", user.latest_app_version || "—"),
    createStatusLine("最后活跃", formatTime(user.last_seen_at)),
    createStatusLine("任务成功率", success, totals.failed ? "warn" : "ok")
  );

  const metrics = document.createElement("div");
  metrics.className = "release-meta usage-account-metrics";
  metrics.append(
    createMetaItem("程序启动", asNumber(user.launch_count)),
    createMetaItem("单商品准备", completedFailedText(user.listing_prepare_completed, user.listing_prepare_failed)),
    createMetaItem("单商品执行", completedFailedText(user.listing_execute_completed, user.listing_execute_failed)),
    createMetaItem("批量准备", completedFailedText(user.batch_prepare_completed, user.batch_prepare_failed)),
    createMetaItem("批量执行", completedFailedText(user.batch_execute_completed, user.batch_execute_failed)),
    createMetaItem("授权设备", `${asNumber(user.active_devices)} / ${asNumber(user.max_devices)}`)
  );

  const footer = document.createElement("div");
  footer.className = "account-footer";
  const telemetry = document.createElement("span");
  telemetry.textContent = "Usage telemetry";
  const authorization = document.createElement("span");
  authorization.textContent = user.enabled ? "AUTHORIZED" : "DISABLED";
  footer.append(telemetry, authorization);

  card.append(head, statePanel, metrics, footer);
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
  usersPanel.replaceChildren(...(users.length ? users.map(renderUser) : [renderEmptyNode()]));

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
  const globalSuccess = taskAttempts ? `${((taskTotals.completed / taskAttempts) * 100).toFixed(1)}%` : "—";

  onlineCount.textContent = String(totalOnline);
  onlineRatio.textContent = users.length ? `${totalOnline} / ${users.length} 个账号在线` : "暂无账号";
  accountCount.textContent = String(users.length);
  launchCount.textContent = String(launches);
  activeDeviceCount.textContent = String(activeDevices);
  deviceCapacityText.textContent = `${activeDevices} / ${maxDevices || 0} 已授权容量`;
  singleDoneCount.textContent = String(singleDone);
  batchDoneCount.textContent = String(batchDone);
  successRate.textContent = globalSuccess;
  successRateMeta.textContent = taskAttempts ? `${taskTotals.completed} 完成 · ${taskTotals.failed} 失败` : "暂无任务";
  failureCount.textContent = String(taskTotals.failed);

  const onlineWindow = asNumber(snapshot?.online_window_seconds);
  windowText.textContent = onlineWindow ? `${onlineWindow} 秒` : "—";
  generatedAt.textContent = formatTime(snapshot?.generated_at);
  accountsHint.textContent = users.length ? `${totalOnline} 在线 · ${users.length - totalOnline} 离线` : "暂无账号";

  summaryGrid.hidden = false;
  accountsSection.hidden = false;
  setStatus(users.length ? `Telemetry 正常 · 已同步 ${users.length} 个已登记账号` : "Telemetry 正常 · 暂无使用记录", "ok");
}

function renderEmptyNode() {
  const empty = document.createElement("div");
  empty.className = "usage-empty";
  empty.textContent = "暂无 Usage Telemetry 数据";
  return empty;
}

function hideData() {
  summaryGrid.hidden = true;
  accountsSection.hidden = true;
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
