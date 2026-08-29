const brandSlot = document.querySelector(".usage-shell .topbar .brand > :first-child");
if (brandSlot) {
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.style.cssText = [
    "display:block",
    "width:42px",
    "height:42px",
    "flex:0 0 42px",
    "padding:0",
    "margin:0",
    "border:0",
    "border-radius:0",
    "background-color:transparent",
    "background-image:url('./listing-studio-product-icon.png?v=20260829-monitor-bg-1')",
    "background-repeat:no-repeat",
    "background-position:center",
    "background-size:contain",
    "box-shadow:none",
    "opacity:1",
    "visibility:visible",
    "filter:none",
    "mix-blend-mode:normal"
  ].join(";");
  brandSlot.replaceWith(icon);
}

import "./usage-task-history-v2.js?v=20260826-2359";
import "./usage-admin-v2-core.js?v=20260821-1800";

void Promise.allSettled([
  import("./usage-public-copy-v1.js?v=20260820-1645"),
  import("./usage-copy-v1.js?v=20260819-1005"),
  import("./usage-chart-tooltip-v1.js?v=20260819-1134"),
  import("./usage-daily-heatmap-v1.js?v=20260821-1705"),
  import("./usage-detail-modal-v1.js?v=20260826-2359")
]);
