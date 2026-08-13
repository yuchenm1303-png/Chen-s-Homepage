const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const authConfig = config.auth ?? {};

const $ = (id) => document.getElementById(id);
const registerAction = $("registerAction");
const forgotPasswordAction = $("forgotPasswordAction");
const emailInput = $("emailInput");
const modalLayer = $("modalLayer");
const modalMask = $("modalMask");
const modalClose = $("modalClose");
const modalKicker = $("modalKicker");
const modalTitle = $("modalTitle");
const modalBody = $("modalBody");
const toast = $("toast");

const initialUrl = new URL(window.location.href);
const recoveryIntent =
  initialUrl.searchParams.get("recovery") === "1" ||
  /(?:^|[&#])type=recovery(?:&|$)/.test(window.location.hash) ||
  (/(?:^|[&#])access_token=/.test(window.location.hash) && /type=recovery/.test(window.location.hash));

const RECOVERY_COOLDOWN_MS = 60_000;
const RECOVERY_COOLDOWN_KEY = "listing-studio-password-reset-next-at";

let supabase = null;
let toastTimer = null;
let recoveryMode = false;
let recoveryDialogOpen = false;
let cooldownTimer = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openModal(kicker, title) {
  if (!modalLayer || !modalBody) return;
  modalBody.replaceChildren();
  if (modalKicker) modalKicker.textContent = kicker;
  if (modalTitle) modalTitle.textContent = title;
  modalLayer.hidden = false;
}

function makeField(label, type, autocomplete, value = "") {
  const wrapper = document.createElement("label");
  wrapper.className = "onboarding-field";
  const caption = document.createElement("span");
  caption.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.autocomplete = autocomplete;
  input.value = value;
  wrapper.append(caption, input);
  return { wrapper, input };
}

function makeStatus() {
  const node = document.createElement("p");
  node.className = "onboarding-status";
  node.dataset.state = "neutral";
  return node;
}

function setStatus(node, text, state = "neutral") {
  if (!node) return;
  node.textContent = text;
  node.dataset.state = state;
}

function addPolicy(text) {
  const node = document.createElement("p");
  node.className = "onboarding-policy";
  node.textContent = text;
  modalBody.appendChild(node);
}

function recoveryRedirectUrl() {
  const url = new URL("/download/", window.location.origin);
  url.searchParams.set("recovery", "1");
  return url.toString();
}

function signupRedirectUrl() {
  return new URL("/download/", window.location.origin).toString();
}

function cooldownUntil() {
  const raw = Number(localStorage.getItem(RECOVERY_COOLDOWN_KEY) || 0);
  return Number.isFinite(raw) ? raw : 0;
}

function cooldownSeconds() {
  return Math.max(0, Math.ceil((cooldownUntil() - Date.now()) / 1000));
}

function syncCooldownButton(button) {
  clearInterval(cooldownTimer);

  const render = () => {
    const seconds = cooldownSeconds();
    if (seconds > 0) {
      button.disabled = true;
      button.textContent = `重新发送 (${seconds}s)`;
      return;
    }
    button.disabled = false;
    button.textContent = "发送验证码";
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  };

  render();
  if (cooldownSeconds() > 0) cooldownTimer = setInterval(render, 1000);
}

function startCooldown(button) {
  localStorage.setItem(RECOVERY_COOLDOWN_KEY, String(Date.now() + RECOVERY_COOLDOWN_MS));
  syncCooldownButton(button);
}

function openRegister() {
  recoveryDialogOpen = false;
  openModal("CREATE ACCOUNT", "注册 Listing Studio 账号");

  const intro = document.createElement("p");
  intro.className = "modal-summary";
  intro.textContent = "先创建登录账号。账号创建成功后仍需要管理员授权，未授权账号不能下载或运行正式安装版。";
  modalBody.appendChild(intro);

  const form = document.createElement("form");
  form.className = "onboarding-form";
  const email = makeField("邮箱", "email", "email", emailInput?.value.trim() || "");
  const password = makeField("设置密码", "password", "new-password");
  const confirm = makeField("确认密码", "password", "new-password");
  const submit = document.createElement("button");
  submit.className = "onboarding-submit";
  submit.type = "submit";
  submit.textContent = "创建账号";
  const status = makeStatus();

  form.append(email.wrapper, password.wrapper, confirm.wrapper, submit, status);
  modalBody.appendChild(form);
  addPolicy("注册账号与软件授权是两件事。注册只建立登录身份；管理员授权后，账号才获得下载、应用启动和更新权限。默认普通账号最多激活 2 台设备。");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return setStatus(status, "账号服务尚未就绪。", "error");

    const address = email.input.value.trim();
    const pass = password.input.value;
    if (!address || !pass) return setStatus(status, "请填写邮箱和密码。", "error");
    if (pass.length < 8) return setStatus(status, "密码至少 8 位。", "error");
    if (pass !== confirm.input.value) return setStatus(status, "两次输入的密码不一致。", "error");

    submit.disabled = true;
    submit.textContent = "创建中…";
    setStatus(status, "正在创建账号…");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: address,
        password: pass,
        options: { emailRedirectTo: signupRedirectUrl() }
      });
      if (error) throw error;

      if (data?.session) {
        setStatus(status, "账号已创建。当前账号尚未获得软件授权，请等待管理员授权。", "ok");
      } else {
        setStatus(status, "账号申请已提交。请先检查邮箱完成验证，然后等待管理员授权。", "ok");
      }
      showToast("账号已创建，仍需管理员授权");
      password.input.value = "";
      confirm.input.value = "";
    } catch (error) {
      console.error("account signup failed", error);
      const message = String(error?.message || "");
      if (/already|registered|exists/i.test(message)) {
        setStatus(status, "这个邮箱可能已经注册，请直接登录或使用“忘记密码”。", "warn");
      } else {
        setStatus(status, "暂时无法创建账号，请稍后重试。", "error");
      }
    } finally {
      submit.disabled = false;
      submit.textContent = "创建账号";
    }
  });

  window.setTimeout(() => email.input.focus(), 0);
}

function openForgotPassword() {
  recoveryDialogOpen = false;
  openModal("PASSWORD RECOVERY", "重设登录密码");

  const intro = document.createElement("p");
  intro.className = "modal-summary";
  intro.textContent = "输入注册邮箱获取一次性验证码。验证码不会被 QQ 等邮箱的安全链接扫描提前消费。";
  modalBody.appendChild(intro);

  const requestForm = document.createElement("form");
  requestForm.className = "onboarding-form";
  const email = makeField("邮箱", "email", "email", emailInput?.value.trim() || "");
  const send = document.createElement("button");
  send.className = "onboarding-submit";
  send.type = "submit";
  send.textContent = "发送验证码";
  const requestStatus = makeStatus();
  requestForm.append(email.wrapper, send, requestStatus);
  modalBody.appendChild(requestForm);

  const verifyForm = document.createElement("form");
  verifyForm.className = "onboarding-form";
  verifyForm.hidden = true;
  const code = makeField("邮件验证码", "text", "one-time-code");
  code.input.inputMode = "numeric";
  code.input.maxLength = 10;
  code.input.placeholder = "输入邮件中的验证码";
  const password = makeField("新密码", "password", "new-password");
  const confirm = makeField("确认新密码", "password", "new-password");
  const verify = document.createElement("button");
  verify.className = "onboarding-submit";
  verify.type = "submit";
  verify.textContent = "验证并保存新密码";
  const verifyStatus = makeStatus();
  verifyForm.append(code.wrapper, password.wrapper, confirm.wrapper, verify, verifyStatus);
  modalBody.appendChild(verifyForm);

  addPolicy("发送成功后 60 秒内不能重复发送；刷新页面也会保留剩余时间。验证码验证成功后才允许修改密码。");
  syncCooldownButton(send);

  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return setStatus(requestStatus, "账号服务尚未就绪。", "error");
    const address = email.input.value.trim();
    if (!address) return setStatus(requestStatus, "请输入邮箱。", "error");
    if (cooldownSeconds() > 0) return syncCooldownButton(send);

    send.disabled = true;
    send.textContent = "发送中…";
    setStatus(requestStatus, "正在发送密码重设验证码…");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: recoveryRedirectUrl()
      });
      if (error) throw error;

      verifyForm.hidden = false;
      startCooldown(send);
      setStatus(requestStatus, "如果该邮箱已注册，验证码已经发送。请查看最新一封 Listing Studio 邮件。", "ok");
      setStatus(verifyStatus, "输入邮件中的验证码，再设置新密码。", "neutral");
      showToast("密码重设验证码已请求发送");
      window.setTimeout(() => code.input.focus(), 0);
    } catch (error) {
      console.error("password reset request failed", error);
      const message = String(error?.message || "");
      const statusCode = Number(error?.status || 0);
      if (/security purposes.*after|rate limit|too many|over_email_send_rate_limit/i.test(message) || statusCode === 429) {
        startCooldown(send);
        setStatus(requestStatus, "发送过于频繁，请等待倒计时结束后再试。", "warn");
        showToast("请等待倒计时结束后再发送");
      } else {
        send.disabled = false;
        send.textContent = "发送验证码";
        setStatus(requestStatus, "暂时无法发送验证码，请稍后重试。", "error");
      }
    }
  });

  verifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return setStatus(verifyStatus, "账号服务尚未就绪。", "error");

    const address = email.input.value.trim();
    const token = code.input.value.replace(/\s+/g, "");
    const pass = password.input.value;
    if (!address) return setStatus(verifyStatus, "请输入邮箱。", "error");
    if (token.length < 6) return setStatus(verifyStatus, "请输入邮件中的完整验证码。", "error");
    if (pass.length < 8) return setStatus(verifyStatus, "密码至少 8 位。", "error");
    if (pass !== confirm.input.value) return setStatus(verifyStatus, "两次输入的密码不一致。", "error");

    verify.disabled = true;
    verify.textContent = "验证中…";
    setStatus(verifyStatus, "正在验证验证码…");

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: address,
        token,
        type: "recovery"
      });
      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({ password: pass });
      if (updateError) throw updateError;

      localStorage.removeItem(RECOVERY_COOLDOWN_KEY);
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      setStatus(verifyStatus, "新密码已保存。网站和 Listing Studio 正式安装版都使用这个账号密码登录。", "ok");
      showToast("密码已更新");
      password.input.value = "";
      confirm.input.value = "";
      code.input.value = "";
    } catch (error) {
      console.error("password otp recovery failed", error);
      const message = String(error?.message || "");
      if (/expired|invalid|token|otp/i.test(message)) {
        setStatus(verifyStatus, "验证码无效或已过期，请等待倒计时结束后重新发送。", "error");
      } else {
        setStatus(verifyStatus, "暂时无法完成密码重设，请稍后重试。", "error");
      }
    } finally {
      verify.disabled = false;
      verify.textContent = "验证并保存新密码";
    }
  });

  window.setTimeout(() => email.input.focus(), 0);
}

function openSetPassword() {
  if (recoveryDialogOpen) return;
  recoveryMode = true;
  recoveryDialogOpen = true;
  openModal("SET NEW PASSWORD", "设置新密码");

  const intro = document.createElement("p");
  intro.className = "modal-summary";
  intro.textContent = "检测到旧式密码重设链接。若链接被邮箱安全扫描提前访问，请关闭此窗口，使用“忘记密码”中的验证码方式重设。";
  modalBody.appendChild(intro);

  const form = document.createElement("form");
  form.className = "onboarding-form";
  const password = makeField("新密码", "password", "new-password");
  const confirm = makeField("确认新密码", "password", "new-password");
  const submit = document.createElement("button");
  submit.className = "onboarding-submit";
  submit.type = "submit";
  submit.textContent = "保存新密码";
  const status = makeStatus();
  form.append(password.wrapper, confirm.wrapper, submit, status);
  modalBody.appendChild(form);
  setStatus(status, "正在确认密码重设会话…");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return setStatus(status, "账号服务尚未就绪。", "error");
    const pass = password.input.value;
    if (pass.length < 8) return setStatus(status, "密码至少 8 位。", "error");
    if (pass !== confirm.input.value) return setStatus(status, "两次输入的密码不一致。", "error");

    submit.disabled = true;
    submit.textContent = "保存中…";
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data?.session) throw new Error("No recovery session");

      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
      setStatus(status, "新密码已保存。以后网站和 Listing Studio 正式安装版都使用这个账号密码登录。", "ok");
      showToast("密码已更新");
      recoveryMode = false;

      const clean = new URL(window.location.href);
      clean.searchParams.delete("recovery");
      clean.hash = "";
      window.history.replaceState({}, "", clean.pathname + clean.search);
    } catch (error) {
      console.error("password update failed", error);
      setStatus(status, "旧式链接会话已失效。请关闭此窗口，使用“忘记密码”重新发送验证码。", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "保存新密码";
    }
  });

  window.setTimeout(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setStatus(status, "重设会话已验证，可以设置新密码。", "ok");
      } else {
        setStatus(status, "未检测到有效重设会话，请改用验证码方式重设。", "warn");
      }
    } catch {
      setStatus(status, "未检测到有效重设会话，请改用验证码方式重设。", "warn");
    }
    password.input.focus();
  }, 0);
}

async function init() {
  if (!authConfig.supabaseUrl || !authConfig.supabaseAnonKey) return;
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    if (recoveryIntent) openSetPassword();

    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") openSetPassword();
    });
  } catch (error) {
    console.error("account onboarding initialization failed", error);
    if (recoveryIntent) openSetPassword();
  }
}

registerAction?.addEventListener("click", openRegister);
forgotPasswordAction?.addEventListener("click", openForgotPassword);
modalClose?.addEventListener("click", () => {
  if (recoveryMode) recoveryMode = false;
  recoveryDialogOpen = false;
  clearInterval(cooldownTimer);
  cooldownTimer = null;
});
modalMask?.addEventListener("click", () => {
  if (recoveryMode) recoveryMode = false;
  recoveryDialogOpen = false;
  clearInterval(cooldownTimer);
  cooldownTimer = null;
});

void init();
