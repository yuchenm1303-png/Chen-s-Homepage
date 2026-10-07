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
const downloadAccessText = $("downloadAccessText");
const sessionStateText = $("sessionStateText");
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

let supabase = null;
let session = null;
let accessAuthorized = false;
let accessCheckSerial = 0;
let toastTimer = null;

function applyConfig() {
  versionNumber.textContent = release.version || "最新版";
  publishedAt.textContent = release.publishedAt ? `${release.publishedAt} 发布` : "版本信息暂不可用";
  platformText.textContent = release.platform || "Windows x64";
  fileSizeText.textContent = release.fileSize || "—";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setAccessLabel(node, text, state) {
  if (!node) return;
  node.textContent = text;
  node.dataset.state = state;
}

function renderSignedOut() {
  session = null;
  accessAuthorized = false;
  loggedOutState.hidden = false;
  loggedInState.hidden = true;
  loggedOutState.style.display = "";
  loggedInState.style.display = "none";
  accountEmail.textContent = "—";
  accountStateText.textContent = "未登录";
  downloadButton.disabled = true;
  downloadButtonHint.textContent = "登录后验证权限";
  setAccessLabel(downloadAccessText, "未验证", "neutral");
  setAccessLabel(sessionStateText, "未登录", "neutral");
  if (supabase) loginMessage.textContent = "仅已授权账户可下载最新版安装包。";
}

function renderSignedInPending(nextSession) {
  session = nextSession;
  accessAuthorized = false;
  loggedOutState.hidden = true;
  loggedInState.hidden = false;
  loggedOutState.style.display = "none";
  loggedInState.style.display = "flex";
  accountEmail.textContent = nextSession?.user?.email || "已登录用户";
  accountStateText.textContent = "验证中";
  downloadButton.disabled = true;
  downloadButtonHint.textContent = "正在验证下载权限…";
  setAccessLabel(downloadAccessText, "验证中", "pending");
  setAccessLabel(sessionStateText, "保持登录", "ok");
}

function renderAccessResult(result) {
  accessAuthorized = result.status === "authorized";

  if (result.displayName) {
    accountEmail.textContent = `${result.displayName} · ${session?.user?.email || ""}`;
  }

  if (result.status === "authorized") {
    accountStateText.textContent = "已授权";
    downloadButton.disabled = false;
    downloadButtonHint.textContent = release.version || "最新版";
    setAccessLabel(downloadAccessText, "已解锁", "ok");
    return;
  }

  downloadButton.disabled = true;

  if (result.status === "expired") {
    accountStateText.textContent = "已过期";
    downloadButtonHint.textContent = "下载权限已过期";
    setAccessLabel(downloadAccessText, "已过期", "warn");
  } else if (result.status === "disabled") {
    accountStateText.textContent = "已停用";
    downloadButtonHint.textContent = "下载权限已停用";
    setAccessLabel(downloadAccessText, "已停用", "warn");
  } else if (result.status === "error") {
    accountStateText.textContent = "验证失败";
    downloadButtonHint.textContent = "暂时无法验证权限";
    setAccessLabel(downloadAccessText, "验证失败", "warn");
  } else {
    accountStateText.textContent = "未授权";
    downloadButtonHint.textContent = "账户未获下载权限";
    setAccessLabel(downloadAccessText, "未授权", "warn");
  }
}

async function verifyPortalAccess(nextSession) {
  const serial = ++accessCheckSerial;

  if (!nextSession?.user?.id) {
    renderSignedOut();
    return { status: "signed_out" };
  }

  renderSignedInPending(nextSession);

  try {
    const table = authConfig.accessTable || "download_portal_users";
    const { data, error } = await supabase
      .from(table)
      .select("enabled, expires_at, display_name")
      .eq("user_id", nextSession.user.id)
      .maybeSingle();

    if (serial !== accessCheckSerial) return { status: "stale" };
    if (error) throw error;

    let result;
    if (!data) {
      result = { status: "unauthorized" };
    } else if (!data.enabled) {
      result = { status: "disabled", displayName: data.display_name };
    } else if (data.expires_at && Date.parse(data.expires_at) <= Date.now()) {
      result = { status: "expired", displayName: data.display_name };
    } else {
      result = { status: "authorized", displayName: data.display_name };
    }

    renderAccessResult(result);
    return result;
  } catch (error) {
    console.error("download portal access check failed", error);
    if (serial !== accessCheckSerial) return { status: "stale" };
    const result = { status: "error" };
    renderAccessResult(result);
    return result;
  }
}

async function initAuth() {
  if (!authConfig.supabaseUrl || !authConfig.supabaseAnonKey) {
    loginMessage.textContent = "登录服务尚未配置。";
    renderSignedOut();
    return;
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await verifyPortalAccess(data.session);

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      void verifyPortalAccess(nextSession);
    });
  } catch (error) {
    console.error("download portal auth initialization failed", error);
    loginMessage.textContent = "登录服务初始化失败，请稍后重试。";
    renderSignedOut();
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
  if (!supabase) return showToast("登录服务尚未就绪");

  const submitButton = loginForm.querySelector("button[type='submit']");
  const submitLabel = submitButton.querySelector("span") || submitButton;
  submitButton.disabled = true;
  submitLabel.textContent = "验证中…";
  loginMessage.textContent = "正在验证账户与下载权限…";

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value
    });
    if (error) throw error;

    passwordInput.value = "";
    const access = await verifyPortalAccess(data.session);

    if (access.status === "authorized") {
      showToast("登录成功，下载权限已解锁");
    } else if (access.status === "expired") {
      showToast("登录成功，但下载权限已过期");
    } else if (access.status === "disabled") {
      showToast("登录成功，但下载权限已停用");
    } else if (access.status === "error") {
      showToast("登录成功，但权限验证失败");
    } else {
      showToast("登录成功，但账户尚未获得下载权限");
    }
  } catch (error) {
    console.error("download portal sign in failed", error);
    loginMessage.textContent = "邮箱或密码错误，请重试。";
    showToast("登录失败");
  } finally {
    submitButton.disabled = false;
    submitLabel.textContent = "登录并验证权限";
  }
});

logoutButton.addEventListener("click", async () => {
  accessCheckSerial += 1;
  if (supabase) await supabase.auth.signOut();
  renderSignedOut();
  showToast("已退出登录");
});

downloadButton.addEventListener("click", async () => {
  if (!session) {
    showToast("请先登录");
    emailInput.focus();
    return;
  }

  if (!accessAuthorized) {
    showToast("当前账户没有有效下载权限");
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
        body: JSON.stringify({
          action: "download_latest",
          platform: "windows-x64"
        })
      });

      if (!response.ok) throw new Error(`download function returned ${response.status}`);
      const payload = await response.json();
      url = payload.url || "";
    }

    if (!url) {
      showToast("最新版安装包尚未发布");
      return;
    }

    window.location.assign(url);
  } catch (error) {
    console.error("download portal download failed", error);
    showToast("暂时无法生成下载链接");
  } finally {
    downloadButton.disabled = !accessAuthorized;
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
      ["02", "无法登录", "确认邮箱与密码正确。登录成功后，系统还会继续验证该账户是否具有下载权限。"],
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
  const cards = [...document.querySelectorAll(".cards")];
  const isDeepestCardTarget = (card, target) => target.closest?.(".cards") === card;

  cards.forEach((card) => {
    const hoverScale = card.classList.contains("utility-card") ? 1.02 : 1.01;
    let mouseInside = false;
    let mouseRect = null;
    let pendingMouse = null;
    let mouseRaf = 0;
    let touchId = null;
    let touchRect = null;

    const setCardTransform = (transform, transition = "transform 120ms ease-out, background-color .3s") => {
      card.style.transition = transition;
      card.style.transform = transform;
    };

    const clearCard = () => {
      if (mouseRaf) {
        cancelAnimationFrame(mouseRaf);
        mouseRaf = 0;
      }
      pendingMouse = null;
      mouseRect = null;
      card.style.transition = "transform 220ms ease, background-color .3s";
      card.style.transform = "translate3d(0,0,0) scale(1)";
      card.style.backgroundColor = "";
    };

    const renderMouseMove = () => {
      mouseRaf = 0;
      if (!mouseInside || !mouseRect || !pendingMouse) return;

      const { clientX, clientY } = pendingMouse;
      pendingMouse = null;
      const nx = (clientX - mouseRect.left) / mouseRect.width - 0.5;
      const ny = (clientY - mouseRect.top) / mouseRect.height - 0.5;
      const tx = nx * 5;
      const ty = ny * 4;
      setCardTransform(`translate3d(${tx}px, ${ty}px, 0) scale(${hoverScale})`);
      if (card.classList.contains("utility-card")) card.style.backgroundColor = "rgba(0,0,0,.4)";
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
      mouseRect = card.getBoundingClientRect();
      card.style.transition = "transform 120ms ease-out, background-color .3s";
    });

    card.addEventListener("mousemove", (event) => {
      if (!isDeepestCardTarget(card, event.target)) return;
      pendingMouse = { clientX: event.clientX, clientY: event.clientY };
      if (!mouseRaf) mouseRaf = requestAnimationFrame(renderMouseMove);
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
renderSignedOut();
installMouseAndTouchInteractions();
await initAuth();
