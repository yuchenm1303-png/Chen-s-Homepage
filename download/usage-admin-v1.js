const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const auth = config.auth ?? {};

const statusPanel = document.getElementById("statusPanel");
const summaryGrid = document.getElementById("summaryGrid");
const usersPanel = document.getElementById("usersPanel");
const generatedAt = document.getElementById("generatedAt");
const refreshButton = document.getElementById("refreshButton");
const onlineCount = document.getElementById("onlineCount");
const launchCount = document.getElementById("launchCount");
const singleDoneCount = document.getElementById("singleDoneCount");
const batchDoneCount = document.getElementById("batchDoneCount");

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

function detail(label, value) {
  const row = document.createElement("div");
  row.className = "usage-detail";
  const key = document.createElement("span");
  key.textContent = label;
  const data = document.createElement("strong");
  data.textContent = String(value ?? "—");
  row.append(key, data);
  return row;
}

function metric(label, completed, failed) {
  const row = document.createElement("div");
  row.className = "usage-metric";
  const key = document.createElement("span");
  key.textContent = label;
  const data = document.createElement("strong");
  data.textContent = `${asNumber(completed)} 完成 · ${asNumber(failed)} 失败`;
  row.append(key, data);
  return row;
}

function renderUser(user) {
  const card = document.createElement("article");
  card.className = "usage-user-card";

  const head = document.createElement("div");
  head.className = "usage-user-head";
  const identity = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = user.display_name || user.email || "Unnamed user";
  const email = document.createElement("span");
  email.textContent = user.email || "—";
  identity.append(name, email);

  const presence = document.createElement("span");
  presence.className = user.online ? "usage-presence online" : "usage-presence";
  presence.textContent = user.online ? "● 在线" : "○ 离线";
  head.append(identity, presence);

  const meta = document.createElement("div");
  meta.className = "usage-meta-grid";
  meta.append(
    detail("最后活跃", formatTime(user.last_seen_at)),
    detail("首次统计", formatTime(user.first_used_at)),
    detail("程序启动", asNumber(user.launch_count)),
    detail("当前版本", user.latest_app_version || "—"),
    detail("授权设备", `${asNumber(user.active_devices)} / ${asNumber(user.max_devices)}`),
    detail("账号状态", user.enabled ? "已授权" : "已停用")
  );

  const metrics = document.createElement("div");
  metrics.className = "usage-metrics";
  metrics.append(
    metric("单商品准备", user.listing_prepare_completed, user.listing_prepare_failed),
    metric("单商品执行", user.listing_execute_completed, user.listing_execute_failed),
    metric("批量准备", user.batch_prepare_completed, user.batch_prepare_failed),
    metric("批量执行", user.batch_execute_completed, user.batch_execute_failed)
  );

  card.append(head, meta, metrics);
  return card;
}

function renderSnapshot(snapshot) {
  const users = Array.isArray(snapshot?.users) ? snapshot.users : [];
  usersPanel.replaceChildren(...users.map(renderUser));

  const totalOnline = users.filter((user) => Boolean(user.online)).length;
  const launches = users.reduce((sum, user) => sum + asNumber(user.launch_count), 0);
  const singleDone = users.reduce((sum, user) => sum + asNumber(user.listing_execute_completed), 0);
  const batchDone = users.reduce((sum, user) => sum + asNumber(user.batch_execute_completed), 0);

  onlineCount.textContent = String(totalOnline);
  launchCount.textContent = String(launches);
  singleDoneCount.textContent = String(singleDone);
  batchDoneCount.textContent = String(batchDone);
  generatedAt.textContent = `数据时间 ${formatTime(snapshot?.generated_at)}`;
  summaryGrid.hidden = false;
  usersPanel.hidden = false;
  setStatus(
    users.length ? `已读取 ${users.length} 个已登记账号 · 在线判定窗口 ${asNumber(snapshot?.online_window_seconds)} 秒` : "暂时还没有使用记录。",
    "ok"
  );
}

async function refresh() {
  if (!supabase || refreshing) return;
  refreshing = true;
  refreshButton.disabled = true;
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session) {
      summaryGrid.hidden = true;
      usersPanel.hidden = true;
      setStatus("当前没有登录。请先返回下载页，用 Owner 账号登录后再打开这里。", "warn");
      return;
    }

    const { data, error } = await supabase.rpc("get_listing_usage_admin_snapshot");
    if (error) throw error;
    renderSnapshot(data ?? {});
  } catch (error) {
    console.error("usage dashboard refresh failed", error);
    summaryGrid.hidden = true;
    usersPanel.hidden = true;
    const message = String(error?.message || "");
    setStatus(
      message.includes("not_authorized") || message.includes("permission")
        ? "当前账号不是 Usage 管理员。"
        : "暂时无法读取使用数据，请稍后刷新。",
      "warn"
    );
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
