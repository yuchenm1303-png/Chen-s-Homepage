(() => {
  'use strict';

  const sourceArticles = new Map(
    (window.BlogArticles?.zh || []).map((article) => [article.id, article])
  );

  function articleSource(id, fallback) {
    return sourceArticles.get(id) || fallback;
  }

  function articleItem({ id, order, navTitle, fallback, star }) {
    const source = articleSource(id, fallback);
    const category = source.category || fallback.category || 'Blog';
    const date = source.date || fallback.date || '';
    const readTime = source.readTime || fallback.readTime || '';
    const summary = source.summary || fallback.summary || '';
    const title = source.title || fallback.title || navTitle || id;
    return {
      id,
      kind: 'note',
      parentField: 'blog',
      hiddenFromIndex: true,
      order,
      title,
      navTitle: source.shortTitle || navTitle || title,
      subtitle: [category, date].filter(Boolean).join(' · '),
      date,
      lede: summary,
      meta: [category, readTime].filter(Boolean),
      overview: summary,
      body: fallback.body || [],
      articleHtml: source.body || '',
      star,
    };
  }

  const fields = [
    {
      id: 'about', kind: 'field', order: '01', title: 'About', subtitle: 'Personal field',
      field: { description: 'Identity, place, study and the things I keep building around.', fov: 48, zoom: 1.00 },
      constellation: {
        nodes: ['about-identity', 'about-study', 'about-work', 'about-place'],
        edges: [['about','about-identity'],['about','about-study'],['about','about-work'],['about','about-place'],['about-identity','about-work']],
      },
      star: { target: [-0.50,-0.12], depth: [15,33], minBrightness: 2.35, tint: '#ffe7c7', radius: 1.00, activity: 0.48, corona: 0.54, halo: 0.90, classLabel: 'F5 · Warm-white personal primary' },
    },
    {
      id: 'projects', kind: 'field', order: '02', title: 'Projects', subtitle: 'Selected work field',
      field: { description: 'AI systems, engineering tools, visual interfaces and simulation work.', fov: 45, zoom: 1.08 },
      constellation: {
        nodes: ['ai-ledger','listing-studio','computer-use','liquid-glass','stock-crawler','gan-hemt'],
        edges: [['projects','ai-ledger'],['projects','listing-studio'],['projects','computer-use'],['projects','liquid-glass'],['projects','stock-crawler'],['projects','gan-hemt'],['ai-ledger','computer-use'],['ai-ledger','liquid-glass']],
      },
      star: { target: [0.08,0.34], depth: [16,34], minBrightness: 2.60, tint: '#d4ecff', radius: 1.08, activity: 0.92, corona: 1.00, halo: 1.00, classLabel: 'A1 · Blue-white project primary' },
    },
    {
      id: 'blog', kind: 'field', order: '03', title: 'Blog', subtitle: 'Observation archive',
      field: { description: 'Build logs, engineering notes and long-form records from ongoing projects.', fov: 46, zoom: 1.04 },
      constellation: {
        nodes: ['building-homepage','opengl-liquid-glass','computer-use-design','gan-hemt-stability','ai-ledger-real-streaming','app-performance-optimization','compose-parent-bubble-rendering','ai-listing-research'],
        edges: [['blog','building-homepage'],['blog','opengl-liquid-glass'],['blog','computer-use-design'],['blog','gan-hemt-stability'],['blog','ai-ledger-real-streaming'],['blog','app-performance-optimization'],['blog','compose-parent-bubble-rendering'],['blog','ai-listing-research'],['ai-ledger-real-streaming','app-performance-optimization'],['app-performance-optimization','compose-parent-bubble-rendering'],['opengl-liquid-glass','compose-parent-bubble-rendering'],['computer-use-design','ai-ledger-real-streaming']],
      },
      star: { target: [-0.08,-0.38], depth: [15,34], minBrightness: 2.45, tint: '#fff0d4', radius: 1.02, activity: 0.56, corona: 0.64, halo: 0.96, classLabel: 'F7 · Warm-white archive primary' },
    },
    {
      id: 'contact', kind: 'field', order: '04', title: 'Contact', subtitle: 'Communication field',
      field: { description: 'Public ways to reach me or follow the work.', fov: 50, zoom: 0.92 },
      constellation: {
        nodes: ['contact-github','contact-email','contact-phone','contact-qq'],
        edges: [['contact','contact-github'],['contact','contact-email'],['contact','contact-phone'],['contact','contact-qq']],
      },
      star: { target: [0.44,-0.12], depth: [17,36], minBrightness: 2.30, tint: '#ccecff', radius: 0.96, activity: 0.72, corona: 0.74, halo: 0.78, classLabel: 'A6 · Cool-white signal primary' },
    },
  ];

  const profileNodes = [
    { id:'about-identity', kind:'profile', parentField:'about', hiddenFromIndex:true, interactive:false, title:'Jack / 邹羽宸', navTitle:'Jack / 邹羽宸', meta:['22 · He/Him'], star:{ target:[-0.58,0.02], depth:[15,33], minBrightness:1.60, tint:'#fff2dc', radius:0.78, activity:0.38, corona:0.34, halo:0.62, classLabel:'Personal identity node' } },
    { id:'about-study', kind:'profile', parentField:'about', hiddenFromIndex:true, interactive:false, title:'Electrical Engineering & Automation', navTitle:'Electrical Engineering', meta:['Study'], star:{ target:[-0.40,-0.34], depth:[15,34], minBrightness:1.55, tint:'#d9eaff', radius:0.74, activity:0.42, corona:0.38, halo:0.60, classLabel:'Study node' } },
    { id:'about-work', kind:'profile', parentField:'about', hiddenFromIndex:true, interactive:false, title:'Independent Developer', navTitle:'Independent Developer', meta:['Work'], star:{ target:[-0.28,-0.16], depth:[15,34], minBrightness:1.55, tint:'#e8e4ff', radius:0.76, activity:0.50, corona:0.42, halo:0.64, classLabel:'Work node' } },
    { id:'about-place', kind:'profile', parentField:'about', hiddenFromIndex:true, interactive:false, title:'Chengdu', navTitle:'Chengdu', meta:['Home'], star:{ target:[-0.62,-0.34], depth:[16,35], minBrightness:1.50, tint:'#ffd9bd', radius:0.72, activity:0.32, corona:0.30, halo:0.58, classLabel:'Place node' } },
  ];

  const projects = [
    {
      id:'ai-ledger', kind:'project', parentField:'projects', hiddenFromIndex:true, order:'P1', title:'AI Ledger',
      subtitle:'Native Android multi-model AI assistant & visual agent · 2026.03 — present',
      lede:'A phone-side AI assistant that combines multi-model chat, tools, memory and visual interaction.',
      meta:['Kotlin','Jetpack Compose','OpenGL','AI Agents'],
      overview:'AI Ledger is a native Android AI assistant built around natural chat, cloud model routing, streaming responses, structured tools, memory and a visual agent that can understand interfaces and execute real mobile tasks.',
      systems:['Multi-model chat & streaming','Tool and memory runtime','Visual agent & accessibility','OpenGL liquid-glass shell'], links:[],
      star:{ target:[-0.12,0.22], depth:[16,35], minBrightness:2.15, tint:'#c9e8ff', radius:1.00, activity:0.92, corona:1.00, halo:0.92, classLabel:'B9 · Ice-blue active project' },
    },
    {
      id:'listing-studio', kind:'project', parentField:'projects', hiddenFromIndex:true, order:'P2', title:'Listing Studio',
      subtitle:'AI commerce automation / Windows app · 2026.08 — present', lede:'From a supplier product link to a controlled, reviewable marketplace listing workflow.',
      meta:['Python','PySide6','Browser Automation','AI Workflow'],
      overview:'Listing Studio turns supplier evidence into structured listing decisions, a read-only Fill Plan and controlled browser execution for marketplace back offices while keeping uncertain business fields blocked for human review.',
      systems:['Source evidence capture','AI resolver & live schema','Fill Plan & hard guards','Managed browser execution'],
      links:[{ label:'Repository', href:'https://github.com/yuchenm1303-png/ecommerce-agent' }],
      star:{ target:[0.24,0.18], depth:[16,36], minBrightness:1.90, tint:'#ffd0a3', radius:0.96, activity:0.68, corona:0.66, halo:0.94, classLabel:'G0 · Warm-white workflow project' },
    },
    {
      id:'computer-use', kind:'project', parentField:'projects', hiddenFromIndex:true, order:'P3', title:'Computer Use',
      subtitle:'Vision + accessibility mobile GUI agent · 2026.06 — present', lede:'A visual interaction loop that observes a phone screen, plans actions and verifies the result.',
      meta:['Kotlin','Vision','AccessibilityService','GUI Agent'],
      overview:'The Computer Use project continuously captures the current mobile interface, plans structured actions with a visual model, executes them through Android accessibility or device commands, then verifies the next screen.',
      systems:['Observe / plan / execute loop','Structured action protocol','Accessibility execution','Failure recovery & HUD'], links:[],
      star:{ target:[-0.12,0.48], depth:[15,35], minBrightness:1.85, tint:'#eadbff', radius:0.92, activity:0.84, corona:0.82, halo:0.80, classLabel:'A3 · Violet-white responsive project' },
    },
    {
      id:'liquid-glass', kind:'project', parentField:'projects', hiddenFromIndex:true, order:'P4', title:'Liquid Glass Design',
      subtitle:'Web-to-Compose realtime glass rendering system · 2026.05 — present', lede:'A rendering and interaction system for preserving liquid-glass optics across WebGL and native Compose.',
      meta:['OpenGL','Jetpack Compose','Shader','UI Systems'],
      overview:'Liquid Glass Design explores how a large refractive shell, smaller native glass surfaces and interaction feedback can share one visual language without forcing every component through the same expensive rendering path.',
      systems:['Optical shell rendering','Compose material migration','Shared backdrop strategy','Interaction & performance'], links:[],
      star:{ target:[0.30,0.44], depth:[16,35], minBrightness:1.95, tint:'#d7e7ff', radius:0.94, activity:0.62, corona:0.74, halo:1.00, classLabel:'A5 · Cool-white refractive project' },
    },
    {
      id:'stock-crawler', kind:'project', parentField:'projects', hiddenFromIndex:true, order:'P5', title:'Market Data Proxy',
      subtitle:'A-share realtime quotes, intraday, order book & ranking data service · 2026.06 — present', lede:'A small realtime data service for collecting and normalising market information for downstream tools.',
      meta:['FastAPI','Market Data','Crawler','Data Service'],
      overview:'The market-data proxy collects and serves A-share realtime quotes, intraday data, order-book information and ranking feeds through a compact API layer for analysis and agent tools.',
      systems:['Realtime quote collection','Intraday & order book','Ranking feeds','API normalisation'], links:[],
      star:{ target:[0.42,0.28], depth:[17,37], minBrightness:1.85, tint:'#c8ffe8', radius:0.88, activity:0.70, corona:0.60, halo:0.78, classLabel:'F6 · Mint-white signal project' },
    },
    {
      id:'gan-hemt', kind:'project', parentField:'projects', hiddenFromIndex:true, order:'P6', title:'GaN HEMT Simulation',
      subtitle:'TCAD modelling, heavy-ion and temperature sweeps · 2026.07 — present', lede:'Enhancement-mode GaN HEMT device modelling with repeatable heavy-ion and thermal parameter sweeps.',
      meta:['TCAD','Semiconductor','Physics','Simulation'],
      overview:'A research simulation workflow for enhancement-mode GaN HEMTs, focusing on stable device modelling, temperature effects, heavy-ion response and disciplined parameter comparison.',
      systems:['Device structure & calibration','Temperature sweeps','Heavy-ion analysis','Convergence & validation'], links:[],
      star:{ target:[0.08,0.06], depth:[17,37], minBrightness:2.05, tint:'#bfe1ff', radius:0.98, activity:0.76, corona:0.82, halo:0.82, classLabel:'B8 · Hot-blue research project' },
    },
  ];

  const articles = [
    articleItem({ id:'building-homepage', order:'B1', navTitle:'Building a Homepage', fallback:{ title:'从零搭建个人主页：星空与长期数字空间', shortTitle:'从零搭建个人主页', date:'2026-08-01', category:'网站开发', readTime:'Build log', summary:'把个人主页从静态简介变成可以持续生长的长期数字空间。', body:['The homepage is treated as a long-term digital room rather than a compressed résumé.'] }, star:{ target:[-0.30,-0.24], depth:[15,34], minBrightness:1.70, tint:'#fff0d2', radius:0.84, activity:0.46, corona:0.42, halo:0.72, classLabel:'F8 · Warm-white journal article' } }),
    articleItem({ id:'opengl-liquid-glass', order:'B2', navTitle:'OpenGL Liquid Glass', fallback:{ title:'两套 OpenGL 液态玻璃：边缘折射与主体折射为什么不能混为一谈', date:'2026-07-28', category:'图形渲染', readTime:'Graphics note', summary:'拆开边缘折射与主体折射，记录液态玻璃渲染结构的排查方法。', body:['Edge refraction and body refraction solve different optical jobs.'] }, star:{ target:[-0.20,-0.52], depth:[15,34], minBrightness:1.68, tint:'#d8e8ff', radius:0.82, activity:0.54, corona:0.48, halo:0.70, classLabel:'A6 · Glass-blue article' } }),
    articleItem({ id:'computer-use-design', order:'B3', navTitle:'Computer Use', fallback:{ title:'Computer Use 界面自动化：从截图到可验证操作闭环', date:'2026-07-20', category:'AI 应用', readTime:'Design note', summary:'从截图理解到执行和验证，建立可恢复的移动端 GUI 操作闭环。', body:['A useful GUI agent must know what it saw, what it did and why it can continue.'] }, star:{ target:[0.02,-0.54], depth:[15,34], minBrightness:1.65, tint:'#e2dcff', radius:0.82, activity:0.60, corona:0.56, halo:0.68, classLabel:'A3 · Violet-white article' } }),
    articleItem({ id:'gan-hemt-stability', order:'B4', navTitle:'GaN HEMT Stability', fallback:{ title:'GaN HEMT 仿真中的数值稳定性：为什么曲线会失真或不收敛', date:'2026-07-10', category:'工程仿真', readTime:'Research note', summary:'记录器件仿真中收敛、网格、步长与求解器敏感性。', body:['Numerical failures often appear as believable curves rather than obvious crashes.'] }, star:{ target:[0.18,-0.34], depth:[17,37], minBrightness:1.88, tint:'#c8e5ff', radius:0.86, activity:0.70, corona:0.68, halo:0.72, classLabel:'B8 · Hot-blue research article' } }),
    articleItem({ id:'ai-ledger-real-streaming', order:'B5', navTitle:'AI Ledger Streaming', fallback:{ title:'AI Ledger 的真实流式回复：从网络分块到 Compose 稳定渲染', date:'2026-07-16', category:'Android 开发', readTime:'16 分钟阅读', summary:'从网络分块到同一消息气泡的稳定增量刷新，记录端到端真实流式链路。', body:['Real streaming reduces interaction latency rather than faking text with a local typewriter effect.'] }, star:{ target:[-0.38,-0.44], depth:[15,34], minBrightness:1.62, tint:'#d7edff', radius:0.78, activity:0.58, corona:0.46, halo:0.60, classLabel:'A8 · Streaming article' } }),
    articleItem({ id:'app-performance-optimization', order:'B6', navTitle:'App Performance', fallback:{ title:'不牺牲视觉效果的 App 性能优化：从 OpenGL 玻璃到 Compose 重组', date:'2026-07-13', category:'Android 开发', readTime:'20 分钟阅读', summary:'锁住视觉基线，删除昂贵但对当前画面没有贡献的重复工作。', body:['The goal is not to delete effects until the frame rate improves.'] }, star:{ target:[0.12,-0.58], depth:[15,34], minBrightness:1.62, tint:'#cfe8ff', radius:0.78, activity:0.52, corona:0.44, halo:0.64, classLabel:'A7 · Performance article' } }),
    articleItem({ id:'compose-parent-bubble-rendering', order:'B7', navTitle:'Compose Parent Rendering', fallback:{ title:'把聊天气泡材质上移到父级：Compose 父级绘制组件的实现与边界', date:'2026-07-18', category:'Android / Compose', readTime:'13 分钟阅读', summary:'父级统一绘制重复材质，子气泡继续保留正文、附件和完整交互。', body:['Parent rendering reduces duplicate material work without moving message semantics out of the child bubble.'] }, star:{ target:[0.30,-0.48], depth:[16,35], minBrightness:1.58, tint:'#d8dcff', radius:0.76, activity:0.48, corona:0.42, halo:0.60, classLabel:'A5 · Compose article' } }),
    articleItem({ id:'ai-listing-research', order:'B8', navTitle:'AI Listing Research', fallback:{ title:'从商品链接到可验证上架：AI 自动上架系统的证据链、实时 Schema 与浏览器执行', date:'2026-08-16', category:'AI / 浏览器自动化', readTime:'18 分钟阅读', summary:'从商品证据、实时 Schema、字段决策到受控浏览器执行，建立可验证的上架链路。', body:['Reliable listing automation is a decision-and-execution system, not a form-filling shortcut.'] }, star:{ target:[0.12,-0.18], depth:[16,36], minBrightness:1.68, tint:'#ffd8b5', radius:0.80, activity:0.56, corona:0.48, halo:0.68, classLabel:'F4 · Warm automation article' } }),
  ];

  const contacts = [
    { id:'contact-github', kind:'contact', parentField:'contact', hiddenFromIndex:true, title:'GitHub', navTitle:'GitHub', action:{ label:'Open', href:'https://github.com/yuchenm1303-png', external:true }, star:{ target:[0.58,0.04], depth:[17,36], minBrightness:1.65, tint:'#d9ecff', radius:0.76, activity:0.42, corona:0.38, halo:0.62, classLabel:'GitHub signal node' } },
    { id:'contact-email', kind:'contact', parentField:'contact', hiddenFromIndex:true, title:'Email', navTitle:'Email', action:{ label:'Mail', href:'mailto:yuchenm1303@gmail.com', external:false }, star:{ target:[0.38,-0.34], depth:[17,36], minBrightness:1.60, tint:'#cbe6ff', radius:0.74, activity:0.46, corona:0.40, halo:0.62, classLabel:'Email signal node' } },
    { id:'contact-phone', kind:'contact', parentField:'contact', hiddenFromIndex:true, title:'Phone', navTitle:'Phone', action:{ label:'Call', href:'tel:+8615223910235', external:false }, star:{ target:[0.60,-0.34], depth:[18,37], minBrightness:1.55, tint:'#d4fff0', radius:0.72, activity:0.48, corona:0.42, halo:0.60, classLabel:'Phone signal node' } },
    { id:'contact-qq', kind:'contact', parentField:'contact', hiddenFromIndex:true, title:'QQ', navTitle:'QQ', action:{ label:'Open QQ', href:'tencent://message/?uin=552078638&Site=Smirel%27s%20Homepage&Menu=yes', external:false }, star:{ target:[0.28,-0.14], depth:[17,36], minBrightness:1.55, tint:'#e0ddff', radius:0.72, activity:0.44, corona:0.38, halo:0.60, classLabel:'QQ signal node' } },
  ];

  const items = [...fields, ...profileNodes, ...projects, ...articles, ...contacts];

  for (const item of items) {
    if (item.star) Object.freeze(item.star);
    if (item.field) Object.freeze(item.field);
    if (item.meta) Object.freeze(item.meta);
    if (item.systems) Object.freeze(item.systems);
    if (item.links) Object.freeze(item.links);
    if (item.body) Object.freeze(item.body);
    if (item.action) Object.freeze(item.action);
    if (item.constellation) {
      Object.freeze(item.constellation.nodes);
      Object.freeze(item.constellation.edges);
      Object.freeze(item.constellation);
    }
    Object.freeze(item);
  }

  window.__SMIREL_STELLAR_CATALOG__ = Object.freeze(items);
})();
