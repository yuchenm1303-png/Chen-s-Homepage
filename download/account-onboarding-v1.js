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

let supabase = null;
let toastTimer = null;
let recoveryMode = false;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function closeModal() {
  if (!modalLayer) return;
  modalLayer.hidden = true;
  modalBody?.replaceChildren();
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

function openRegister() {
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
  addPolicy("注册账号与软件授权是两件事。注册只建立登录身份；管理员授权 enabled=true 后，账号才获得下载、应用启动和更新权限。默认普通账号最多激活 2 台设备。\n");

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
  openModal("PASSWORD RECOVERY", "重设登录密码");

  const intro = document.createElement("p");
  intro.className = "modal-summary";
  intro.textContent = "输入注册邮箱，我们会发送密码重设邮件。密码不会由管理员查看或保存。";
  modalBody.appendChild(intro);

  const form = document.createElement("form");
  form.className = "onboarding-form";
  const email = makeField("邮箱", "email", "email", emailInput?.value.trim() || "");
  const submit = document.createElement("button");
  submit.className = "onboarding-submit";
  submit.type = "submit";
  submit.textContent = "发送重设邮件";
  const status = makeStatus();
  form.append(email.wrapper, submit, status);
  modalBody.appendChild(form);
  addPolicy("为避免泄露账号是否存在，无论邮箱是否已注册，页面都只显示统一的发送结果。收到邮件后从邮件链接返回本页设置新密码。\n");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return setStatus(status, "账号服务尚未就绪。", "error");
    const address = email.input.value.trim();
    if (!address) return setStatus(status, "请输入邮箱。", "error");

    submit.disabled = true;
    submit.textContent = "发送中…";
    setStatus(status, "正在发送密码重设邮件…");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: recoveryRedirectUrl()
      });
      if (error) throw error;
      setStatus(status, "如果该邮箱已注册，密码重设邮件会发送到邮箱。请检查收件箱和垃圾邮件。", "ok");
      showToast("密码重设邮件已请求发送");
    } catch (error) {
      console.error("password reset request failed", error);
      setStatus(status, "暂时无法发送重设邮件，请稍后重试。", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "发送重设邮件";
    }
  });

  window.setTimeout(() => email.input.focus(), 0);
}

function openSetPassword() {
  recoveryMode = true;
  openModal("SET NEW PASSWORD", "设置新密码");

  const intro = document.createElement("p");
  intro.className = "modal-summary";
  intro.textContent = "密码重设链接已验证。现在为当前账号设置一个新密码。";
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return setStatus(status, "账号服务尚未就绪。", "error");
    const pass = password.input.value;
    if (pass.length < 8) return setStatus(status, "密码至少 8 位。", "error");
    if (pass !== confirm.input.value) return setStatus(status, "两次输入的密码不一致。", "error");

    submit.disabled = true;
    submit.textContent = "保存中…";
    try {
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
      setStatus(status, "密码重设会话已失效，请重新发送密码重设邮件。", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "保存新密码";
    }
  });

  window.setTimeout(() => password.input.focus(), 0);
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

    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") openSetPassword();
    });

    const url = new URL(window.location.href);
    if (url.searchParams.get("recovery") === "1" || /type=recovery/.test(window.location.hash)) {
      const { data } = await supabase.auth.getSession();
      if (data?.session) openSetPassword();
    }
  } catch (error) {
    console.error("account onboarding initialization failed", error);
  }
}

registerAction?.addEventListener("click", openRegister);
forgotPasswordAction?.addEventListener("click", openForgotPassword);
modalClose?.addEventListener("click", () => { if (recoveryMode) recoveryMode = false; });
modalMask?.addEventListener("click", () => { if (recoveryMode) recoveryMode = false; });

void init();
