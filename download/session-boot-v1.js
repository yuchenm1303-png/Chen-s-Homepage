(() => {
  const root = document.documentElement;
  const loggedOutState = document.getElementById("loggedOutState");
  const loggedInState = document.getElementById("loggedInState");
  const accountStateText = document.getElementById("accountStateText");

  if (!root.classList.contains("session-boot") || !loggedOutState || !loggedInState) return;

  const authUrl = window.DOWNLOAD_PORTAL_CONFIG?.auth?.supabaseUrl || "";
  let storageKey = "";
  let expectsPersistedSession = false;

  try {
    const projectRef = new URL(authUrl).hostname.split(".")[0];
    storageKey = projectRef ? `sb-${projectRef}-auth-token` : "";
    const raw = storageKey ? localStorage.getItem(storageKey) : "";

    if (raw) {
      const parsed = JSON.parse(raw);
      const cached = parsed?.currentSession ?? parsed?.session ?? parsed;
      const expiresAt = Number(cached?.expires_at || 0);
      expectsPersistedSession = Boolean(
        cached?.access_token && (!expiresAt || expiresAt * 1000 > Date.now() - 30000)
      );
    }
  } catch {
    expectsPersistedSession = false;
  }

  let observer = null;
  let fallbackTimer = 0;

  const reveal = () => {
    root.classList.remove("session-boot");
    observer?.disconnect();
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
  };

  const isDisplayed = (node) => !node.hidden && node.style.display !== "none";

  const check = () => {
    if (!root.classList.contains("session-boot")) return;

    if (!expectsPersistedSession) {
      reveal();
      return;
    }

    const state = accountStateText?.textContent?.trim() || "";
    if (isDisplayed(loggedInState) && state && state !== "未登录" && state !== "验证中") {
      reveal();
      return;
    }

    if (storageKey && !localStorage.getItem(storageKey) && isDisplayed(loggedOutState)) {
      reveal();
    }
  };

  observer = new MutationObserver(check);
  observer.observe(loggedOutState, { attributes: true, childList: true, subtree: true });
  observer.observe(loggedInState, { attributes: true, childList: true, subtree: true });
  if (accountStateText) observer.observe(accountStateText, { childList: true, subtree: true });

  fallbackTimer = window.setTimeout(reveal, 2400);
  check();
})();
