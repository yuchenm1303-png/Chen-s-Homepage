(() => {
  const url = new URL(window.location.href);
  const hasLegacyRecovery =
    url.searchParams.get("recovery") === "1" ||
    /(?:^|[&#])type=recovery(?:&|$)/.test(window.location.hash) ||
    (/(?:^|[&#])access_token=/.test(window.location.hash) && /type=recovery/.test(window.location.hash));

  if (!hasLegacyRecovery) return;

  // Password recovery now uses the email OTP flow only. Strip legacy recovery
  // parameters before Supabase clients initialize so an old one-time link or
  // mail prefetch cannot reopen the obsolete reset-password modal.
  url.searchParams.delete("recovery");
  url.hash = "";
  window.history.replaceState({}, "", url.pathname + url.search);
})();

// Independent product-content bootstrap. Kept outside the recovery guard so
// the existing recovery behavior is unchanged.
(() => {
  const script = document.createElement("script");
  script.src = "./portal-content-v1.js?v=20260813-1";
  script.async = false;
  document.head.appendChild(script);
})();
