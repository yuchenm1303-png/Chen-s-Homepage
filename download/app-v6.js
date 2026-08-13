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
const passwordToggle = $("passwordToggle");
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

  if (!signedIn && supabase) {
    loginMessage.textContent = "登录后即可下载最新版安装包。";
  }
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

passwordToggle?.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  passwordToggle.textContent = showing ? "显示" : "隐藏";
  passwordToggle.setAttribute("aria-pressed", String(!showing));
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return showToast("登录服务尚未配置");

  const submitButton = loginForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.firstChild.textContent = "验证中…";
  loginMessage.textContent = "正在验证账户…";

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value
    });
    if (error) throw error;
    setSession(data.session);
    passwordInput.value = "";
    showToast("登录成功，下载已解锁");
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "邮箱或密码错误，请重试。";
    showToast("登录失败");
  } finally {
    submitButton.disabled = false;
    submitButton.firstChild.textContent = "登录并解锁";
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
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
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

function addModalSummary(text) {
  const summary = document.createElement("p");
  summary.className = "modal-summary";
  summary.textContent = text;
  modalBody.appendChild(summary);
}

function openModal(kind) {
  modalBody.replaceChildren();

  if (kind === "notes") {
    modalKicker.textContent = "RELEASE NOTES";
    modalTitle.textContent = `${release.version || "最新版"} 更新日志`;
    addModalSummary("当前正式版本的核心变化。这里会跟随后续发布版本持续更新。");

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
    addModalSummary("安装前建议确认以下基础环境，避免首次启动时缺少浏览器运行时或系统组件。");

    const specs = [
      ["操作系统", "Windows 10 / 11"],
      ["系统架构", "x64"],
      ["浏览器运行时", "Microsoft Edge"],
      ["发布通道", "Stable"],
      ["当前版本", release.version || "最新版"]
    ];

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

    const note = document.createElement("p");
    note.className = "spec-note";
    note.textContent = "Makro 浏览器自动化依赖本机 Microsoft Edge。正式安装包发布后，这里还会显示准确的安装包大小与校验信息。";
    modalBody.appendChild(note);
  } else if (kind === "support") {
    modalKicker.textContent = "INSTALLATION SUPPORT";
    modalTitle.textContent = "安装帮助";
    addModalSummary("如果安装、登录或启动出现问题，可以先按下面三个方向快速排查。");

    const grid = document.createElement("div");
    grid.className = "support-grid";
    const items = [
      ["01", "安装失败", "确认 Windows 为 x64，并重新下载安装包后以普通用户方式启动安装。"],
      ["02", "无法登录", "确认邮箱与密码正确；登录服务接入后会在这里显示更明确的账户状态。"],
      ["03", "程序无法启动", "确认 Microsoft Edge 可正常打开，并检查系统是否拦截了首次运行。"]
    ];

    for (const [index, title, copy] of items) {
      const item = document.createElement("div");
      item.className = "support-item";
      const indexNode = document.createElement("span");
      indexNode.className = "support-index";
      indexNode.textContent = index;
      const body = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = title;
      const paragraph = document.createElement("p");
      paragraph.textContent = copy;
      body.append(strong, paragraph);
      item.append(indexNode, body);
      grid.appendChild(item);
    }
    modalBody.appendChild(grid);
  }

  modalLayer.hidden = false;
}

notesAction.addEventListener("click", () => openModal("notes"));
systemAction.addEventListener("click", () => openModal("system"));
supportAction.addEventListener("click", () => openModal("support"));
modalClose.addEventListener("click", closeModal);
modalMask.addEventListener("click", closeModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalLayer.hidden) closeModal();
});

function installMouseAndTouchInteractions() {
  let mouseEnabled = false;
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let followX = targetX;
  let followY = targetY;
  let cursorVisible = false;
  let cursorRafStarted = false;

  const enableMouseMode = () => {
    if (mouseEnabled || !cursorDot || !cursorFollow) return;
    mouseEnabled = true;
    document.documentElement.classList.add("custom-cursor");

    if (!document.getElementById("download-mouse-runtime-style")) {
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
    }
  };

  const setCursorVisible = (next) => {
    if (!cursorDot || !cursorFollow || cursorVisible === next) return;
    cursorVisible = next;
    cursorDot.classList.toggle("cursor-visible", next);
    cursorFollow.classList.toggle("cursor-visible", next);
  };

  const renderCursorFollow = () => {
    followX += (targetX - followX) * 0.35;
    followY += (targetY - followY) * 0.35;
    cursorFollow.style.transform = `translate3d(${followX}px, ${followY}px, 0)`;
    requestAnimationFrame(renderCursorFollow);
  };

  const moveCursor = (clientX, clientY) => {
    enableMouseMode();
    if (!mouseEnabled) return;
    targetX = clientX;
    targetY = clientY;
    cursorDot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    setCursorVisible(true);
    if (!cursorRafStarted) {
      cursorRafStarted = true;
      requestAnimationFrame(renderCursorFollow);
    }
  };

  window.addEventListener("mousemove", (event) => moveCursor(event.clientX, event.clientY), { passive: true });
  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") moveCursor(event.clientX, event.clientY);
  }, { passive: true });
  window.addEventListener("mousedown", () => cursorFollow?.classList.add("pressed"), { passive: true });
  window.addEventListener("mouseup", () => cursorFollow?.classList.remove("pressed"), { passive: true });
  document.addEventListener("mouseleave", () => setCursorVisible(false));
  document.addEventListener("mouseenter", () => { if (mouseEnabled) setCursorVisible(true); });

  const cards = [...document.querySelectorAll(".cards")];
  const isDeepestCardTarget = (card, target) => target.closest?.(".cards") === card;

  cards.forEach((card) => {
    const hoverScale = card.classList.contains("utility-card") ? 1.02 : 1.01;
    let mouseInside = false;
    let touchId = null;
    let touchRect = null;

    const setCardTransform = (transform, transition = "transform 120ms ease-out, background-color .3s, backdrop-filter .3s") => {
      card.style.transition = transition;
      card.style.transform = transform;
    };

    const clearCard = () => {
      card.style.transition = "transform 220ms ease, background-color .3s, backdrop-filter .3s";
      card.style.transform = "translate3d(0,0,0) scale(1)";
      card.style.backgroundColor = "";
    };

    const bounceHome = () => {
      const bounceScale = card.classList.contains("utility-card") ? 1.02 : 1.01;
      setCardTransform(`translate3d(0,0,0) scale(${bounceScale})`, "transform 95ms ease-out, background-color .2s");
      window.setTimeout(() => {
        if (touchId === null && !mouseInside) clearCard();
      }, 105);
    };

    card.addEventListener("mouseenter", () => {
      mouseInside = true;
      card.style.transition = "transform 120ms ease-out, background-color .3s, backdrop-filter .3s";
    });

    card.addEventListener("mousemove", (event) => {
      if (!isDeepestCardTarget(card, event.target)) return;
      enableMouseMode();
      const rect = card.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      const tx = nx * 5;
      const ty = ny * 4;
      setCardTransform(`translate3d(${tx}px, ${ty}px, 0) scale(${hoverScale})`);
      if (card.classList.contains("utility-card")) card.style.backgroundColor = "rgba(0,0,0,.4)";
    }, { passive: true });

    card.addEventListener("mousedown", (event) => {
      if (!isDeepestCardTarget(card, event.target)) return;
      setCardTransform("translate3d(0,0,0) scale(.98)", "transform 90ms ease-out, background-color .2s");
    });

    card.addEventListener("mouseup", () => {
      if (!mouseInside) return;
      setCardTransform(`translate3d(0,0,0) scale(${hoverScale})`, "transform 140ms ease-out, background-color .25s");
    });

    card.addEventListener("mouseleave", () => {
      mouseInside = false;
      if (touchId === null) clearCard();
    });

    card.addEventListener("touchstart", (event) => {
      if (!isDeepestCardTarget(card, event.target)) return;
      if (event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      touchId = touch.identifier;
      touchRect = card.getBoundingClientRect();
      setCardTransform("translate3d(0,0,0) scale(.98)", "transform 85ms ease-out, background-color .18s");
      if (card.classList.contains("utility-card")) card.style.backgroundColor = "rgba(0,0,0,.4)";
    }, { passive: true });

    card.addEventListener("touchmove", (event) => {
      if (touchId === null || !touchRect) return;
      const touch = [...event.changedTouches].find((item) => item.identifier === touchId);
      if (!touch) return;
      const nx = Math.max(-0.5, Math.min(0.5, (touch.clientX - touchRect.left) / touchRect.width - 0.5));
      const ny = Math.max(-0.5, Math.min(0.5, (touch.clientY - touchRect.top) / touchRect.height - 0.5));
      const tx = nx * 3.2;
      const ty = ny * 2.8;
      setCardTransform(`translate3d(${tx}px, ${ty}px, 0) scale(.985)`, "transform 70ms linear, background-color .18s");
    }, { passive: true });

    const finishTouch = (event) => {
      if (touchId === null) return;
      if (event?.changedTouches?.length) {
        const matched = [...event.changedTouches].some((item) => item.identifier === touchId);
        if (!matched) return;
      }
      touchId = null;
      touchRect = null;
      bounceHome();
    };

    card.addEventListener("touchend", finishTouch, { passive: true });
    card.addEventListener("touchcancel", finishTouch, { passive: true });
  });
}

applyConfig();
setSession(null);
installMouseAndTouchInteractions();
await initAuth();
