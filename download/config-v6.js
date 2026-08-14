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
      "最近更新 · 加入任务暂停和继续。页面出了问题时可以先停住，手动处理后再接着跑。",
      "最近更新 · 暂停不会硬切正在保存的步骤，会等当前操作完成后再停。",
      "最近更新 · 继续任务时会重新检查当前页面，不要求页面必须和暂停前一模一样。",
      "最近更新 · Batch 可以单独暂停某个商品，其他任务继续执行。",
      "最近更新 · 日志补得更完整了，现在能看到每个阶段、当前页面、耗时和具体报错位置。",
      "一点经验 · 自动化流程不要死记上一次跑到哪一步，继续时重新判断当前页面会稳很多。",
      "一点经验 · 每一步尽量完整做完再进入下一步，尤其是填写、保存和重新打开检查，后面出问题会更好恢复。",
      "一点经验 · 批量任务各自保存状态，一个商品出问题不应该拖住整批任务。"
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
