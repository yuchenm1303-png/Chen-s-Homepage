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
      "最近更新 · 类目选择重新整理了一遍。搜索会把下拉结果完整看完，不再只看最上面的几条。",
      "最近更新 · Makro 没有完全对应的类目时，会从真实可选项里挑一个更合适的，不再因为类目不够精准直接停住。",
      "最近更新 · 类目点下去以后还会核对实际进入的 Vertical，避免页面跳到了另一个类目却继续往下跑。",
      "最近更新 · 最低购买数量、最高购买数量、FBS、14 天 SLA、销售区域和主体信息现在按账号固定值填写，不再每个商品重新判断。",
      "最近更新 · 加入任务暂停和继续。页面出了问题时可以先停住，手动处理后再接着跑。",
      "最近更新 · 暂停不会硬切正在保存的步骤，会等当前操作完成后再停。",
      "最近更新 · 继续任务时会重新检查当前页面，不要求页面必须和暂停前一模一样。",
      "最近更新 · Batch 可以单独暂停某个商品，其他任务继续执行。",
      "最近更新 · 日志补得更完整了，现在能看到每个阶段、当前页面、耗时和具体报错位置。",
      "这段时间踩的一个坑：搜索结果里名字最像的，不一定真是对的类目。先把结果收全，再判断，会靠谱很多。",
      "还有一个坑：浏览器自动化不能默认页面永远从同一个地方开始。每次继续之前先看清楚当前页面，比硬按固定步骤往下点稳得多。",
      "能固定的东西就别重复猜。卖家自己的经营设置单独放一处，商品资料只处理商品本身，后面维护也省事。",
      "填写、保存、重新打开检查最好当成一个完整步骤。中间随便截断，后面最容易出现页面和程序状态对不上。"
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
