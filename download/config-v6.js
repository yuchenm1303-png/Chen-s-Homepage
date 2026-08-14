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
      "修复上架流程和界面问题。"
    ],
    notesExtra: [
      "近期开发进展 · 新增安全暂停 / 继续：程序只在安全 checkpoint 停住，不会强行冻结浏览器，也不会在 Save / reopen 中途截断任务。",
      "近期开发进展 · Single 与 Batch 使用统一的暂停语义；Batch 可以只暂停某一个 Job，其余任务继续排队和执行。",
      "近期开发进展 · 恢复任务时重新核对当前 Makro 页面、Vertical 与 live schema，再根据真实页面状态决定从哪里继续。",
      "近期开发进展 · 暂停、正在暂停、已暂停、恢复中等状态已经进入正式 GUI，减少运行中状态不透明的问题。",
      "工程经验 · 浏览器自动化里的“暂停”不应该等同于挂起线程；把暂停点放在完整事务边界，才能避免页面和本地状态脱节。",
      "工程经验 · 恢复时应优先相信实时页面状态，而不是只相信暂停前保存的进度；状态机必须能够重新识别当前位置。",
      "工程经验 · GUI 控制命令与 worker 运行状态分开保存，可以减少并发写状态造成的竞态，也更容易定位恢复问题。"
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
