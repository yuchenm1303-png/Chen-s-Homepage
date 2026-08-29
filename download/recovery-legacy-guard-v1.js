(() => {
  const url = new URL(window.location.href);
  const hasLegacyRecovery =
    url.searchParams.get("recovery") === "1" ||
    /(?:^|[&#])type=recovery(?:&|$)/.test(window.location.hash) ||
    (/(?:^|[&#])access_token=/.test(window.location.hash) && /type=recovery/.test(window.location.hash));

  if (!hasLegacyRecovery) return;

  url.searchParams.delete("recovery");
  url.hash = "";
  window.history.replaceState({}, "", url.pathname + url.search);
})();

(() => {
  const script = document.createElement("script");
  script.src = "./portal-content-v2.js?v=20260813-2";
  script.async = false;
  document.head.appendChild(script);
})();

(() => {
  const script = document.createElement("script");
  script.src = "./listing-studio-brand-v1.js?v=20260829-1";
  script.async = false;
  document.head.appendChild(script);
})();

// Registration v2 keeps email confirmation inside the original registration
// window by verifying the email OTP in-place. No confirmation-page redirect is
// required for the normal signup flow.
(() => {
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "./registration-flow-v1.css?v=20260813-2";
  document.head.appendChild(style);

  const boot = () => window.setTimeout(() => {
    import("./registration-flow-v2.js?v=20260813-1").catch((error) => {
      console.error("registration flow bootstrap failed", error);
    });
  }, 0);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
