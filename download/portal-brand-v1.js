const STYLE_ID = "listing-studio-product-brand";
const ICON_CLASS = "has-product-icon";
const ICON_SLOTS = ".brand-mark, .release-product-icon";
const ICON_URL = new URL("./listing-studio-product-icon.png?v=20260829-3", import.meta.url).href;

const ensureBrandStyles = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    ${ICON_SLOTS} {
      background-image: none !important;
    }

    .brand-mark:not(.${ICON_CLASS}) {
      color: #fff !important;
      font-size: .82rem !important;
      letter-spacing: .08em !important;
      background: rgba(255,255,255,.14) !important;
      border-color: rgba(255,255,255,.2) !important;
    }

    .release-product-icon:not(.${ICON_CLASS}) {
      color: #fff !important;
      font-size: .72rem !important;
      letter-spacing: .06em !important;
    }

    .brand-mark.${ICON_CLASS},
    .release-product-icon.${ICON_CLASS} {
      color: transparent !important;
      font-size: 0 !important;
      letter-spacing: 0 !important;
      background: transparent !important;
      border-color: transparent !important;
      box-shadow: none !important;
      overflow: hidden;
    }

    .brand-mark.${ICON_CLASS} > img,
    .release-product-icon.${ICON_CLASS} > img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
      user-select: none;
    }
  `;
  document.head.appendChild(style);
};

const installIcon = (slot) => {
  slot.classList.remove(ICON_CLASS);
  if (!slot.textContent.trim()) slot.textContent = "LS";

  const image = new Image();
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.draggable = false;

  image.addEventListener("load", () => {
    slot.replaceChildren(image);
    slot.classList.add(ICON_CLASS);
  }, { once: true });

  image.addEventListener("error", () => {
    slot.classList.remove(ICON_CLASS);
    slot.textContent = "LS";
  }, { once: true });

  image.src = ICON_URL;
};

const applyProductBrand = () => {
  ensureBrandStyles();
  document.querySelectorAll(ICON_SLOTS).forEach(installIcon);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyProductBrand, { once: true });
} else {
  applyProductBrand();
}
