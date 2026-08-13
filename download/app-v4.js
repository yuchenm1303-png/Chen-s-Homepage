const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const release = config.release ?? {};
const authConfig = config.auth ?? {};

const $ = (id) => document.getElementById(id);
const versionNumber = $("versionNumber");
const publishedAt = $("publishedAt");
const platformText = $("platformText");
const fileSizeText = $("fileSizeText");
const loginForm = $("loginForm");
const loginMessage = $("loginMessage");
const emailInput = $("emailInput");
const passwordInput = $("passwordInput");
const loggedOutState = $("loggedOutState");
const loggedInState = $("loggedInState");
const accountEmail = $("accountEmail");
const logoutButton = $("logoutButton");
const downloadButton = $("downloadButton");
const downloadButtonHint = $("downloadButtonHint");
const accountStateText = $("accountStateText");
const notesAction = $("notesAction");
const systemAction = $("systemAction");
const supportAction = $("supportAction");
const modalLayer = $("modalLayer");
const modalMask = $("modalMask");
const modalClose = $("modalClose");
const modalKicker = $("modalKicker");
const modalTitle = $("modalTitle");
const modalBody = $("modalBody");
const toast = $("toast");
const cursorDot = $("cursorDot");
const cursorFollow = $("cursorFollow");

let supabase = null;
let session = null;
let toastTimer = null;

function applyConfig() {
  versionNumber.textContent = release.version || "—";
  publishedAt.textContent = `${release.publishedAt || "待发布"} 发布`;
  platformText.textContent = release.platform || "Windows x64";
  fileSizeText.textContent = release.fileSize && release.fileSize !== "待发布" ? release.fileSize : "待发布";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setSession(nextSession) {
  session = nextSession ?? null;
  const user = session?.user;
  const signedIn = Boolean(user);
  loggedOutState.hidden = signedIn;
  loggedInState.hidden = !signedIn;
  loggedOutState.style.display = signedIn ? "none" : "";
  loggedInState.style.display = signedIn ? "flex" : "none";
  accountEmail.textContent = user?.email || "已授权用户";
  accountStateText.textContent = signedIn ? "已登录" : "未登录";
  downloadButton.disabled = !signedIn;
  downloadButtonHint.textContent = signedIn ? (release.version || "最新版") : "登录后解锁";
  if (!signedIn && supabase) loginMessage.textContent = "登录后即可下载最新版安装包。";
}

async function initAuth() {
  if (!authConfig.supabaseUrl || !authConfig.supabaseAnonKey) {
    loginMessage.textContent = "登录服务等待配置；页面视觉与交互已就绪。";
    setSession(null);
    return;
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    setSession(data.session);
    supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "登录服务初始化失败，请检查站点配置。";
    showToast("登录服务初始化失败");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return showToast("登录服务尚未配置");
  const submitButton = loginForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "验证中…";
  loginMessage.textContent = "正在验证账户…";
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput.value.trim(), password: passwordInput.value
    });
    if (error) throw error;
    setSession(data.session);
    passwordInput.value = "";
    showToast("登录成功");
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "邮箱或密码错误，请重试。";
    showToast("登录失败");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "登录";
  }
});

logoutButton.addEventListener("click", async () => {
  if (supabase) await supabase.auth.signOut();
  setSession(null);
  showToast("已退出登录");
});

downloadButton.addEventListener("click", async () => {
  if (!session) {
    showToast("请先登录");
    emailInput.focus();
    return;
  }
  downloadButton.disabled = true;
  const originalHint = downloadButtonHint.textContent;
  downloadButtonHint.textContent = "正在生成安全链接…";
  try {
    let url = release.downloadUrl || "";
    if (authConfig.downloadFunctionUrl) {
      const response = await fetch(authConfig.downloadFunctionUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "windows-x64", version: release.version })
      });
      if (!response.ok) throw new Error(`download function returned ${response.status}`);
      const payload = await response.json();
      url = payload.url || "";
    }
    if (!url) return showToast("最新版安装包尚未发布");
    window.location.assign(url);
  } catch (error) {
    console.error(error);
    showToast("暂时无法生成下载链接");
  } finally {
    downloadButton.disabled = !session;
    downloadButtonHint.textContent = originalHint;
  }
});

function closeModal() {
  modalLayer.hidden = true;
  modalBody.replaceChildren();
}

function openModal(kind) {
  modalBody.replaceChildren();
  if (kind === "notes") {
    modalKicker.textContent = "RELEASE NOTES";
    modalTitle.textContent = `${release.version || "最新版"} 更新日志`;
    const list = document.createElement("ul");
    list.className = "modal-list";
    for (const note of release.notes ?? []) {
      const li = document.createElement("li");
      li.textContent = note;
      list.appendChild(li);
    }
    modalBody.appendChild(list);
  } else if (kind === "system") {
    modalKicker.textContent = "REQUIREMENTS";
    modalTitle.textContent = "运行环境";
    const specs = [["操作系统","Windows 10 / 11"],["系统架构","x64"],["浏览器运行时","Microsoft Edge"],["当前版本",release.version || "最新版"]];
    for (const [label, value] of specs) {
      const row = document.createElement("div");
      row.className = "spec-row";
      const key = document.createElement("span");
      const val = document.createElement("strong");
      key.textContent = label;
      val.textContent = value;
      row.append(key, val);
      modalBody.appendChild(row);
    }
  }
  modalLayer.hidden = false;
}

notesAction.addEventListener("click", () => openModal("notes"));
systemAction.addEventListener("click", () => openModal("system"));
supportAction.addEventListener("click", () => showToast("安装帮助正在整理中"));
modalClose.addEventListener("click", closeModal);
modalMask.addEventListener("click", closeModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalLayer.hidden) closeModal();
});

function installMouseAndCardInteractions() {
  if (!cursorDot || !cursorFollow) return;

  let enabled = false;
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let followX = targetX;
  let followY = targetY;
  let visible = false;
  let rafStarted = false;

  const enableMouseMode = () => {
    if (enabled) return;
    enabled = true;
    document.documentElement.classList.add("custom-cursor");
    const style = document.createElement("style");
    style.id = "download-mouse-runtime-style";
    style.textContent = `
      html.custom-cursor, html.custom-cursor body,
      html.custom-cursor a, html.custom-cursor button,
      html.custom-cursor input, html.custom-cursor label { cursor:none !important; }
      html.custom-cursor .cursor-dot,
      html.custom-cursor .cursor-follow { display:block !important; }
    `;
    document.head.appendChild(style);
  };

  const setVisible = (next) => {
    if (visible === next) return;
    visible = next;
    cursorDot.classList.toggle("cursor-visible", next);
    cursorFollow.classList.toggle("cursor-visible", next);
  };

  const moveCursor = (clientX, clientY) => {
    enableMouseMode();
    targetX = clientX;
    targetY = clientY;
    cursorDot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    setVisible(true);
    if (!rafStarted) {
      rafStarted = true;
      requestAnimationFrame(renderFollow);
    }
  };

  const renderFollow = () => {
    followX += (targetX - followX) * 0.35;
    followY += (targetY - followY) * 0.35;
    cursorFollow.style.transform = `translate3d(${followX}px, ${followY}px, 0)`;
    requestAnimationFrame(renderFollow);
  };

  window.addEventListener("mousemove", (event) => moveCursor(event.clientX, event.clientY), { passive: true });
  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") moveCursor(event.clientX, event.clientY);
  }, { passive: true });
  window.addEventListener("mousedown", () => cursorFollow.classList.add("pressed"), { passive: true });
  window.addEventListener("mouseup", () => cursorFollow.classList.remove("pressed"), { passive: true });
  document.addEventListener("mouseleave", () => setVisible(false));
  document.addEventListener("mouseenter", () => { if (enabled) setVisible(true); });

  const interactiveCards = document.querySelectorAll(".cards");
  interactiveCards.forEach((card) => {
    const hoverScale = card.classList.contains("utility-card") ? 1.02 : 1.01;
    let inside = false;

    card.addEventListener("mouseenter", () => {
      inside = true;
      card.style.transition = "transform 120ms ease-out, background-color .3s, backdrop-filter .3s";
    });

    card.addEventListener("mousemove", (event) => {
      enableMouseMode();
      const rect = card.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      const tx = nx * 5;
      const ty = ny * 4;
      card.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${hoverScale})`;
      if (card.classList.contains("utility-card")) card.style.backgroundColor = "rgba(0,0,0,.4)";
    }, { passive: true });

    card.addEventListener("mousedown", () => {
      card.style.transition = "transform 90ms ease-out, background-color .2s";
      card.style.transform = "translate3d(0,0,0) scale(.98)";
    });

    card.addEventListener("mouseup", () => {
      if (!inside) return;
      card.style.transition = "transform 140ms ease-out, background-color .25s";
      card.style.transform = `translate3d(0,0,0) scale(${hoverScale})`;
    });

    card.addEventListener("mouseleave", () => {
      inside = false;
      card.style.transition = "transform 220ms ease, background-color .3s, backdrop-filter .3s";
      card.style.transform = "translate3d(0,0,0) scale(1)";
      card.style.backgroundColor = "";
    });
  });
}

applyConfig();
setSession(null);
installMouseAndCardInteractions();
await initAuth();
