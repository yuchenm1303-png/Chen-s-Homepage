(() => {
  'use strict';

  const details = {
    'ai-ledger': {
      status: '持续开发',
      type: 'AI 助手 / Android 应用',
      period: '2026.03 — 至今',
      role: '产品设计 / Android 开发 / AI Agent 架构',
      summary: '从 2026 年 3 月开始持续开发的原生 Android AI 助手。项目以自然聊天为入口，结合云端多模型、流式响应、工具调用、记忆与视觉智能体，让 AI 不只回答问题，也能在手机上理解界面并完成实际操作。',
      architecture: [
        'Kotlin + Jetpack Compose 构建原生 Android 客户端，统一管理聊天、模型、工具和应用状态',
        'AiWorkerClient 对接 Cloudflare Worker，由云端负责多模型路由、流式输出与工具协议',
        '视觉智能体结合 GUI Plus 与 AccessibilityService，形成观察、规划、执行和复核闭环',
        '大玻璃 Shell 使用 OpenGL 渲染，其余卡片与浮层保持独立的 Compose 绘制链，兼顾视觉与性能',
      ],
      highlights: [
        '实现多模型切换、联网控制、流式聊天、记忆和结构化工具调用',
        '整合搜索、天气、汇率、行情、提醒、账本、设备控制等多类工具能力',
        '加入悬浮智能体与屏幕视觉操作，让 AI 能跨应用理解并执行手机任务',
        '持续优化 OpenGL 玻璃界面、聊天动画和移动端性能，同时保护完整交互效果',
      ],
      challenges: [
        '需要把云端模型的开放式推理与 Android 端确定性执行严格解耦',
        '长链路智能体任务要处理弹窗、键盘、加载、网络波动和模型输出漂移',
        '复杂玻璃视觉、流式内容与动画并存时，需要持续控制 GPU 与重组开销',
      ],
      outputs: [
        '可安装运行的原生 Android Compose AI 助手与自动 APK 构建流程',
        '云端多模型聊天、工具调用与 Agent 协议链路',
        '视觉智能体、悬浮 HUD、记忆与多类生活/数据工具的持续集成',
      ],
      stack: ['Kotlin', 'Jetpack Compose', 'OpenGL', 'Cloudflare Workers', 'Streaming', 'AccessibilityService', 'GUI Plus', 'AI Agents'],
      stages: [
        ['聊天、多模型与工具基础能力', 'done'],
        ['视觉智能体、浮窗与 UI 系统', 'active'],
        ['跨应用稳定性与公开版本', 'todo'],
      ],
      next: '继续提高视觉智能体与长任务链路的稳定性，完善工具生态和真机性能，并逐步整理可公开演示与发布的版本。',
    },

    'listing-studio': {
      status: '端到端迭代',
      type: 'AI Agent / 电商自动化 / Windows 应用',
      period: '2026.08 — 至今',
      role: '产品设计 / Python 开发 / AI Workflow / 浏览器自动化',
      summary: '面向 Makro Marketplace Seller Center 开发的 AI 商品自动上架系统。用户只需提供一个 1688 或供应商商品链接，程序即可自动采集原始页面证据，调用两阶段 AI 完成字段理解与缺失项补全，生成只读 Fill Plan，再由受控 Microsoft Edge 会话执行类目、品牌、字段、商品图片、保存与回读验证。系统同时提供 Single / Batch 桌面工作台、失败恢复、Windows 打包更新与配套的下载授权、遥测和诊断链路，并始终保留 Send to QC 的人工最终控制。',
      architecture: [
        '以 Makro live schema 作为运行时字段契约，先读取当前 Seller Center 的真实字段、选项与约束，再生成本次商品的执行计划，避免依赖固定表单模板',
        '独立 Source Edge 机械采集供应商页面的结构化参数、可见文本、JSON-LD、SKU / variant 原始片段、整页截图和商品大图，完整保留原始证据而不在采集层解释商品语义',
        '第一阶段 Qwen Local Fill 直接输出 READY / CONFLICT / MISSING，只有 MISSING 才进入 Web Fill；联网阶段同时绑定 exact source URL、原始证据和已确认商品指纹，降低同型号异商品造成的错误补全',
        'Fill Plan + Thin Hard Guards 将 AI 结果转换为可执行字段动作，Python 只负责来源、字段形状、数值范围、DOM 唯一定位、React readback、Save/reopen 和图片持久化等机械边界',
        'PySide6 Listing Studio 管理 Single / Batch、Managed Makro Edge 持久登录、每任务 target ownership、运行日志与故障恢复；VeloPack、GitHub Actions 与 Supabase 负责 Windows 发布、更新及门户能力',
      ],
      highlights: [
        '把新商品的主要人工输入压缩为一个供应商商品链接，准备阶段保持 Step 3 零写入，先得到可审阅的只读结果再开放真实执行',
        '建立 raw evidence → Local Fill → MISSING-only Web → Fill Plan 的单向语义链，让 AI 负责商品理解，让 Python 只承担确定性的执行约束',
        '实现 source bytes 与 semantic hot cache，同一商品紧接着复跑可复用完全相同的证据并减少重复模型调用，同时支持显式刷新读取最新网页',
        '正式 GUI 支持单商品和批量任务共享同一持久化 Makro 登录会话，并通过独立标签页所有权、状态机和恢复机制避免任务串页、错写与浏览器重启后的脏状态',
        '形成 Windows 安装包、自更新、发布流水线、Supabase 下载/授权/版本/使用遥测/诊断基础设施，并配套核心逻辑、GUI 合约、浏览器执行和更新链路的系统化测试',
      ],
      challenges: [
        'Makro Seller Center 是动态 React 表单，字段、option、单位和保存状态会随 vertical 与页面状态变化，必须依赖 live schema 与真实 readback，而不能长期维护静态选择器表',
        '供应商证据同时包含多语言文本、规格表、SKU / variant、包装与机身尺寸以及图片信息，需要让 AI 处理语义，又要严格防止联网搜索把相似型号或不同商品混入当前 listing',
        '批量运行同时涉及浏览器登录、多个标签页、任务暂停恢复、缓存、异步 UI 与失败重试，因此每个任务的页面所有权、证据和执行状态都必须隔离',
        '自动化必须提高完成率但不能越权：价格、库存、MOQ 等经营字段没有明确 seller data 就保持 blocked，Send to QC 永不由程序自动点击',
      ],
      outputs: [
        '可运行的 Windows PySide6 Listing Studio，覆盖 Single / Batch 商品准备、字段审阅、实时日志与受控真实执行',
        'Makro live schema、Source Capture、AI Resolver、Web Enrichment、Fill Plan、浏览器写入、Save/reopen 验证与 Product Photos persistence 的完整生产链',
        'Windows 打包与 VeloPack 更新流程、Supabase 门户后端、运行遥测/诊断以及覆盖核心业务与 GUI 的自动化测试体系',
      ],
      stack: ['Python', 'PySide6', 'Microsoft Edge CDP', 'Qwen 3.7', 'DashScope', 'Browser Automation', 'Supabase', 'VeloPack', 'GitHub Actions'],
      stages: [
        ['单商品 AI Resolver、证据链与只读 Fill Plan', 'done'],
        ['正式 GUI、批量任务与浏览器持久化执行', 'active'],
        ['跨品类规模化验收与稳定发布体系', 'todo'],
      ],
      next: '继续使用不同供应商链接与 Makro vertical 做真实端到端回归，收敛批量恢复、动态字段覆盖和发布更新边界，并逐步整理为可稳定交付和公开演示的正式版本。',
    },

    'computer-use': {
      status: '主链路迭代中',
      type: 'AI 应用 / 界面自动化',
      period: '2026.06 — 至今',
      role: '独立设计 / Android 开发 / 智能体编排',
      summary: '面向真实手机界面的 Computer Use 自动化项目。系统持续截取当前屏幕，将视觉信息交给 GUI Plus 模型规划，再把严格 JSON 动作映射到 Android 无障碍服务或设备命令执行，形成“观察—推理—操作—验证”的闭环。项目不是固定脚本，而是能够根据当前界面状态动态决定下一步。',
      architecture: [
        'VisualLoopRunner 负责截图、回合控制、超时与循环终止',
        'VisualAgentClient 对接阿里云 DashScope GUI Plus，并兼容 Qwen 风格规划协议',
        'VisualExecutionSessionState 保存任务状态、一步历史和执行证据',
        'AiAgentAccessibilityService / DeviceShellBridge 执行点击、滑动、输入、返回和应用切换',
        'HUD 与浮窗展示识别、思考、执行和结果反馈，且尽量不干扰视觉连续性',
      ],
      highlights: [
        '实现视觉理解 → 动作规划 → 无障碍执行 → 截图复核的完整闭环',
        '加入严格动作 JSON、协议修复、令牌与超时控制，降低模型输出漂移',
        '针对弹窗、键盘、加载层和短暂遮挡建立连续性处理与恢复策略',
        '扩展股票详情、指数、财经新闻、导航、音乐、视频和旅行等领域技能',
        '对证券交易场景设置明确安全边界：进入下单页可以自动化，价格、数量、方向与提交必须确认',
      ],
      challenges: [
        '不同应用的控件结构、坐标系和动画节奏差异很大，不能依赖固定模板',
        '临时浮层与键盘会改变可点击区域，需要结合前后截图判断界面是否真正完成切换',
        '模型切换后工具调用能力可能退化，因此必须把规划协议、状态和执行层解耦',
        '自动化既要追求完成率，也要避免越权操作和不可逆动作',
      ],
      outputs: [
        '可运行的 Android Computer Use 主链路与会话状态机',
        '视觉工具调用、协议修复、超时和失败恢复机制',
        '浮窗 HUD、截图反馈、运行状态与安全确认框架',
      ],
      stack: ['Kotlin', 'Jetpack Compose', 'AccessibilityService', 'DashScope GUI Plus', 'Qwen', 'Vision', 'JSON Actions'],
      stages: [
        ['视觉—执行主链路', 'done'],
        ['模型协议与异常恢复', 'active'],
        ['跨应用回归测试与公开演示', 'todo'],
      ],
      next: '继续压测多应用、多弹窗和长任务场景，收敛失败类型，并整理一套可复现的 Computer Use 演示与技术说明。',
    },

    'liquid-glass': {
      status: '原生迁移',
      type: 'UI 系统 / 图形渲染',
      period: '2026.05 — 至今',
      role: '视觉设计 / Compose 实现 / 性能优化',
      summary: '将原有 HTML/CSS/JS/WebView 界面原封不动迁移为原生 Jetpack Compose，保留页面结构、布局比例、交互逻辑和液态玻璃视觉语言。设计目标不是普通毛玻璃，而是接近 iOS 26 的透明材质：中性玻璃本体、薄边缘高光、背景折射、体积暗核、焦散与按压回弹。',
      architecture: [
        'UnifiedGlassBackdropLayer 统一管理 Shell、Card 与 Nav 的背景采样和合成',
        'BlurredBackdrop 缓存全屏模糊结果，GlassItemRegistry 记录组件区域并复用采样',
        'Android 13+ 使用 AGSL RuntimeShader 与圆角 SDF 计算边缘折射、轮廓高光和体积感',
        '低版本使用可控拉伸与雾面 fallback，保证 minSdk 26 仍可运行',
        'Chip 与 Floating 元素独立绘制，避免所有玻璃层重复模糊背景',
      ],
      highlights: [
        '从 WebView 路线切换到原生 Compose，并跑通 GitHub Actions APK 构建',
        '保持蓝色星空/夜景背景，玻璃本身维持中性透明，不使用蓝紫色卡片填充',
        '完成暗核、分层边缘、镜面高光、焦散带、色散闪光与体积阴影',
        '加入拖拽、飞行、撞击、面板按压/抬升、弹窗模糊/变暗/缩放等状态动画',
        '针对移动端降低重复 blur、阴影和背景动画成本，同时保留完整空间感',
      ],
      challenges: [
        'Compose 与 CSS backdrop-filter 的渲染模型不同，不能简单照搬滤镜参数',
        '多个半透明组件重叠时容易产生脏灰、过曝和重复采样',
        '视觉效果越强，GPU 开销越高，需要把统一采样、缓存和局部 Shader 结合',
        '要求界面结构与原网页一致，不能为了实现方便另画一套近似版',
      ],
      outputs: [
        '原生 Compose 液态玻璃组件与统一设计令牌',
        '可交互的玻璃珠、卡片、导航和弹窗效果实验台',
        'Android 13+ Shader 路径与旧版本性能降级路径',
      ],
      stack: ['Kotlin', 'Jetpack Compose', 'AGSL', 'RuntimeShader', 'SDF', 'Blur Cache', 'GitHub Actions'],
      stages: [
        ['Web 结构与交互迁移', 'done'],
        ['统一玻璃渲染架构', 'active'],
        ['真机性能与视觉基线锁定', 'todo'],
      ],
      next: '锁定一套不依赖补丁覆盖的稳定基线，完成不同 Android 版本、分辨率和性能档位的真机验证。',
    },

    'stock-crawler': {
      status: '服务运行',
      type: '数据采集 / FastAPI 服务',
      period: '2026.06 — 至今',
      role: '后端开发 / 数据源适配 / 缓存设计',
      summary: '独立后端目录 ai-ledger-stock-proxy，部署在 Render，由 Android 客户端通过 HTTP API 获取 A 股行情。系统直接对接公开行情接口并进行字段标准化、缓存和降级，不依赖手机端抓取网页。主页接口可同时聚合主要指数、约 5000 只 A 股、行业板块和派生榜单。',
      architecture: [
        'FastAPI + Uvicorn 提供统一 REST API，HTTPX 管理并发请求、超时和重试',
        '东方财富 push2 / push2delay / push2his 作为报价、分时和历史数据主源',
        '五日分时可降级到腾讯数据源；集合竞价使用东方财富与通达信 7709 协议，TDX 优先',
        '18 秒 fresh cache 保证常用页面响应速度，6 小时 stale cache 用于上游异常降级',
        '后台预热主要指数、全市场股票、板块和榜单；Render 冷启动后自动恢复数据',
      ],
      highlights: [
        '市场首页覆盖约 10 个主要指数、约 5000 只 A 股和板块排行',
        '支持报价、分时、五档盘口、逐笔成交、日线/历史走势和集合竞价数据',
        '为最近查看的股票启动活跃 tick worker，交易时段约每 0.9 秒刷新一次',
        '限制最多 4 只并发活跃股票，避免无意义的全市场高频轮询',
        'Android 通过 /api/stock/a-share/market/home 等接口直接消费标准化结构数据',
      ],
      challenges: [
        '公开行情接口字段多且变动频繁，需要统一代码、市场、时间和涨跌幅口径',
        'Render Free 长时间空闲会休眠，冷启动必须配合 stale cache 与后台预热',
        '高频逐笔数据容易造成请求放大，因此按最近访问股票动态启停 worker',
        '多数据源返回速度和完整度不同，需要清晰的优先级、降级和错误隔离',
      ],
      outputs: [
        '可独立部署的 A 股行情代理后端',
        '面向 App 的统一市场首页、个股详情和实时 tick 接口',
        '缓存预热、数据源降级和活跃股票刷新机制',
      ],
      stack: ['Python', 'FastAPI', 'Uvicorn', 'HTTPX', 'Eastmoney', 'TDX 7709', 'Render'],
      stages: [
        ['市场首页与个股数据', 'done'],
        ['实时 tick 与多源降级', 'active'],
        ['稳定性监控与独立网页完善', 'todo'],
      ],
      next: '继续完善数据源健康检查、冷启动体验和异常字段校验，并先把独立股票行情网页打磨完成，再同步到 App。',
    },

    'gan-hemt': {
      status: '参数扫描',
      type: '半导体器件仿真',
      period: '2026.07 — 至今',
      role: '器件建模 / 数值求解 / 结果可视化',
      summary: '使用 Sentaurus 建立增强型 GaN HEMT 器件模型，研究漏极电压、栅压、结温与重离子 LET 对漏极电流和安全工作区的耦合影响。目标不仅是得到单条 Id–Vd 曲线，还要建立工程可用的 Tj–Vg 合格域和二维/三维判据图。',
      architecture: [
        'SDE 构建设备结构，重点加密 2DEG 与栅漏 2 nm 邻域',
        '迁移率采用 DopingDep、HighFieldSat、Enormal，复合采用 SRH 与 Auger',
        '雪崩模型使用 Okuto，并通过 ExtendedPrecision、RelErrControl 和分段 QuasiStationary 提高收敛性',
        '温度、栅压、LET 与电流限值由独立扫描脚本组织，结果再进入 MATLAB/Python 可视化',
        '应用层使用 R_on、Rθjc 和环境温度建立温升与安全域映射',
      ],
      highlights: [
        '开展 Vd 0—650 V、Vg −5—0 V、温度约 −55—150 ℃、LET 0.2—5 的组合扫描',
        '针对 Newton 不收敛、竖线曲线和高场模型冲突建立缩步与模型排查策略',
        '围绕 20/25/40 μA 等电流判据生成不同 LET 条件下的 Tj–Vg 合格域',
        '同时输出专业白底二维图与三维趋势图，保持准确刻度和真实趋势',
        '逐步校核高温、高 LET 区域的数值稳定性与物理合理性',
      ],
      challenges: [
        '重离子、高温和高漏压叠加时方程刚性显著增强，极易失去收敛',
        '器件结构、物理模型和扫描步长任一设置不合理都会生成伪曲线',
        '需要区分瞬态峰值、稳态端点电流与应用层限制，避免混用判据',
        '结果图既要专业美观，也必须严格保持仿真数据的数值关系',
      ],
      outputs: [
        '可复用的增强型 GaN HEMT Sentaurus 模型',
        '温度—栅压—LET 参数扫描与收敛策略',
        'Id–Vd 曲线、Tj–Vg 合格域及二维/三维工程图件',
      ],
      stack: ['Sentaurus SDE', 'Sentaurus Device', 'TCAD', 'GaN HEMT', 'Heavy Ion', 'MATLAB', 'Numerical Solvers'],
      stages: [
        ['结构、网格与物理模型', 'done'],
        ['温度 / Vg / LET 联合扫描', 'active'],
        ['实验/文献校核与正式报告', 'todo'],
      ],
      next: '完成高风险参数区的复算和一致性检查，并统一输出可直接用于报告与答辩的正式图件。',
    },
  };

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog)) {
    console.warn('[homepage-project-data] stellar catalog not ready');
    return;
  }

  const enriched = catalog.map((item) => {
    const detail = item?.kind === 'project' ? details[item.id] : null;
    if (!detail) return item;

    const frozenDetail = Object.freeze({
      ...detail,
      architecture: Object.freeze([...detail.architecture]),
      highlights: Object.freeze([...detail.highlights]),
      challenges: Object.freeze([...detail.challenges]),
      outputs: Object.freeze([...detail.outputs]),
      stack: Object.freeze([...detail.stack]),
      stages: Object.freeze(detail.stages.map((stage) => Object.freeze([...stage]))),
    });

    return Object.freeze({ ...item, projectDetail: frozenDetail });
  });

  window.__SMIREL_STELLAR_CATALOG__ = Object.freeze(enriched);
})();
