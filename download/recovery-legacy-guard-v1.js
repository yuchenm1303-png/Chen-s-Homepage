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

// Use the exact PNG source embedded by the packaged Listing Studio app for
// every Listing Studio mark shown on the download page.
(() => {
  const APP_ICON_SOURCE = "https://raw.githubusercontent.com/yuchenm1303-png/ecommerce-agent/feat/local-test-gui/app/app_icon_data.py";
  const ICON_SLOT_SELECTOR = ".brand-mark, .release-product-icon";

  const prepareIconSlot = (slot) => {
    slot.textContent = "";
    slot.style.padding = "0";
    slot.style.border = "0";
    slot.style.overflow = "hidden";
    slot.style.background = "transparent";
    slot.style.boxShadow = "none";

    if (slot.classList.contains("brand-mark")) {
      slot.style.width = "42px";
      slot.style.height = "42px";
      slot.style.flex = "0 0 42px";
      slot.style.borderRadius = "12px";
    }
  };

  const applyListingStudioIcons = async () => {
    const slots = Array.from(document.querySelectorAll(ICON_SLOT_SELECTOR));
    if (!slots.length) return;
    slots.forEach(prepareIconSlot);

    try {
      const response = await fetch(APP_ICON_SOURCE, { cache: "force-cache" });
      if (!response.ok) throw new Error(`icon source ${response.status}`);
      const source = await response.text();
      const block = source.match(/APP_ICON_PNG_BASE64\s*=\s*\(([\s\S]*?)\n\)/)?.[1];
      if (!block) throw new Error("icon data not found");
      const base64 = Array.from(block.matchAll(/"([^"]+)"/g), (match) => match[1]).join("");
      if (!base64) throw new Error("icon data empty");

      const iconSource = `data:image/png;base64,${base64}`;
      for (const slot of slots) {
        const icon = document.createElement("img");
        icon.src = iconSource;
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");
        icon.draggable = false;
        icon.style.display = "block";
        icon.style.width = "100%";
        icon.style.height = "100%";
        icon.style.objectFit = "contain";
        slot.replaceChildren(icon);
      }
    } catch (error) {
      console.warn("Listing Studio icon load failed", error);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyListingStudioIcons, { once: true });
  } else {
    applyListingStudioIcons();
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
