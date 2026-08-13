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
  script.src = "./portal-content-v1.js?v=20260813-2";
  script.async = false;
  document.head.appendChild(script);
})();

// Replace the temporary LS badge with the Listing Studio application icon.
(() => {
  const applyBrandIcon = () => {
    const mark = document.querySelector(".brand-mark");
    if (!mark) return;
    mark.textContent = "";
    mark.style.width = "42px";
    mark.style.height = "42px";
    mark.style.flex = "0 0 42px";
    mark.style.padding = "0";
    mark.style.border = "0";
    mark.style.borderRadius = "12px";
    mark.style.overflow = "hidden";
    mark.style.background = "transparent";
    mark.style.boxShadow = "0 7px 20px rgba(28, 39, 86, .18)";

    const icon = document.createElement("img");
    icon.src = "./listing-studio-icon.svg";
    icon.alt = "";
    icon.width = 42;
    icon.height = 42;
    icon.style.display = "block";
    icon.style.width = "100%";
    icon.style.height = "100%";
    icon.style.objectFit = "cover";
    mark.appendChild(icon);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyBrandIcon, { once: true });
  } else {
    applyBrandIcon();
  }
})();

// Registration flow v1: load after deferred/module scripts have attached their
// legacy handlers, then replace only the registration entry with the staged
// create -> verify email -> await approval experience.
(() => {
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "./registration-flow-v1.css?v=20260813-1";
  document.head.appendChild(style);

  const boot = () => window.setTimeout(() => {
    import("./registration-flow-v1.js?v=20260813-1").catch((error) => {
      console.error("registration flow bootstrap failed", error);
    });
  }, 0);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
