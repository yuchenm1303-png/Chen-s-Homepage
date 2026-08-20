const portalConfig = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const releaseSource = portalConfig.releaseSource ?? {};
const authConfig = portalConfig.auth ?? {};

const historyAction = document.getElementById("historyAction");
const modalLayer = document.getElementById("modalLayer");
const modalKicker = document.getElementById("modalKicker");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const toast = document.getElementById("toast");

const VERSION_RE = /^v\d+\.\d+\.\d+$/;
let cachedHistory = null;
let cachedAt = 0;
let supabase = null;
let toastTimer = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function formatDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && VERSION_RE.test(String(item.version || "")))
    .map((item) => ({
      version: String(item.version),
      title: String(item.title || "").trim(),
      publishedAt: String(item.publishedAt || "").trim(),
      fileSize: String(item.fileSize || "—").trim() || "—",
      sha256: String(item.installerSha256 || "").trim()
    }));
}

async function loadHistory() {
  if (cachedHistory && Date.now() - cachedAt < 30_000) return cachedHistory;
  const metadataUrl = String(releaseSource.metadataUrl || "").trim();
  if (!metadataUrl) throw new Error("release_metadata_url_missing");

  const response = await fetch(metadataUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`release_metadata_${response.status}`);

  const payload = await response.json();
  cachedHistory = normalizeHistory(payload?.history);
  cachedAt = Date.now();
  return cachedHistory;
}

async function getSupabase() {
  if (supabase) return supabase;
  if (!authConfig.supabaseUrl || !authConfig.supabaseAnonKey) {
    throw new Error("auth_config_missing");
  }
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
  return supabase;
}

async function downloadVersion(item, button) {
  if (!authConfig.downloadFunctionUrl) {
    showToast("下载服务不可用");
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "处理中…";

  try {
    const client = await getSupabase();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session?.access_token) {
      showToast("请先登录");
      return;
    }

    const response = await fetch(authConfig.downloadFunctionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "download",
        platform: "windows-x64",
        version: item.version
      })
    });

    if (!response.ok) {
      if (response.status === 401) showToast("登录状态已失效");
      else if (response.status === 403) showToast("当前账户无有效下载权限");
      else if (response.status === 404 || response.status === 409) showToast("该版本当前不可下载");
      else showToast("下载服务暂不可用");
      return;
    }

    const payload = await response.json();
    const url = String(payload?.url || "").trim();
    if (!url) {
      showToast("该版本无可用安装包");
      return;
    }
    window.location.assign(url);
  } catch (error) {
    console.error("historical release download failed", error);
    showToast("下载服务暂不可用");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderHistory(history) {
  modalBody.replaceChildren();

  const summary = document.createElement("p");
  summary.className = "modal-summary";
  summary.textContent = "已保留安装包的 Windows 正式版本。";
  modalBody.appendChild(summary);

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "spec-note";
    empty.textContent = "暂无可下载的历史版本。";
    modalBody.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "release-history-list";

  for (const item of history) {
    const row = document.createElement("div");
    row.className = "release-history-row";

    const copy = document.createElement("div");
    copy.className = "release-history-copy";
    const version = document.createElement("strong");
    version.textContent = item.version;
    const meta = document.createElement("span");
    meta.textContent = `${formatDate(item.publishedAt)} · ${item.fileSize}`;
    copy.append(version, meta);

    const title = document.createElement("p");
    title.textContent = item.title || "Listing Studio Stable Release";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "switch-account-button release-history-download";
    button.textContent = "下载";
    button.addEventListener("click", () => void downloadVersion(item, button));

    row.append(copy, title, button);
    list.appendChild(row);
  }

  modalBody.appendChild(list);

  const note = document.createElement("p");
  note.className = "spec-note release-history-note";
  note.textContent = "默认推荐当前 Stable 版本。历史版本用于回退与兼容性验证。";
  modalBody.appendChild(note);
}

async function openHistory() {
  if (!modalLayer || !modalKicker || !modalTitle || !modalBody) return;
  modalKicker.textContent = "RELEASE ARCHIVE";
  modalTitle.textContent = "历史版本";
  modalBody.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "modal-summary";
  loading.textContent = "正在加载版本记录…";
  modalBody.appendChild(loading);
  modalLayer.hidden = false;

  try {
    renderHistory(await loadHistory());
  } catch (error) {
    console.error("historical release metadata failed", error);
    modalBody.replaceChildren();
    const failed = document.createElement("p");
    failed.className = "modal-summary";
    failed.textContent = "版本记录暂不可用。";
    modalBody.appendChild(failed);
  }
}

historyAction?.addEventListener("click", () => void openHistory());
