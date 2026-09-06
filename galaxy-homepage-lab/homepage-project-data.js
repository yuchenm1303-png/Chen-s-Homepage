(() => {
  'use strict';

  const details = {
    'ai-ledger': {
      status: '持续开发',
      type: 'AI 助手 / Android 应用',
      period: '2026.03 — 至今',
      role: '产品设计 / Android 开发 / Agent 架构',
      summary: '从 2026 年 3 月开始做的原生 Android AI 助手。最开始只是聊天，后来陆续加上多模型、流式回复、工具、记忆和屏幕操作。现在它既能正常对话，也能读当前界面，并通过 Android 无障碍服务完成一些实际操作。',
      architecture: [
        '客户端使用 Kotlin + Jetpack Compose，聊天、模型、工具和应用状态都在原生端管理',
        'AiWorkerClient 连接 Cloudflare Worker，模型路由、流式输出和工具协议放在云端处理',
        'GUI Plus 负责看屏幕和给出下一步动作，AccessibilityService 负责点击、滑动、输入和返回；每一步执行后重新截图检查结果',
        '大面积液态玻璃 Shell 使用 OpenGL，普通卡片和浮层继续交给 Compose，避免所有组件都走同一条重渲染路径',
      ],
      highlights: [
        '支持多模型切换、联网、流式聊天、记忆和结构化工具调用',
        '接入搜索、天气、汇率、行情、提醒、账本和设备控制等工具',
        '加入悬浮窗和屏幕操作，让助手可以在其他 App 里继续任务',
        '持续调整 OpenGL 玻璃效果、聊天动画和移动端性能',
      ],
      challenges: [
        '模型可以自由推理，但真正执行到手机上的动作必须保持可控，这两层需要明确分开',
        '长任务里会遇到弹窗、键盘、加载、网络波动和模型判断偏差，不能假设界面一直按预期变化',
        '玻璃渲染、流式文本和动画同时运行时，很容易把 GPU 和 Compose 重组开销拉高',
      ],
      outputs: [
        '可安装运行的原生 Android Compose 应用和自动 APK 构建流程',
        '多模型聊天、工具调用和屏幕操作能力',
        '悬浮 HUD、记忆以及一组日常和数据工具',
      ],
      stack: ['Kotlin', 'Jetpack Compose', 'OpenGL', 'Cloudflare Workers', 'Streaming', 'AccessibilityService', 'GUI Plus', 'AI Agents'],
      stages: [
        ['聊天、多模型与工具基础能力', 'done'],
        ['视觉智能体、浮窗与 UI', 'active'],
        ['跨应用稳定性与公开版本', 'todo'],
      ],
      next: '接下来主要继续处理长任务和跨 App 操作的稳定性，同时做真机性能测试，把能公开演示的部分整理出来。',
    },

    'listing-studio': {
      status: '持续迭代',
      type: '电商自动化 / Windows 应用',
      period: '2026.08 — 至今',
      role: '产品设计 / Python 开发 / AI / 浏览器自动化',
      summary: '给 Makro Marketplace Seller Center 做的商品上架工具。输入一个 1688 或供应商商品链接后，程序先抓取原页面信息，再让模型判断 Makro 需要的字段并补齐缺失项，生成一份只读 Fill Plan。确认后才会让受控 Edge 会话写入类目、品牌、属性和图片，并在保存后重新读取页面检查结果。价格、库存、MOQ 这类经营字段没有可靠来源时不会自动填写，Send to QC 也始终留给人工。',
      architecture: [
        '每次先读取 Makro 当前页面的真实字段、选项和限制，不依赖长期维护的固定表单模板',
        '单独的 Source Edge 负责抓供应商页面的参数、可见文字、JSON-LD、SKU / variant、截图和商品大图，采集阶段只保留原始信息',
        'Qwen Local Fill 先判断 READY / CONFLICT / MISSING，只有缺失字段才进入联网补充；联网结果仍绑定当前商品 URL 和原始证据',
        'Fill Plan 把模型结果整理成待执行字段，Python 只检查来源、字段格式、数值范围、DOM 唯一性、React 回读和保存结果',
        'PySide6 管理单商品、批量任务、Makro 登录会话、标签页归属和失败恢复；VeloPack、GitHub Actions 与 Supabase 负责发布、更新和下载授权',
      ],
      highlights: [
        '新商品主要只需要提供供应商链接，真正写页面之前先给出可审阅结果',
        '商品理解交给模型，页面定位、写入和验证尽量保持确定性',
        '同一商品连续重跑可以复用原始页面证据，减少重复抓取和模型调用，也可以手动强制刷新',
        '单商品和批量任务共用持久登录，但每个任务保留自己的标签页和执行状态，避免串页和错写',
        '已经有 Windows 安装包、自更新、发布流程、下载授权、遥测和诊断',
      ],
      challenges: [
        'Makro 是动态 React 表单，字段、选项、单位和保存状态会跟品类及页面状态变化，静态选择器很难长期可靠',
        '供应商页面会混在一起出现规格、SKU、variant、包装尺寸和机身尺寸，模型需要理解语义，但又不能把相似型号的搜索结果混进来',
        '批量运行同时涉及登录、多个标签页、暂停恢复、缓存、异步 UI 和重试，所以任务之间必须严格隔离',
        '自动化不能越过经营决策：价格、库存、MOQ 等字段没有 seller data 就保持为空，最终提交也不自动点击',
      ],
      outputs: [
        '可运行的 Windows PySide6 Listing Studio，支持单商品和批量任务',
        '供应商页面采集、Makro live schema、字段判断、Fill Plan、浏览器写入和保存后回读',
        'Windows 打包和更新、Supabase 门户、运行遥测与诊断，以及核心流程测试',
      ],
      stack: ['Python', 'PySide6', 'Microsoft Edge CDP', 'Qwen 3.7', 'DashScope', 'Browser Automation', 'Supabase', 'VeloPack', 'GitHub Actions'],
      stages: [
        ['单商品字段判断和只读 Fill Plan', 'done'],
        ['正式 GUI、批量任务与浏览器执行', 'active'],
        ['更多品类实测和稳定发布', 'todo'],
      ],
      next: '继续拿不同供应商链接和 Makro 品类做真实回归，重点处理批量恢复、动态字段覆盖和更新发布中的边界问题。',
    },

    'computer-use': {
      status: '主流程迭代中',
      type: 'AI 应用 / 界面自动化',
      period: '2026.06 — 至今',
      role: '独立设计 / Android 开发 / Agent 编排',
      summary: '一个面向真实手机界面的 Computer Use 项目。每一轮先截取当前屏幕，让 GUI Plus 判断下一步动作，再把结构化 JSON 动作交给 Android 无障碍服务或设备命令执行。执行后重新截图，确认界面确实发生了预期变化，再决定下一步。',
      architecture: [
        'VisualLoopRunner 负责截图、回合控制、超时和结束条件',
        'VisualAgentClient 对接 DashScope GUI Plus，并兼容 Qwen 风格的动作协议',
        'VisualExecutionSessionState 保存当前任务、动作历史和执行结果',
        'AiAgentAccessibilityService / DeviceShellBridge 执行点击、滑动、输入、返回和应用切换',
        'HUD 与浮窗显示当前识别、动作和结果，尽量不挡住需要操作的界面',
      ],
      highlights: [
        '已经跑通截图 → 动作判断 → 无障碍执行 → 再截图检查的主流程',
        '对动作 JSON 做格式检查和修复，并限制令牌、超时和异常输出',
        '针对弹窗、键盘、加载层和短暂遮挡增加了恢复处理',
        '为股票、财经、导航、音乐、视频和旅行等场景补了一些专用技能',
        '证券场景只允许自动进入页面；价格、数量、方向和最终提交都需要确认',
      ],
      challenges: [
        '不同 App 的控件结构、坐标和动画速度差异很大，不能依赖固定模板',
        '键盘和临时浮层会改变可点击区域，只看单张截图很容易误判页面状态',
        '更换模型后动作协议和工具调用表现可能变化，所以规划、状态和执行层需要保持独立',
        '完成任务和避免越权同样重要，尤其是不可逆操作必须留有确认点',
      ],
      outputs: [
        '可运行的 Android Computer Use 主流程和会话状态',
        '动作协议检查、超时和失败恢复',
        '悬浮 HUD、截图反馈和敏感操作确认',
      ],
      stack: ['Kotlin', 'Jetpack Compose', 'AccessibilityService', 'DashScope GUI Plus', 'Qwen', 'Vision', 'JSON Actions'],
      stages: [
        ['截图、判断和执行主流程', 'done'],
        ['模型协议与异常恢复', 'active'],
        ['更多 App 回归测试与公开演示', 'todo'],
      ],
      next: '继续测试弹窗多、步骤长的真实任务，把常见失败情况逐个收敛，并整理几组可重复演示的任务。',
    },

    'liquid-glass': {
      status: '原生迁移',
      type: 'UI / 图形渲染',
      period: '2026.05 — 至今',
      role: '视觉设计 / Compose 实现 / 性能优化',
      summary: '把原来的 HTML/CSS/JS/WebView 界面迁到原生 Jetpack Compose，同时尽量保留原页面的布局和液态玻璃效果。重点不是普通模糊，而是玻璃边缘的高光和折射、主体明暗、焦散以及按压反馈。',
      architecture: [
        'UnifiedGlassBackdropLayer 管理 Shell、Card 和 Nav 的背景采样与合成',
        'BlurredBackdrop 缓存全屏模糊结果，GlassItemRegistry 记录组件区域，减少重复采样',
        'Android 13+ 使用 AGSL RuntimeShader 和圆角 SDF 计算边缘折射、轮廓高光和体积感',
        '低版本使用较轻的拉伸和雾面 fallback，保证 minSdk 26 可运行',
        'Chip 和 Floating 元素单独绘制，避免每一层玻璃都重新模糊背景',
      ],
      highlights: [
        '从 WebView 迁到原生 Compose，并跑通 GitHub Actions APK 构建',
        '玻璃本体保持中性透明，背景颜色由真实场景透过来，而不是直接给卡片染蓝紫色',
        '实现暗核、分层边缘、镜面高光、焦散带、色散和体积阴影',
        '加入拖拽、飞行、撞击、面板按压和弹窗状态动画',
        '移动端重点减少重复 blur、阴影和背景动画开销，同时保留主要视觉效果',
      ],
      challenges: [
        'Compose 和 CSS backdrop-filter 的渲染方式不同，原网页参数不能直接照搬',
        '多个半透明组件重叠时容易变灰、过曝或者重复采样',
        '效果越复杂 GPU 开销越高，需要在统一采样、缓存和局部 Shader 之间做取舍',
        '迁移时还要保持原网页结构，不能为了实现方便直接换一套布局',
      ],
      outputs: [
        '原生 Compose 液态玻璃组件',
        '玻璃珠、卡片、导航和弹窗的交互实验页',
        'Android 13+ Shader 路径和旧版本降级方案',
      ],
      stack: ['Kotlin', 'Jetpack Compose', 'AGSL', 'RuntimeShader', 'SDF', 'Blur Cache', 'GitHub Actions'],
      stages: [
        ['Web 结构与交互迁移', 'done'],
        ['玻璃渲染与采样优化', 'active'],
        ['不同真机上的性能和视觉校验', 'todo'],
      ],
      next: '先把当前效果固定下来，再在不同 Android 版本和分辨率上实测，避免继续靠零散补丁维持效果。',
    },

    'stock-crawler': {
      status: '服务运行',
      type: '数据采集 / FastAPI 服务',
      period: '2026.06 — 至今',
      role: '后端开发 / 数据源适配 / 缓存设计',
      summary: '一个独立的 A 股行情后端，部署在 Render，Android 客户端通过 HTTP API 读取数据。服务直接对接公开行情接口，统一字段并做缓存和降级，不需要在手机端抓网页。市场首页目前可以返回主要指数、约 5000 只 A 股、行业板块和几个派生榜单。',
      architecture: [
        'FastAPI + Uvicorn 提供 REST API，HTTPX 管理并发请求、超时和重试',
        '东方财富 push2 / push2delay / push2his 作为报价、分时和历史数据主源',
        '五日分时可降级到腾讯数据源；集合竞价使用东方财富和通达信 7709 协议，TDX 优先',
        '18 秒 fresh cache 处理常用页面，6 小时 stale cache 用于上游异常时兜底',
        '后台预热主要指数、全市场股票、板块和榜单，Render 冷启动后会重新补齐数据',
      ],
      highlights: [
        '市场首页覆盖约 10 个主要指数、约 5000 只 A 股和板块排行',
        '支持报价、分时、五档盘口、逐笔成交、日线/历史走势和集合竞价',
        '最近查看的股票会启动活跃 tick worker，交易时段约每 0.9 秒刷新一次',
        '最多同时维护 4 只活跃股票，避免全市场无意义高频轮询',
        'Android 直接消费 /api/stock/a-share/market/home 等标准化接口',
      ],
      challenges: [
        '公开行情接口字段多且经常变化，需要统一股票代码、市场、时间和涨跌幅口径',
        'Render Free 长时间空闲会休眠，冷启动要配合 stale cache 和后台预热',
        '逐笔数据频率高，按最近访问的股票动态启停 worker 可以避免请求放大',
        '不同数据源速度和完整度不一样，需要明确优先级和降级规则',
      ],
      outputs: [
        '可独立部署的 A 股行情代理后端',
        '市场首页、个股详情和实时 tick API',
        '缓存预热、数据源降级和活跃股票刷新',
      ],
      stack: ['Python', 'FastAPI', 'Uvicorn', 'HTTPX', 'Eastmoney', 'TDX 7709', 'Render'],
      stages: [
        ['市场首页与个股数据', 'done'],
        ['实时 tick 与多源降级', 'active'],
        ['稳定性监控与独立网页完善', 'todo'],
      ],
      next: '继续补数据源健康检查、冷启动和异常字段校验，先把独立行情网页做稳，再同步到 App。',
    },

    'gan-hemt': {
      status: '参数扫描',
      type: '半导体器件仿真',
      period: '2026.07 — 至今',
      role: '器件建模 / 数值求解 / 结果可视化',
      summary: '使用 Sentaurus 建立增强型 GaN HEMT 模型，主要看漏极电压、栅压、结温和重离子 LET 对漏极电流及安全工作区的影响。除了 Id–Vd 曲线，还在整理不同条件下的 Tj–Vg 合格域和二维、三维结果图。',
      architecture: [
        'SDE 构建设备结构，重点加密 2DEG 和栅漏 2 nm 邻域',
        '迁移率使用 DopingDep、HighFieldSat、Enormal，复合使用 SRH 和 Auger',
        '雪崩模型使用 Okuto，并用 ExtendedPrecision、RelErrControl 和分段 QuasiStationary 改善收敛',
        '温度、栅压、LET 和电流限值由独立扫描脚本组织，再用 MATLAB / Python 出图',
        '应用层结合 R_on、Rθjc 和环境温度计算温升及安全区域',
      ],
      highlights: [
        '扫描 Vd 0—650 V、Vg −5—0 V、温度约 −55—150 ℃、LET 0.2—5',
        '针对 Newton 不收敛、竖线曲线和高场模型冲突调整步长并逐项排查模型',
        '按 20/25/40 μA 等电流判据生成不同 LET 下的 Tj–Vg 合格域',
        '输出白底二维图和三维趋势图，保持真实刻度和数据关系',
        '重点复查高温、高 LET 区域的数值稳定性和物理合理性',
      ],
      challenges: [
        '重离子、高温和高漏压叠加后方程很容易失去收敛',
        '结构、物理模型或扫描步长设置不合理时，可能得到看起来正常但实际错误的曲线',
        '瞬态峰值、稳态端点电流和应用限制不是同一个判据，需要分开处理',
        '图要好看，但不能为了视觉效果改变仿真数据的数值关系',
      ],
      outputs: [
        '可复用的增强型 GaN HEMT Sentaurus 模型',
        '温度—栅压—LET 参数扫描和收敛设置',
        'Id–Vd 曲线、Tj–Vg 合格域以及二维、三维工程图',
      ],
      stack: ['Sentaurus SDE', 'Sentaurus Device', 'TCAD', 'GaN HEMT', 'Heavy Ion', 'MATLAB', 'Numerical Solvers'],
      stages: [
        ['结构、网格与物理模型', 'done'],
        ['温度 / Vg / LET 联合扫描', 'active'],
        ['实验 / 文献校核与正式报告', 'todo'],
      ],
      next: '继续复算高风险参数区，检查结果一致性，并整理可以直接放进报告和答辩的图。',
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