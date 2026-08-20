const PUBLIC_COPY_VERSION = "20260820-1645";

const exactCopy = new Map([
  ["Listing Studio · Usage Monitor", "Listing Studio · Service Monitor"],
  ["Owner Console", "Service Monitor"],
  ["OWNER · LIVE TELEMETRY", "SERVICE · LIVE STATUS"],
  ["Usage Monitor", "Service Monitor"],
  ["客户在线、版本、设备、Listing 使用情况、系统性能、故障诊断与真实任务输入 / 输出审计。", "Listing Studio 运行状态、客户端版本、任务处理与系统健康信息。"],
  ["使用数据", "服务状态"],
  ["Telemetry", "Status"],
  ["数据状态", "服务状态"],
  ["在线判定", "状态窗口"],
  ["正在验证管理员账号…", "正在加载服务数据…"],
  ["程序启动", "客户端启动"],
  ["单商品执行完成", "单商品完成"],
  ["批量商品完成", "批量商品完成"],
  ["失败商品任务", "失败任务"],
  ["使用脉冲", "运行概览"],
  ["过去 24 小时真实客户端心跳与任务执行记录", "过去 24 小时客户端活动与任务处理记录"],
  ["在线覆盖", "活动覆盖"],
  ["执行吞吐", "任务处理"],
  ["柱高 = 当小时执行完成 / 失败量", "柱高表示对应小时的完成与失败任务数量"],
  ["客户运行状态", "客户端状态"],
  ["实时状态", "当前状态"],
  ["OPERATIONS HEALTH", "SYSTEM HEALTH"],
  ["系统与任务性能", "系统状态"],
  ["CPU / RAM / Edge / UI Lag / AI / Task Latency / Version Health", "CPU / RAM / UI / Task / Version"],
  ["PRODUCT TASK AUDIT", "TASK HISTORY"],
  ["最近商品任务", "任务记录"],
  ["暂无审计数据", "暂无任务记录"],
  ["Batch links", "Batch"],
  ["准备完成", "Ready"],
  ["CRASH & DIAGNOSTICS", "DIAGNOSTICS"],
  ["故障诊断报告", "诊断记录"],
  ["© 2026 Listing Studio · Owner telemetry", "© 2026 Listing Studio · Service Monitor"],
  ["每个 Supplier URL 独立审计；API Key、Token、密码、Cookie、认证密钥与原始文件二进制永不采集", "运行数据仅用于服务状态、版本分析与故障定位。"],
  ["Telemetry 正常", "服务正常"],
  ["Usage Telemetry 数据", "服务数据"],
  ["暂无 Usage Telemetry 数据", "暂无服务数据"],
  ["当前没有登录。请先返回下载页，用 Owner 账号登录后再打开这里。", "当前未登录。请使用具备访问权限的账户登录。"],
  ["Usage 数据服务暂时不可用。", "服务数据暂不可用。"],
  ["本次刷新失败 · 当前保留上次成功数据", "刷新失败 · 已保留最近一次有效数据"],
  ["Usage telemetry · per supplier link", "Task activity"],
  ["AUTHORIZED", "ACTIVE"],
  ["24H CLIENT ACTIVITY", "24H ACTIVITY"],
  ["客户端活跃", "活动"],
  ["无活动", "无记录"],
  ["有失败事件", "存在失败"],
  ["个账号活跃", "个账户活动"],
  ["批次/单任务事件完成", "任务完成"],
  ["最近商品任务成功率", "近期任务成功率"],
  ["授权设备", "设备额度"],
  ["当前筛选条件下没有商品任务", "当前筛选条件下无任务记录"],
  ["暂无商品任务审计数据", "暂无任务记录"],
  ["个独立商品任务", "个任务"],
  ["后端最近最多", "最近最多"],
  ["条原始审计", "条记录"],
  ["客户输入", "任务输入"],
  ["客户资料与实际图片", "商品资料与图片"],
  ["资料判定", "资料状态"],
  ["GUI 选择记录", "文件选择"],
  ["执行侧图片", "图片处理"],
  ["任务结果", "处理结果"],
  ["AI 引导", "处理说明"],
  ["Model Name 流量词", "型号关键词"],
  ["AI / Fill Plan 字段", "字段处理结果"],
  ["AI结果", "解析结果"],
  ["AI状态", "处理状态"],
  ["Blocked reason", "限制原因"],
  ["Web Candidates", "External Matches"],
  ["查看 Executor Report", "查看执行记录"],
  ["运行故障诊断", "故障诊断"],
  ["结构化现场", "诊断数据"],
  ["查看完整 Traceback", "查看 Traceback"],
  ["查看 WORKFLOW_DIAG 时间线", "查看诊断时间线"],
  ["查看 FAILED Event", "查看失败事件"],
  ["查看 Run Manifest", "查看运行记录"],
  ["查看完整原始审计 JSON", "查看原始任务记录"],
  ["错误 / Review reason", "错误 / 复核原因"],
  ["未采集到资料状态（不能判定客户未上传）", "无可用资料状态"],
  ["未采集到可靠选择记录", "无文件选择记录"],
  ["未采集到执行侧图片证据", "无图片处理记录"],
  ["执行报告没有可展示的文件名元数据", "无可展示的文件信息"],
  ["未采集到文件元数据（不等于客户未上传）", "无可展示的文件信息"],
  ["执行报告确认本次没有使用商品图片", "本次任务未使用商品图片"],
  ["大小未采集", "大小未知"],
  ["设备与客户端性能", "客户端健康"],
  ["等待新版客户端采样", "暂无客户端健康数据"],
  ["暂无 System Health 样本；包含该功能的新客户端启动约 8 秒后开始出现。", "暂无客户端健康数据。客户端运行后将自动更新。"],
  ["应用 CPU", "客户端 CPU"],
  ["应用内存", "客户端内存"],
  ["UI Event Loop Lag", "界面响应延迟"],
  ["Telemetry RTT", "服务延迟"],
  ["24H 应用 CPU", "24H 客户端 CPU"],
  ["24H UI Event Loop Lag", "24H 界面响应延迟"],
  ["完整最新 System Health Sample", "最新客户端健康记录"],
  ["任务耗时与 AI 调用", "任务处理性能"],
  ["暂无新版任务审计数据。", "暂无任务性能数据。"],
  ["个商品任务", "个任务"],
  ["AI Calls", "Requests"],
  ["AI CALLS", "REQUESTS"],
  ["AI CACHE", "CACHE"],
  ["最近任务耗时 P95", "近期任务耗时 P95"],
  ["版本稳定性", "版本状态"],
  ["task + crash correlation", "task / diagnostic correlation"],
  ["Crash", "Diagnostics"],
  ["已上传诊断报告", "诊断记录"],
  ["最新设备平均", "当前设备平均"],
  ["暂无版本任务数据。", "暂无版本数据。"],
  ["暂无已上传 Crash / Diagnostic 报告。", "暂无诊断记录。"],
  ["CRASH / DIAG", "DIAGNOSTIC"],
  ["完整诊断", "诊断详情"],
  ["复制完整错误", "复制错误信息"],
  ["复制该任务的完整错误与诊断上下文", "复制该任务的错误与诊断信息"],
  ["复制完整诊断", "复制诊断信息"],
  ["复制完整 Crash / Diagnostic 报告", "复制诊断信息"],
  ["DIAGNOSTIC REPORT", "DIAGNOSTIC"],
  ["ERROR CONTEXT", "ERROR DETAILS"],
  ["365D DAILY ACTIVITY", "365D ACTIVITY"],
  ["年度使用热力图", "年度活动"],
  ["正在读取每天的商品任务记录…", "正在加载年度活动数据…"],
  ["每个 Batch Supplier Link 独立计数", "按商品链接独立计数"],
  ["商品任务", "任务"],
  ["活跃客户", "活跃账户"],
  ["个活跃日", "个活跃日"],
  ["每日热力图暂时无法读取", "年度活动数据暂不可用"],
  ["暂无每日记录", "暂无年度活动数据"],
  ["DETAIL", "DETAILS"],
  ["详情", "详细信息"]
]);

const phraseCopy = [
  [/Telemetry 正常/g, "服务正常"],
  [/Usage telemetry/gi, "Service activity"],
  [/Usage Telemetry/gi, "Service data"],
  [/Usage 数据服务/g, "服务数据"],
  [/真实客户端心跳/g, "客户端活动"],
  [/真实心跳/g, "客户端活动"],
  [/AI \/ Fill Plan/g, "字段处理"],
  [/AI Calls?/gi, "Requests"],
  [/AI CACHE/gi, "CACHE"],
  [/Owner telemetry/gi, "Service Monitor"],
  [/Owner Console/gi, "Service Monitor"],
  [/Crash \/ Diagnostic/gi, "Diagnostic"],
  [/Crash & Diagnostics/gi, "Diagnostics"],
  [/System Health Sample/gi, "client health record"],
  [/System Health/gi, "Client Health"],
  [/个独立商品任务/g, "个任务"],
  [/个商品任务/g, "个任务"],
  [/后端最近最多/g, "最近最多"],
  [/条原始审计/g, "条记录"],
  [/每个 Supplier URL 独立审计/g, "按商品链接记录"],
  [/每个 Batch Supplier Link 独立计数/g, "按商品链接独立计数"]
];

function rewriteText(value) {
  const raw = String(value ?? "");
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  let next = exactCopy.get(trimmed) ?? trimmed;
  for (const [pattern, replacement] of phraseCopy) next = next.replace(pattern, replacement);
  if (next === trimmed) return raw;
  return raw.replace(trimmed, next);
}

function rewriteTextNode(node) {
  if (!(node instanceof Text)) return;
  const current = node.nodeValue || "";
  const next = rewriteText(current);
  if (next !== current) node.nodeValue = next;
}

function rewriteAttributes(element) {
  if (!(element instanceof Element)) return;
  for (const name of ["aria-label", "placeholder", "title"]) {
    if (!element.hasAttribute(name)) continue;
    const current = element.getAttribute(name) || "";
    const next = rewriteText(current);
    if (next !== current) element.setAttribute(name, next);
  }
}

function rewriteTree(root) {
  if (!root) return;
  if (root instanceof Text) {
    rewriteTextNode(root);
    return;
  }
  if (root instanceof Element) rewriteAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node instanceof Text) rewriteTextNode(node);
    else rewriteAttributes(node);
  }
}

document.title = "Listing Studio · Service Monitor";
rewriteTree(document.documentElement);

const publicCopyObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "characterData") rewriteTextNode(mutation.target);
    if (mutation.type === "attributes") rewriteAttributes(mutation.target);
    for (const node of mutation.addedNodes) rewriteTree(node);
  }
});

publicCopyObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["aria-label", "placeholder", "title"]
});

window.addEventListener("pagehide", () => publicCopyObserver.disconnect());
