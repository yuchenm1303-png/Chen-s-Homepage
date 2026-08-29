window.DOWNLOAD_PORTAL_CONFIG = {
  brand: {
    name: "Listing Studio",
    domain: "Downloads"
  },
  release: {
    version: "v0.1.2",
    publishedAt: "2026.08.13",
    platform: "Windows 10 / 11 · x64",
    fileSize: "156 MB",
    downloadUrl: "",
    notes: [
      "修复上架流程与界面稳定性问题。"
    ],
    notesExtra: [
      "优化类目搜索与候选项解析，提高类目匹配稳定性。",
      "增加 Vertical 提交后校验，降低页面状态偏移导致的执行异常。",
      "优化无完全匹配类目时的候选项选择逻辑。",
      "统一最低购买数量、最高购买数量、FBS、SLA、销售区域与主体信息等账户级配置。",
      "新增任务暂停与继续功能。",
      "优化暂停时机，避免中断正在执行的保存操作。",
      "恢复任务时重新校验当前页面状态。",
      "批量任务支持按商品独立暂停。",
      "扩展运行日志，记录阶段、页面状态、耗时与错误位置。",
      "优化填写、保存与结果校验流程的一致性。"
    ]
  },
  releaseSource: {
    metadataUrl: "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/portal-release",
    channel: "stable"
  },
  auth: {
    supabaseUrl: "https://nfzkphjbelyltrzgkdwt.supabase.co",
    supabaseAnonKey: "sb_publishable_tE8SeTOj-ERgmqvP4l5Hiw_arCxCJLa",
    accessTable: "download_portal_users",
    downloadFunctionUrl: "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/portal-download"
  }
};

(() => {
  const path = String(window.location.pathname || "").replace(/\/+$/, "");
  const isDownloadEntry = path === "/download" || path === "/download/index.html" || path === "/download/direct.html";
  if (!isDownloadEntry) return;

  const url = new URL(window.location.href);
  const direct = path === "/download/direct.html" || url.searchParams.get("source") === "direct";
  window.DOWNLOAD_PORTAL_REGISTRATION_CHANNEL = direct ? "direct" : "first-client";

  if (direct && url.searchParams.get("source") === "direct" && path !== "/download/direct.html") {
    window.history.replaceState({}, "", "/download/direct.html" + window.location.hash);
  }

  const importMap = document.createElement("script");
  importMap.type = "importmap";
  importMap.textContent = JSON.stringify({
    imports: {
      "https://esm.sh/@supabase/supabase-js@2": "./registration-supabase-router-v1.js?v=20260829-1"
    }
  });
  document.currentScript?.after(importMap);
})();
