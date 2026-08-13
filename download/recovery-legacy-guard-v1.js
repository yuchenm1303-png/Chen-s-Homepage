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
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "./evening-sky-v1.css?v=20260813-2";
  document.head.appendChild(style);
})();

// Use the exact PNG source embedded by the packaged Listing Studio app.
(() => {
  const APP_ICON_SOURCE = "https://raw.githubusercontent.com/yuchenm1303-png/ecommerce-agent/feat/local-test-gui/app/app_icon_data.py";

  const applyBrandIcon = async () => {
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
    mark.style.boxShadow = "none";

    try {
      const response = await fetch(APP_ICON_SOURCE, { cache: "force-cache" });
      if (!response.ok) throw new Error(`icon source ${response.status}`);
      const source = await response.text();
      const block = source.match(/APP_ICON_PNG_BASE64\s*=\s*\(([\s\S]*?)\n\)/)?.[1];
      if (!block) throw new Error("icon data not found");
      const base64 = Array.from(block.matchAll(/"([^"]+)"/g), (match) => match[1]).join("");
      if (!base64) throw new Error("icon data empty");

      const icon = document.createElement("img");
      icon.src = `data:image/png;base64,${base64}`;
      icon.alt = "";
      icon.width = 42;
      icon.height = 42;
      icon.style.display = "block";
      icon.style.width = "100%";
      icon.style.height = "100%";
      icon.style.objectFit = "contain";
      mark.replaceChildren(icon);
    } catch (error) {
      console.warn("Listing Studio icon load failed", error);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyBrandIcon, { once: true });
  } else {
    applyBrandIcon();
  }
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
