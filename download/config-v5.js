window.DOWNLOAD_PORTAL_CONFIG = {
  brand: {
    name: "Listing Studio",
    domain: "Distribution Center"
  },
  release: {
    version: "v0.1.2",
    publishedAt: "2026.08.13",
    platform: "Windows 10 / 11 · x64",
    fileSize: "156 MB",
    downloadUrl: "",
    notes: [
      "稳定性与上架流程优化。"
    ]
  },
  releaseSource: {
    repository: "yuchenm1303-png/ecommerce-agent",
    latestApiUrl: "https://api.github.com/repos/yuchenm1303-png/ecommerce-agent/releases/latest",
    manifestAsset: "update.json",
    installerPrefix: "EcommerceAgent-Setup-",
    channel: "stable"
  },
  auth: {
    supabaseUrl: "https://nfzkphjbelyltrzgkdwt.supabase.co",
    supabaseAnonKey: "sb_publishable_tE8SeTOj-ERgmqvP4l5Hiw_arCxCJLa",
    accessTable: "download_portal_users",
    downloadFunctionUrl: "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/portal-download"
  }
};
