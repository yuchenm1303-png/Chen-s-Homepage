const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const authConfig = config.auth ?? {};
const statusPanel = document.getElementById("statusPanel");
const refreshButton = document.getElementById("refreshButton");
const heading = document.querySelector(".usage-heading");

let supabase = null;
let loginPanel = null;
let loginMessage = null;
let loginForm = null;
let emailInput = null;
let passwordInput = null;
let submitButton = null;
let monitorStarted = false;

function setStatus(text, state = "neutral") {
  if (!statusPanel) return;
  statusPanel.textContent = text;
  statusPanel.dataset.state = state;
}

function ensureLoginPanel() {
  if (loginPanel) return loginPanel;

  const panel = document.createElement("section");
  panel.className = "account-card cards fade";
  panel.id = "tenantLoginSection";
  panel.style.cssText = "max-width:560px;margin:4px 0 14px;padding:20px;";
  panel.innerHTML = `
    <div class="account-head">
      <div><p class="kicker">CUSTOMER ACCESS</p><h2>客户监控登录</h2></div>
      <span class="secure-pill">SECURE</span>
    </div>
    <p class="account-intro">使用已授权的客户账户登录。若已在下载页登录，这里会自动复用当前登录状态。</p>
    <form id="tenantLoginForm" class="login-form" autocomplete="on">
      <label>
        <span>邮箱</span>
        <input id="tenantEmailInput" type="email" autocomplete="email" placeholder="name@example.com" required />
      </label>
      <label>
        <span>密码</span>
        <input id="tenantPasswordInput" type="password" autocomplete="current-password" placeholder="••••••••" required />
      </label>
      <button id="tenantLoginButton" class="login-button cards" type="submit"><span>登录监控</span></button>
    </form>
    <p id="tenantLoginMessage" class="form-note">仅已授权的客户租户账户可访问。</p>
  `;

  if (heading?.parentNode) heading.insertAdjacentElement("afterend", panel);
  else document.querySelector(".usage-shell")?.prepend(panel);

  loginPanel = panel;
  loginMessage = panel.querySelector("#tenantLoginMessage");
  loginForm = panel.querySelector("#tenantLoginForm");
  emailInput = panel.querySelector("#tenantEmailInput");
  passwordInput = panel.querySelector("#tenantPasswordInput");
  submitButton = panel.querySelector("#tenantLoginButton");
  loginForm?.addEventListener("submit", handleLogin);
  return panel;
}

function showLogin(message, email = "") {
  const panel = ensureLoginPanel();
  panel.hidden = false;
  if (emailInput && email && !emailInput.value) emailInput.value = email;
  if (loginMessage) loginMessage.textContent = message;
  setStatus("需要客户账户登录后才能读取监控数据。", "warn");
  if (refreshButton) refreshButton.disabled = true;
}

function hideLogin() {
  if (loginPanel) loginPanel.hidden = true;
}

async function hasTenantMonitorAccess() {
  const { error } = await supabase.functions.invoke("portal-usage-tenant", {
    body: { scope: "core" }
  });
  return !error;
}

async function startMonitor() {
  if (monitorStarted) return;
  monitorStarted = true;
  hideLogin();
  setStatus("正在加载客户监控数据…", "neutral");
  if (refreshButton) refreshButton.disabled = false;
  await Promise.all([
    import("./usage-admin-v2.js?v=20260902-seamless-motion-1"),
    import("./usage-ops-v1.js?v=20260830-0910")
  ]);
}

async function handleLogin(event) {
  event.preventDefault();
  if (!supabase || !emailInput || !passwordInput || !submitButton) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return;

  submitButton.disabled = true;
  if (loginMessage) loginMessage.textContent = "正在验证账户…";

  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      if (loginMessage) loginMessage.textContent = "邮箱或密码错误，请重新输入。";
      return;
    }

    if (!(await hasTenantMonitorAccess())) {
      await supabase.auth.signOut();
      if (passwordInput) passwordInput.value = "";
      if (loginMessage) loginMessage.textContent = "此账号没有客户监控权限。";
      setStatus("当前账户无权访问客户监控。", "warn");
      return;
    }

    await startMonitor();
  } catch (error) {
    console.error("tenant monitor login failed", error);
    if (loginMessage) loginMessage.textContent = "登录验证暂时不可用，请稍后重试。";
  } finally {
    submitButton.disabled = false;
  }
}

async function init() {
  if (!authConfig.supabaseUrl || !authConfig.supabaseAnonKey) {
    showLogin("登录服务配置缺失，请联系管理员。");
    return;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showLogin("无法读取当前登录状态，请重新登录。", "");
    return;
  }

  const session = data?.session ?? null;
  if (!session) {
    showLogin("请使用客户账户登录。若已在下载页登录，刷新本页即可自动进入。", "");
    return;
  }

  setStatus("正在验证客户监控权限…", "neutral");
  if (await hasTenantMonitorAccess()) {
    await startMonitor();
  } else {
    showLogin("当前登录账号没有客户监控权限，可使用客户账户重新登录。", session.user?.email || "");
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && monitorStarted) window.location.reload();
  });
}

void init();