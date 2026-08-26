(() => {
  const POLL_MS = 60_000;
  const HIGH_SCORE = 85;
  const STORAGE_KEY = "leadRadarBrowserNotifications";
  const knownLeadIds = new Set();
  let primed = false;
  let polling = false;

  const supported = "Notification" in window;

  function notificationsEnabled() {
    return supported && Notification.permission === "granted" && localStorage.getItem(STORAGE_KEY) === "1";
  }

  function ensureHelperLink() {
    const actions = document.querySelector(".radar-console-actions");
    if (!actions || document.getElementById("browserHelperLink")) return;
    const link = document.createElement("a");
    link.id = "browserHelperLink";
    link.className = "login-button radar-helper-entry";
    link.href = "./helper.html";
    link.textContent = "⌁ 浏览器助手";
    link.setAttribute("aria-label", "安装 AI Lead Radar 浏览器助手");
    actions.appendChild(link);
  }

  function ensureControl() {
    const ruleList = document.querySelector(".radar-rule-list");
    if (!ruleList || document.getElementById("browserNotifyButton")) return;

    const row = document.createElement("div");
    row.className = "spec-row";
    row.innerHTML = '<span>浏览器高分提醒</span><button class="release-badge filter-chip" id="browserNotifyButton" type="button">读取中</button>';
    ruleList.appendChild(row);
    document.getElementById("browserNotifyButton")?.addEventListener("click", toggleNotifications);
    renderControl();
  }

  function renderControl() {
    const button = document.getElementById("browserNotifyButton");
    if (!button) return;
    if (!supported) {
      button.textContent = "当前浏览器不支持";
      button.disabled = true;
      return;
    }
    if (Notification.permission === "denied") {
      button.textContent = "浏览器已拒绝";
      button.disabled = true;
      return;
    }
    button.disabled = false;
    button.textContent = notificationsEnabled() ? "已开启" : "点击启用";
    button.classList.toggle("active", notificationsEnabled());
  }

  async function toggleNotifications() {
    if (!supported) return;
    if (notificationsEnabled()) {
      localStorage.removeItem(STORAGE_KEY);
      renderControl();
      showToast("浏览器高分提醒已关闭");
      return;
    }

    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem(STORAGE_KEY, "1");
      renderControl();
      showToast("浏览器高分提醒已开启 · AI Score ≥ 85");
      await poll();
    } else {
      renderControl();
      showToast("没有获得浏览器通知权限");
    }
  }

  function notifyLead(lead) {
    if (!notificationsEnabled()) return;
    const title = `AI Lead Radar · ${lead.score} 分新机会`;
    const notification = new Notification(title, {
      body: `${lead.source || "公开来源"} · ${lead.category || "开发需求"}\n${lead.title || "新需求"}`,
      tag: `lead-radar-${lead.id}`,
      renotify: false
    });
    notification.onclick = () => {
      window.focus();
      const target = safeUrl(lead.url);
      if (target) window.open(target, "_blank", "noopener,noreferrer");
      else window.location.hash = "opportunities";
      notification.close();
    };
  }

  async function poll() {
    if (polling) return;
    polling = true;
    try {
      const rows = await api(`/api/v1/leads?min_score=${HIGH_SCORE}&limit=100`);
      const snapshot = Array.isArray(rows) ? rows : [];

      if (primed) {
        snapshot
          .filter((lead) => lead.status === "new" && !knownLeadIds.has(Number(lead.id)))
          .forEach((lead) => notifyLead(lead));
      }

      snapshot.forEach((lead) => knownLeadIds.add(Number(lead.id)));
      primed = true;
    } catch {
      // Main Radar UI owns API error reporting; notification polling stays silent.
    } finally {
      polling = false;
    }
  }

  ensureHelperLink();
  ensureControl();
  poll();
  window.setInterval(poll, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") poll();
  });
})();
