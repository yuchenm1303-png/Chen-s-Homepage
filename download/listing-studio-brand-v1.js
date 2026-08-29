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
