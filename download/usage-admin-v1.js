const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const auth = config.auth ?? {};

const statusPanel = document.getElementById("statusPanel");
const summaryGrid = document.getElementById("summaryGrid");
const usersPanel = document.getElementById("usersPanel");
const usersTableWrap = document.getElementById("usersTableWrap");
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

function textCell(value, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = String(value ?? "—");
  return cell;
}

function lifecycleCell(completed, failed) {
  const cell = document.createElement("td");
  cell.className = "usage-count";
  const done = document.createElement("span");
  done.textContent = String(asNumber(completed));
  const separator = document.createElement("small");
  separator.textContent = ` / ${asNumber(failed)} 失败`;
  cell.append(done, separator);
  return cell;
}

function renderUser(user) {
  const row = document.createElement("tr");

  const identity = document.createElement("td");
  identity.className = "usage-account";
  const name = document.createElement("strong");
  name.textContent = user.display_name || user.email || "Unnamed user";
  const email = document.createElement("span");
  email.textContent = user.email || "—";
  identity.append(name, email);

  const presence = document.createElement("td");
  presence.className = user.online ? "usage-presence online" : "usage-presence";
  presence.textContent = user.online ? "● 在线" : "○ 离线";

  row.append(
    identity,
    presence,
    textCell(formatTime(user.last_seen_at)),
    textCell(user.latest_app_version || "—"),
    textCell(asNumber(user.launch_count), "usage-count"),
    lifecycleCell(user.listing_prepare_completed, user.listing_prepare_failed),
    lifecycleCell(user.listing_execute_completed, user.listing_execute_failed),
    lifecycleCell(user.batch_prepare_completed, user.batch_prepare_failed),
    lifecycleCell(user.batch_execute_completed, user.batch_execute_failed),
    textCell(`${asNumber(user.active_devices)} / ${asNumber(user.max_devices)}`, "usage-count")
  );

  return row;
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
  generatedAt.textContent = formatTime(snapshot?.generated_at);
  summaryGrid.hidden = false;
  usersTableWrap.hidden = !users.length;
  setStatus(
    users.length
      ? `已读取 ${users.length} 个已登记账号 · 在线判定窗口 ${asNumber(snapshot?.online_window_seconds)} 秒`
      : "暂时还没有使用记录。",
    "ok"
  );
}

function hideData() {
  summaryGrid.hidden = true;
  usersTableWrap.hidden = true;
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
