(() => {
  'use strict';

  const language = window.SmirelLanguage?.current || 'en';
  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog)) return;

  const projectEnglish = {
    'ai-ledger': {
      status: 'Active development', type: 'Android AI assistant', period: '2026.03 — present', role: 'Product design / Android / agent architecture',
      summary: 'A native Android assistant I have been building since March 2026, with multi-model chat, streaming, tools, memory and screen interaction.',
      architecture: ['Kotlin + Jetpack Compose for the Android client.', 'Cloudflare Worker for model routing, streaming and tools.', 'GUI Plus + AccessibilityService for screen understanding and actions.', 'OpenGL for the large liquid-glass shell.'],
      highlights: ['Multi-model chat, tools and memory.', 'Screen interaction across Android apps.', 'Search, weather, market, reminder and device utilities.', 'Ongoing OpenGL UI and performance work.'],
      challenges: ['Keep model reasoning separate from deterministic execution.', 'Recover from keyboards, pop-ups, loading and network delay.', 'Keep the glass UI smooth without cutting its main effects.'],
      outputs: ['Working native Android app with automated APK builds.', 'Cloud streaming and tool execution.', 'Visual agent, floating HUD and utility tools.'],
      stack: ['Kotlin', 'Jetpack Compose', 'OpenGL', 'Cloudflare Workers', 'AccessibilityService', 'GUI Plus'],
      stages: [['Chat, models and tools', 'done'], ['Visual agent and UI', 'active'], ['Cross-app stability and public build', 'todo']],
      next: 'Improve long-task reliability, real-device performance and the public demo path.'
    },
    'listing-studio': {
      status: 'End-to-end testing', type: 'Marketplace automation / Windows', period: '2026.08 — present', role: 'Product design / Python / browser automation',
      summary: 'A Windows tool that starts from a supplier link, prepares marketplace fields as a read-only Fill Plan, then writes approved values through a managed Edge session.',
      architecture: ['Read the live Makro schema before resolving fields.', 'Capture supplier evidence without inventing product facts.', 'Use AI for field resolution and web enrichment only where needed.', 'Use Python guards for DOM targets, readback and save verification.'],
      highlights: ['A supplier URL is the main input.', 'Nothing is written during the review step.', 'Caches reduce repeated capture and model calls.', 'Batch tasks keep separate page ownership and state.'],
      challenges: ['Makro uses dynamic React forms.', 'Supplier pages mix variants, dimensions and languages.', 'Batch recovery has to isolate tabs and evidence.', 'Seller business decisions must not be invented.'],
      outputs: ['Working PySide6 desktop app.', 'Source capture → resolution → Fill Plan → browser write → readback.', 'Windows packaging, updates and diagnostics.'],
      stack: ['Python', 'PySide6', 'Edge CDP', 'Qwen', 'DashScope', 'Supabase', 'VeloPack'],
      stages: [['Single-item resolver and Fill Plan', 'done'], ['Batch UI and browser execution', 'active'], ['Cross-category testing and stable releases', 'todo']],
      next: 'Keep testing real supplier links across categories and tighten batch recovery and releases.'
    },
    'computer-use': {
      status: 'Main loop in testing', type: 'Mobile UI automation', period: '2026.06 — present', role: 'Design / Android / agent orchestration',
      summary: 'A mobile Computer Use loop that captures the screen, asks a visual model for one structured action, executes it and verifies the next screen.',
      architecture: ['VisualLoopRunner owns screenshots, turns and timeouts.', 'VisualAgentClient talks to GUI Plus.', 'VisualExecutionSessionState keeps task state and evidence.', 'AccessibilityService / DeviceShellBridge execute actions.'],
      highlights: ['Screenshot → plan → execute → verify.', 'Strict JSON actions and protocol repair.', 'Recovery for keyboards, overlays and loading.', 'Explicit confirmation before risky actions.'],
      challenges: ['Apps use different layouts and timing.', 'Temporary overlays move targets.', 'Models follow action protocols differently.', 'Automation must stop at clear safety boundaries.'],
      outputs: ['Working Android Computer Use runtime.', 'Structured action and recovery handling.', 'Floating HUD and confirmation boundaries.'],
      stack: ['Kotlin', 'AccessibilityService', 'DashScope GUI Plus', 'Vision', 'JSON Actions'],
      stages: [['Visual execution loop', 'done'], ['Protocol reliability and recovery', 'active'], ['Cross-app regression tests', 'todo']],
      next: 'Stress-test longer tasks and turn repeatable failures into regression cases.'
    },
    'liquid-glass': {
      status: 'Native migration', type: 'UI / graphics rendering', period: '2026.05 — present', role: 'Visual design / Compose / performance',
      summary: 'An ongoing migration of a web liquid-glass interface into native Jetpack Compose while keeping its optical character and interaction.',
      architecture: ['Shared backdrop sampling for glass surfaces.', 'Cached blur plus tracked component regions.', 'AGSL RuntimeShader on Android 13+.', 'Cheaper fallback on older Android versions.'],
      highlights: ['Moved from WebView experiments to native Compose.', 'Built refraction, layered edges, caustics and dispersion.', 'Added drag, impact, press and dialog motion.', 'Reduced repeated blur and background work.'],
      challenges: ['Compose and CSS backdrop rendering differ.', 'Overlapping glass can over-sample the background.', 'Stronger optics increase GPU cost.', 'The native layout must stay faithful to the original.'],
      outputs: ['Native Compose glass components.', 'Interactive glass experiments.', 'Modern AGSL path plus older-device fallback.'],
      stack: ['Kotlin', 'Jetpack Compose', 'AGSL', 'RuntimeShader', 'SDF', 'Blur Cache'],
      stages: [['Web structure and interaction migration', 'done'], ['Shared glass rendering', 'active'], ['Device performance baseline', 'todo']],
      next: 'Lock one stable visual baseline and validate it across devices and Android versions.'
    },
    'stock-crawler': {
      status: 'Service running', type: 'Market data / FastAPI', period: '2026.06 — present', role: 'Backend / data-source integration / caching',
      summary: 'A standalone A-share market-data service used by the Android app and other tools instead of scraping finance pages on-device.',
      architecture: ['FastAPI + Uvicorn REST API with HTTPX.', 'Eastmoney as the main quote/intraday/history source.', 'Tencent and TDX fallbacks for selected data.', 'Fresh and stale caches for speed and upstream failures.'],
      highlights: ['Major indices, roughly 5,000 A-share stocks and sector rankings.', 'Quotes, intraday, order book, trades and history.', 'Active tick workers only for recently viewed stocks.', 'Normalized output for downstream clients.'],
      challenges: ['Public data fields change.', 'Render Free can cold-start.', 'Tick data can amplify upstream traffic.', 'Provider fallbacks need explicit priority.'],
      outputs: ['Deployable market-data proxy.', 'Unified market and stock-detail APIs.', 'Cache warm-up and provider fallback logic.'],
      stack: ['Python', 'FastAPI', 'Uvicorn', 'HTTPX', 'Eastmoney', 'TDX 7709', 'Render'],
      stages: [['Market and stock data', 'done'], ['Realtime tick and fallbacks', 'active'], ['Monitoring and standalone web UI', 'todo']],
      next: 'Improve provider health checks, cold-start behaviour and field validation.'
    },
    'gan-hemt': {
      status: 'Parameter sweeps', type: 'Semiconductor device simulation', period: '2026.07 — present', role: 'Device modelling / numerical solving / visualization',
      summary: 'A Sentaurus model for enhancement-mode GaN HEMTs, used to study drain voltage, gate voltage, temperature and heavy-ion LET.',
      architecture: ['SDE device geometry with local mesh refinement.', 'High-field mobility, recombination and avalanche models.', 'Segmented quasi-stationary sweeps with tighter numerical control.', 'MATLAB/Python for Id–Vd and Tj–Vg plots.'],
      highlights: ['Drain-voltage, gate-bias, temperature and LET sweeps.', 'Step-size and model checks for convergence problems.', 'Tj–Vg regions under different current limits.', '2D and 3D plots that preserve real numerical relationships.'],
      challenges: ['High-voltage/heavy-ion cases are numerically stiff.', 'Bad geometry or settings can produce believable false curves.', 'Peak, endpoint and steady-state current must stay distinct.', 'Plots must not hide numerical instability.'],
      outputs: ['Reusable GaN HEMT Sentaurus model.', 'Sweep scripts and convergence strategy.', 'Id–Vd and Tj–Vg engineering plots.'],
      stack: ['Sentaurus SDE', 'Sentaurus Device', 'TCAD', 'GaN HEMT', 'Heavy Ion', 'MATLAB'],
      stages: [['Structure, mesh and models', 'done'], ['Temperature / Vg / LET sweeps', 'active'], ['Literature checks and final report', 'todo']],
      next: 'Repeat the highest-risk parameter regions and consolidate plots and simulation settings.'
    }
  };

  const articleEnglish = {
    'building-homepage': {
      title: 'Building a Personal Homepage: Stars and a Long-Term Digital Space', navTitle: 'Building My Homepage', subtitle: 'Web development · 2026-08-01', lede: 'How this site grew from a profile page into a place for projects, notes and experiments.', meta: ['Web development', 'Build log'], overview: 'I treat the homepage as a space that can keep growing, not a résumé squeezed into a browser window.',
      articleHtml: '<p class="article-lead">I did not want another developer card with a portrait, a short bio and a row of project tiles. I wanted a place that could hold current projects, long notes and unfinished experiments without needing a redesign whenever something new appeared.</p><h2>A homepage is not a résumé</h2><p>A résumé is deliberately compressed. A personal site can keep the reason a project started, architecture changes, failed approaches and the current state.</p><h2>Visual ideas need separate jobs</h2><p>The galaxy provides atmosphere and depth. The interface provides hierarchy and navigation. Liquid glass is used where refraction and motion actually add something.</p><h2>Performance should protect the picture</h2><p>I remove repeated work before weakening the visible result: cache backgrounds, update visible areas and release inactive resources.</p>'
    },
    'opengl-liquid-glass': {
      title: 'OpenGL Liquid Glass: Edge Refraction vs. Body Refraction', navTitle: 'OpenGL Liquid Glass', subtitle: 'Graphics · 2026-07-28', lede: 'Why edge-heavy glass and a full-body lens need different optical roles.', meta: ['Graphics', 'Rendering note'], overview: 'Material, deformation animation and decorative light are separate systems even when they share timing.',
      articleHtml: '<p class="article-lead">Liquid glass is not just blur plus a bright border. My older renderer gets its identity from a strong refractive rim, while the newer one treats the whole surface as a lens.</p><h2>Separate material, motion and light</h2><p>The material decides how background pixels are sampled; motion decides deformation; surface light adds touch highlights.</p><h2>Do not stack refraction blindly</h2><p>Body and edge displacement can compound into contour bands, white shells or black lines. Render structure and source textures should be checked before shader strength.</p><h2>Direct WebGL output matters</h2><p>Removing an extra 2D canvas copy fixed dark transparent edges in the web version because it removed the real resampling error.</p>'
    },
    'computer-use-design': {
      title: 'Computer Use on Android: From Screenshots to Verifiable Actions', navTitle: 'Computer Use', subtitle: 'AI / Android · 2026-07-20', lede: 'Notes on building a visual mobile automation loop that can observe, act and check its result.', meta: ['AI / Android', 'Design note'], overview: 'The useful unit is one small action whose result can be checked on the next screen, not a long generated script.',
      articleHtml: '<p class="article-lead">Real apps add loading states, keyboards, permission dialogs, account differences and layout changes. The system has to know what it saw, what it did and why it can continue.</p><h2>Use a strict action protocol</h2><p>Taps, swipes, text input, back and app switching become structured actions with coordinates, expected results and safety information.</p><h2>Plan one verifiable step at a time</h2><p>A long plan becomes stale as soon as one screen differs. Execute one action, observe again and choose the next action from fresh evidence.</p><h2>Recovery needs a budget</h2><p>Repeated taps are not recovery. Similar screenshots and repeated failures consume a retry budget; risky actions stop for confirmation.</p>'
    },
    'gan-hemt-stability': {
      title: 'Numerical Stability in GaN HEMT Simulation', navTitle: 'GaN HEMT Stability', subtitle: 'Engineering simulation · 2026-07-10', lede: 'Why a converged GaN HEMT curve can still be numerically wrong.', meta: ['Engineering simulation', 'Research note'], overview: 'High drain voltage, temperature and heavy-ion generation make the equations stiff; convergence is only the first check.',
      articleHtml: '<p class="article-lead">The dangerous failure is not no result; it is a smooth curve produced by a bad mesh, step size, initial state or model combination.</p><h2>Define the question first</h2><p>Device-level Id–Vd sweeps and application-level Tj–Vg acceptance maps answer different questions and need explicit assumptions.</p><h2>Use segmented sweeps and local mesh refinement</h2><p>Low-field and high-field regions need different step sizes, while the 2DEG, gate-drain region and ion track deserve local refinement.</p><h2>Convergence is not credibility</h2><p>I still check parameter continuity, mesh sensitivity, model sensitivity and repeated runs before treating a curve as usable.</p>'
    },
    'ai-ledger-real-streaming': {
      title: 'Real Streaming in AI Ledger', navTitle: 'AI Ledger Streaming', subtitle: 'Android · 2026-07-16', lede: 'From network chunks to stable incremental rendering in one Compose message.', meta: ['Android', 'Streaming'], overview: 'Real streaming only helps when the provider, network path, parser and UI preserve incremental updates.',
      articleHtml: '<p class="article-lead">A typewriter animation can imitate streaming after the full answer arrives, but it does not reduce the wait for first useful content.</p><h2>The first token has to be real</h2><p>The worker forwards chunks as they arrive and the client updates one stable assistant message.</p><h2>Streaming is a state problem</h2><p>The message needs stable identity, an in-progress state and a clear finalization event.</p><h2>Cancellation belongs in the protocol</h2><p>Stopping generation or leaving the screen must close network work and keep a readable partial answer.</p>'
    },
    'app-performance-optimization': {
      title: 'App Performance Without Sacrificing the Visual Baseline', navTitle: 'App Performance', subtitle: 'Android · 2026-07-13', lede: 'Removing repeated rendering work without deleting the effects that define the design.', meta: ['Android', 'Performance'], overview: 'The best target is work that repeats without changing the current frame, not the visible effect itself.',
      articleHtml: '<p class="article-lead">It is easy to make a complex interface faster by deleting effects. I first lock the visual result, then look for repeated work that contributes nothing new.</p><h2>Measure layers separately</h2><p>OpenGL capture, shader passes, Compose recomposition, shadows and overlays have different costs.</p><h2>Cache unchanged inputs</h2><p>Background textures, blur results and geometry often survive many frames.</p><h2>Animation needs a lifecycle</h2><p>Temporary canvases and high-frequency callbacks should stop when the effect settles.</p>'
    },
    'compose-parent-bubble-rendering': {
      title: 'Parent-Level Chat Bubble Rendering in Compose', navTitle: 'Compose Parent Rendering', subtitle: 'Android / Compose · 2026-07-18', lede: 'Drawing shared bubble material at the parent while each message keeps its content and interaction.', meta: ['Android / Compose', 'Rendering'], overview: 'Parent rendering can remove duplicated material work without moving message semantics out of child components.',
      articleHtml: '<p class="article-lead">When many chat bubbles use the same expensive material, every child drawing it independently can repeat work.</p><h2>The parent needs geometry, not ownership</h2><p>Children report bounds and visual roles. The parent draws the shared material while each message still owns its content and behaviour.</p><h2>Do not create a second layout engine</h2><p>The normal Compose layout stays authoritative and the renderer observes final geometry.</p><h2>Stable identity matters</h2><p>Lazy lists move and reuse items, so geometry records need stable message IDs and clear removal rules.</p>'
    },
    'ai-listing-research': {
      title: 'From a Supplier Link to a Verifiable Marketplace Listing', navTitle: 'AI Listing Research', subtitle: 'AI / Browser automation · 2026-08-16', lede: 'Evidence capture, live schemas, field decisions and controlled browser execution.', meta: ['AI / Browser automation', 'Research note'], overview: 'Reliable listing automation needs a traceable path from source evidence to a reviewed execution plan.',
      articleHtml: '<p class="article-lead">A marketplace form looks simple until the category schema changes or the supplier page is incomplete. The reliable unit is the path that explains where a value came from and what the browser is allowed to write.</p><h2>Capture evidence before deciding</h2><p>The source layer records visible text, structured data, variants, images and screenshots without inventing uncertain facts.</p><h2>The live schema is the contract</h2><p>Reading the current form before resolving values is safer than maintaining a large static table.</p><h2>Keep uncertainty visible</h2><p>If price, stock or another business decision is missing, the system leaves it unresolved instead of guessing.</p>'
    }
  };

  const chinese = {
    about: { title: '关于', subtitle: '我是谁', field: { description: '我是谁、学什么，以及平时在做什么。' } },
    projects: { title: '项目', subtitle: '我在做什么', field: { description: '软件、AI、图形界面、数据服务和工程仿真。' } },
    blog: { title: '博客', subtitle: '笔记与开发记录', field: { description: '项目记录、工程笔记和一些长一点的复盘。' } },
    contact: { title: '联系', subtitle: '找到我', field: { description: 'GitHub、邮箱和其他公开联系方式。' } },
    'about-identity': { title: '邹羽宸', navTitle: '邹羽宸', meta: ['22 · He/Him'] },
    'about-study': { title: '电气工程及其自动化', navTitle: '电气工程及其自动化', meta: ['专业'] },
    'about-work': { title: '独立开发', navTitle: '独立开发', meta: ['项目'] },
    'about-place': { title: '成都', navTitle: '成都', meta: ['所在地'] },
    'ai-ledger': { subtitle: 'Android AI 助手 · 2026.03 — 至今', lede: '我自己做的 Android 助手，包含聊天、工具、记忆和屏幕操作。', meta: ['Kotlin', 'Jetpack Compose', 'OpenGL', 'AI Agent'], overview: 'AI Ledger 是我从 2026 年 3 月开始做的原生 Android 应用。它支持多模型、真实流式回复、工具调用和记忆，也能通过视觉模型和 Android 无障碍读取当前界面并执行操作。', systems: ['多模型聊天与流式回复', '工具与记忆', '屏幕操作与无障碍', 'OpenGL 液态玻璃界面'] },
    'listing-studio': { subtitle: '电商商品上架自动化 / Windows · 2026.08 — 至今', lede: '给一个供应商链接，先整理上架字段，确认后再让浏览器真正写入。', meta: ['Python', 'PySide6', '浏览器自动化', 'AI'], overview: 'Listing Studio 会从供应商页面采集商品证据，用 AI 解析 Makro 字段，生成只读 Fill Plan，确认后再通过受控 Edge 会话写入。没有来源的价格、库存等经营字段会保持未填写。', systems: ['供应商页面采集', '字段解析与实时 Schema', '可审阅 Fill Plan', '受控浏览器执行'] },
    'computer-use': { subtitle: '手机界面自动化 · 2026.06 — 至今', lede: '基于视觉模型和 Android 无障碍的手机操作程序。', meta: ['Kotlin', '视觉模型', 'AccessibilityService', 'GUI Agent'], overview: 'Computer Use 会截取当前屏幕，让视觉模型给出下一步结构化动作，通过 Android 无障碍或设备命令执行，然后再看下一张截图确认结果。', systems: ['截图与动作循环', '结构化动作协议', '无障碍执行', '失败恢复与 HUD'] },
    'liquid-glass': { subtitle: 'Web → Compose 液态玻璃渲染 · 2026.05 — 至今', lede: '把网页上的液态玻璃效果迁移到原生 Compose，并尽量保留原来的光学和交互。', meta: ['OpenGL', 'Jetpack Compose', 'Shader', 'UI'], overview: '这个项目主要研究大面积折射 Shell、小型原生玻璃组件和交互动画怎样放在同一套视觉语言里，同时避免让每个组件都走昂贵的 OpenGL 路径。', systems: ['主体光学渲染', 'Compose 材质迁移', '共享背景采样', '交互与性能'] },
    'stock-crawler': { subtitle: 'A 股实时行情数据服务 · 2026.06 — 至今', lede: '给 App 和其他工具用的轻量 A 股实时数据服务。', meta: ['FastAPI', '行情数据', '爬虫', '后端服务'], overview: '这个后端负责收集并统一 A 股实时报价、分时、盘口、历史数据和榜单，通过一个较小的 API 层给 Android App 和其他分析工具使用。', systems: ['实时报价采集', '分时与盘口', '榜单数据', 'API 标准化'] },
    'gan-hemt': { subtitle: 'TCAD 建模 / 重离子 / 温度扫描 · 2026.07 — 至今', lede: '增强型 GaN HEMT 器件建模，以及重离子和温度条件下的参数扫描。', meta: ['TCAD', '半导体', '器件物理', '仿真'], overview: '使用 Sentaurus 建立增强型 GaN HEMT 模型，主要看温度、栅压、漏压和重离子 LET 对电流与稳定性的影响，并整理 Id–Vd 曲线和 Tj–Vg 合格域。', systems: ['器件结构与校准', '温度扫描', '重离子分析', '收敛与结果校验'] },
    'building-homepage': { navTitle: '从零搭建个人主页' },
    'opengl-liquid-glass': { navTitle: 'OpenGL 液态玻璃' },
    'computer-use-design': { navTitle: 'Computer Use 操作闭环' },
    'gan-hemt-stability': { navTitle: 'GaN HEMT 数值稳定性' },
    'ai-ledger-real-streaming': { navTitle: 'AI Ledger 真实流式回复' },
    'app-performance-optimization': { navTitle: 'App 性能优化' },
    'compose-parent-bubble-rendering': { navTitle: 'Compose 父级绘制' },
    'ai-listing-research': { navTitle: 'AI 自动上架研究' },
    'contact-github': { action: { label: '打开', href: 'https://github.com/yuchenm1303-png', external: true } },
    'contact-email': { action: { label: '发邮件', href: 'mailto:yuchenm1303@gmail.com', external: false } },
    'contact-phone': { action: { label: '拨打', href: 'tel:+8615223910235', external: false } },
    'contact-qq': { action: { label: '打开 QQ', href: 'tencent://message/?uin=552078638&Site=Smirel%27s%20Homepage&Menu=yes', external: false } }
  };

  const english = {
    ...Object.fromEntries(Object.entries(projectEnglish).map(([id, projectDetail]) => [id, { projectDetail }])),
    ...Object.fromEntries(Object.entries(articleEnglish).map(([id, article]) => [id, article]))
  };

  const freezeArray = (value) => Array.isArray(value) ? Object.freeze([...value]) : value;
  function freezeDetail(detail) {
    return Object.freeze({ ...detail, architecture: freezeArray(detail.architecture), highlights: freezeArray(detail.highlights), challenges: freezeArray(detail.challenges), outputs: freezeArray(detail.outputs), stack: freezeArray(detail.stack), stages: Object.freeze((detail.stages || []).map((stage) => Object.freeze([...stage]))) });
  }
  function localizedItem(item, copy) {
    if (!copy) return item;
    const next = { ...item, ...copy };
    if (copy.field) next.field = Object.freeze({ ...(item.field || {}), ...copy.field });
    if (copy.meta) next.meta = freezeArray(copy.meta);
    if (copy.systems) next.systems = freezeArray(copy.systems);
    if (copy.body) next.body = freezeArray(copy.body);
    if (copy.links) next.links = freezeArray(copy.links);
    if (copy.action) next.action = Object.freeze({ ...(item.action || {}), ...copy.action });
    if (copy.projectDetail) next.projectDetail = freezeDetail(copy.projectDetail);
    return Object.freeze(next);
  }

  const copy = language === 'zh' ? chinese : english;
  window.__SMIREL_STELLAR_CATALOG__ = Object.freeze(catalog.map((item) => localizedItem(item, copy[item.id])));
})();
