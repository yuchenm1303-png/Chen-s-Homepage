const cfg = window.DOWNLOAD_PORTAL_CONFIG ?? {};
const authCfg = cfg.auth ?? {};
const $ = (id) => document.getElementById(id);

const PENDING_KEY = "listing-studio-pending-signup-email";
const COOLDOWN_KEY = "listing-studio-signup-resend-next-at";
const COOLDOWN_MS = 60_000;

let client = null;
let cooldownTimer = null;
let authSubscription = null;

const modalLayer = $("modalLayer");
const modalKicker = $("modalKicker");
const modalTitle = $("modalTitle");
const modalBody = $("modalBody");
const emailInput = $("emailInput");
const toast = $("toast");

function toastMsg(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function openModal(kicker, title) {
  if (!modalLayer || !modalBody) return;
  modalBody.replaceChildren();
  if (modalKicker) modalKicker.textContent = kicker;
  if (modalTitle) modalTitle.textContent = title;
  modalLayer.hidden = false;
}

async function getSupabase() {
  if (client) return client;
  if (!authCfg.supabaseUrl || !authCfg.supabaseAnonKey) return null;

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  client = createClient(authCfg.supabaseUrl, authCfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  if (!authSubscription) {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const pending = (localStorage.getItem(PENDING_KEY) || "").trim();
      const user = session?.user;
      if (!pending || !user) return;
      const confirmed = user.email_confirmed_at || user.confirmed_at;
      if (confirmed && String(user.email || "").toLowerCase() === pending.toLowerCase()) {
        window.setTimeout(() => renderApproval(pending), 0);
      }
    });
    authSubscription = data?.subscription ?? null;
  }

  return client;
}

function field(label, type, autocomplete, value = "") {
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

function statusNode() {
  const node = document.createElement("p");
  node.className = "onboarding-status registration-inline-status";
  node.dataset.state = "neutral";
  return node;
}

function setStatus(node, text, state = "neutral") {
  if (!node) return;
  node.textContent = text;
  node.dataset.state = state;
}

function progress(active, done) {
  const root = document.createElement("div");
  root.className = "registration-progress";
  [["01", "创建账号"], ["02", "验证邮箱"], ["03", "管理员开通"]].forEach(([number, label], index) => {
    const step = index + 1;
    const item = document.createElement("div");
    item.className = "registration-progress-step";
    item.dataset.state = step <= done ? "done" : step === active ? "active" : "pending";
    const mark = document.createElement("span");
    mark.textContent = step <= done ? "✓" : number;
    const text = document.createElement("strong");
    text.textContent = label;
    item.append(mark, text);
    root.appendChild(item);
  });
  modalBody.appendChild(root);
}

function hero(symbol, overline, title, copy) {
  const root = document.createElement("section");
  root.className = "registration-state-hero";
  const icon = document.createElement("div");
  icon.className = "registration-state-icon";
  icon.textContent = symbol;
  const body = document.createElement("div");
  const over = document.createElement("span");
  over.className = "registration-state-overline";
  over.textContent = overline;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = copy;
  body.append(over, heading, paragraph);
  root.append(icon, body);
  modalBody.appendChild(root);
}

function emailChip(address) {
  const root = document.createElement("div");
  root.className = "registration-email-chip";
  const label = document.createElement("span");
  label.textContent = "注册邮箱";
  const value = document.createElement("strong");
  value.textContent = address;
  root.append(label, value);
  modalBody.appendChild(root);
}

function button(text, className) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = text;
  return node;
}

function cooldownUntil() {
  return Number(localStorage.getItem(COOLDOWN_KEY) || 0) || 0;
}

function cooldownSeconds() {
  return Math.max(0, Math.ceil((cooldownUntil() - Date.now()) / 1000));
}

function startCooldown() {
  localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
}

function syncResend(buttonNode) {
  clearInterval(cooldownTimer);
  const render = () => {
    const seconds = cooldownSeconds();
    if (seconds > 0) {
      buttonNode.disabled = true;
      buttonNode.textContent = `重新发送 (${seconds}s)`;
      return;
    }
    buttonNode.disabled = false;
    buttonNode.textContent = "重新发送验证码";
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  };
  render();
  if (cooldownSeconds() > 0) cooldownTimer = window.setInterval(render, 1000);
}

function renderVerification(address) {
  openModal("VERIFY EMAIL", "验证你的邮箱");
  hero(
    "✉",
    "EMAIL CODE SENT",
    "验证码已发送",
    "不用打开任何验证链接。保持当前窗口，在下面输入邮件中的验证码即可完成邮箱验证。"
  );
  emailChip(address);
  progress(2, 1);

  const note = document.createElement("div");
  note.className = "registration-state-note";
  note.innerHTML = "<strong>保持当前页面</strong><span>从最新一封 Listing Studio 邮件中复制验证码回来填写。验证成功后，这个窗口会直接切换到“等待管理员开通”，不会跳转新网页。</span>";
  modalBody.appendChild(note);

  const form = document.createElement("form");
  form.className = "onboarding-form registration-code-form";
  const code = field("邮箱验证码", "text", "one-time-code");
  code.input.inputMode = "numeric";
  code.input.maxLength = 10;
  code.input.placeholder = "输入邮件中的验证码";
  code.input.classList.add("registration-code-input");

  const verify = document.createElement("button");
  verify.type = "submit";
  verify.className = "registration-primary-action registration-verify-button";
  verify.textContent = "验证邮箱";

  const st = statusNode();
  setStatus(st, "等待输入邮箱验证码。", "neutral");
  form.append(code.wrapper, verify, st);
  modalBody.appendChild(form);

  const actions = document.createElement("div");
  actions.className = "registration-state-actions single";
  const resend = button("重新发送验证码", "registration-secondary-action");
  actions.appendChild(resend);
  modalBody.appendChild(actions);

  const change = button("更换邮箱重新注册", "registration-text-action");
  modalBody.appendChild(change);
  syncResend(resend);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = code.input.value.replace(/\s+/g, "");
    if (token.length < 6) return setStatus(st, "请输入完整验证码。", "error");

    const sb = await getSupabase();
    if (!sb) return setStatus(st, "账号服务还没准备好。", "error");

    verify.disabled = true;
    verify.textContent = "正在验证…";
    setStatus(st, "正在验证邮箱验证码…", "neutral");

    try {
      const { data, error } = await sb.auth.verifyOtp({
        email: address,
        token,
        type: "email"
      });
      if (error) throw error;
      if (!data?.user) throw new Error("Verification did not return a user");

      localStorage.removeItem(COOLDOWN_KEY);
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      toastMsg("邮箱验证完成");
      renderApproval(address);
    } catch (error) {
      console.error("signup email verification failed", error);
      const message = String(error?.message || "");
      if (/expired|invalid|token|otp/i.test(message)) {
        setStatus(st, "验证码无效或已过期，请重新输入最新邮件中的验证码。", "error");
      } else {
        setStatus(st, "暂时无法完成邮箱验证，请稍后再试。", "error");
      }
    } finally {
      verify.disabled = false;
      verify.textContent = "验证邮箱";
    }
  });

  resend.addEventListener("click", async () => {
    if (cooldownSeconds() > 0) return syncResend(resend);
    const sb = await getSupabase();
    if (!sb) return setStatus(st, "账号服务还没准备好。", "error");

    resend.disabled = true;
    resend.textContent = "发送中…";
    try {
      const { error } = await sb.auth.resend({ type: "signup", email: address });
      if (error) throw error;
      startCooldown();
      syncResend(resend);
      code.input.value = "";
      setStatus(st, "新的验证码已发送，请以最新一封邮件为准。", "ok");
      toastMsg("验证码已重新发送");
    } catch (error) {
      const message = String(error?.message || "");
      if (Number(error?.status || 0) === 429 || /rate limit|too many|security purposes/i.test(message)) {
        startCooldown();
        syncResend(resend);
        setStatus(st, "发送太频繁，请等待倒计时结束后再试。", "warn");
      } else {
        resend.disabled = false;
        resend.textContent = "重新发送验证码";
        setStatus(st, "验证码发送失败，请稍后再试。", "error");
      }
    }
  });

  change.addEventListener("click", () => {
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(COOLDOWN_KEY);
    openForm(address);
  });

  window.setTimeout(() => code.input.focus(), 0);
}

function renderApproval(address) {
  localStorage.setItem(PENDING_KEY, address);
  openModal("ACCOUNT CREATED", "等待权限开通");
  hero(
    "✓",
    "EMAIL VERIFIED",
    "邮箱验证完成",
    "登录身份已经确认。现在只剩管理员开通软件权限，开通后即可下载、启动和接收正式更新。"
  );
  emailChip(address);
  progress(3, 2);

  const card = document.createElement("div");
  card.className = "registration-approval-card";
  card.innerHTML = "<span>SOFTWARE ACCESS</span><strong>等待管理员开通</strong><p>注册完成不会自动获得软件权限。管理员开通后，同一账号可用于网页下载和 Listing Studio 正式安装版登录。</p>";
  modalBody.appendChild(card);

  const actions = document.createElement("div");
  actions.className = "registration-state-actions single";
  const enter = button("返回下载页面", "registration-primary-action");
  actions.appendChild(enter);
  modalBody.appendChild(actions);

  enter.addEventListener("click", () => {
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(COOLDOWN_KEY);
    window.location.reload();
  });
}

function openForm(prefill = "") {
  openModal("CREATE ACCOUNT", "注册账号");

  const intro = document.createElement("p");
  intro.className = "modal-summary";
  intro.textContent = "创建登录账号后，在当前窗口输入邮箱验证码，然后等待管理员开通软件权限。";
  modalBody.appendChild(intro);
  progress(1, 0);

  const form = document.createElement("form");
  form.className = "onboarding-form";
  const email = field("邮箱", "email", "email", prefill || emailInput?.value.trim() || "");
  const password = field("设置密码", "password", "new-password");
  const confirm = field("确认密码", "password", "new-password");
  const submit = document.createElement("button");
  submit.className = "onboarding-submit";
  submit.type = "submit";
  submit.textContent = "创建账号";
  const st = statusNode();
  form.append(email.wrapper, password.wrapper, confirm.wrapper, submit, st);
  modalBody.appendChild(form);

  const policy = document.createElement("p");
  policy.className = "onboarding-policy";
  policy.textContent = "注册只创建登录身份，不会自动授予软件下载权限。普通账号默认最多激活 2 台设备。";
  modalBody.appendChild(policy);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const sb = await getSupabase();
    if (!sb) return setStatus(st, "账号服务还没准备好。", "error");

    const address = email.input.value.trim();
    const pass = password.input.value;
    if (!address || !pass) return setStatus(st, "请填写邮箱和密码。", "error");
    if (pass.length < 8) return setStatus(st, "密码至少 8 位。", "error");
    if (pass !== confirm.input.value) return setStatus(st, "两次输入的密码不一致。", "error");

    submit.disabled = true;
    submit.textContent = "正在创建…";
    setStatus(st, "正在创建账号并发送邮箱验证码…", "neutral");

    try {
      const { data, error } = await sb.auth.signUp({ email: address, password: pass });
      if (error) throw error;

      if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
        setStatus(st, "这个邮箱可能已经注册，可以直接登录或使用“忘记密码”。", "warn");
        return;
      }

      localStorage.setItem(PENDING_KEY, address);
      startCooldown();
      password.input.value = "";
      confirm.input.value = "";

      if (data?.session) {
        toastMsg("账号已创建");
        renderApproval(address);
      } else {
        toastMsg("验证码已发送");
        renderVerification(address);
      }
    } catch (error) {
      const message = String(error?.message || "");
      if (/already|registered|exists/i.test(message)) {
        setStatus(st, "这个邮箱可能已经注册，可以直接登录或使用“忘记密码”。", "warn");
      } else if (Number(error?.status || 0) === 429 || /rate limit|too many/i.test(message)) {
        setStatus(st, "注册邮件发送太频繁，请稍后再试。", "warn");
      } else {
        console.error("account signup failed", error);
        setStatus(st, "暂时无法创建账号，请稍后再试。", "error");
      }
    } finally {
      submit.disabled = false;
      submit.textContent = "创建账号";
    }
  });

  window.setTimeout(() => email.input.focus(), 0);
}

async function restore() {
  const pending = (localStorage.getItem(PENDING_KEY) || "").trim();
  if (!pending) return;

  try {
    const sb = await getSupabase();
    if (!sb) return;
    const { data } = await sb.auth.getUser();
    const user = data?.user;
    const confirmed = user?.email_confirmed_at || user?.confirmed_at;
    if (user && confirmed && String(user.email || "").toLowerCase() === pending.toLowerCase()) {
      renderApproval(pending);
      return;
    }
  } catch (error) {
    console.debug("signup restore auth check skipped", error);
  }

  renderVerification(pending);
}

const oldRegister = $("registerAction");
if (oldRegister) {
  const freshRegister = oldRegister.cloneNode(true);
  oldRegister.replaceWith(freshRegister);
  freshRegister.addEventListener("click", () => openForm());
}

void restore();
