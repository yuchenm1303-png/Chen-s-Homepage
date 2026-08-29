const brandMark = document.querySelector(".brand-mark");
if (brandMark) {
  const icon = document.createElement("img");
  icon.src = "./listing-studio-product-icon.png?v=20260829-monitor-direct-1";
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");
  icon.width = 42;
  icon.height = 42;
  icon.style.cssText = "display:block;width:42px;height:42px;flex:0 0 42px;object-fit:contain;border:0;background:transparent;box-shadow:none;";
  brandMark.replaceWith(icon);
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
