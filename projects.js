(() => {
  const projectCatalog = {
    zh: [
      {
        id: "computer-use",
        code: "CU",
        colour: "pink",
        category: "dev",
        name: "Computer Use 界面自动化",
        subtitle: "基于视觉理解与无障碍执行的端侧 GUI 智能体",
        status: "主链路迭代",
        statusTone: "active",
        type: "AI 应用 / 界面自动化",
        period: "2026.06 — 至今",
        role: "独立设计 / Android 开发 / 智能体编排",
        summary: "面向真实手机界面的 Computer Use 自动化项目。系统持续截取当前屏幕，将视觉信息交给 GUI Plus 模型规划，再把严格 JSON 动作映射到 Android 无障碍服务或设备命令执行，形成“观察—推理—操作—验证”的闭环。项目不是固定脚本，而是能够根据当前界面状态动态决定下一步。",
        architecture: [
          "VisualLoopRunner 负责截图、回合控制、超时与循环终止",
          "VisualAgentClient 对接阿里云 DashScope GUI Plus，并兼容 Qwen 风格规划协议",
          "VisualExecutionSessionState 保存任务状态、一步历史和执行证据",
          "AiAgentAccessibilityService / DeviceShellBridge 执行点击、滑动、输入、返回和应用切换",
          "HUD 与浮窗展示识别、思考、执行和结果反馈，且尽量不干扰视觉连续性"
        ],
        highlights: [
          "实现视觉理解 → 动作规划 → 无障碍执行 → 截图复核的完整闭环",
          "加入严格动作 JSON、协议修复、令牌与超时控制，降低模型输出漂移",
          "针对弹窗、键盘、加载层和短暂遮挡建立连续性处理与恢复策略",
          "扩展股票详情、指数、财经新闻、导航、音乐、视频和旅行等领域技能",
          "对证券交易场景设置明确安全边界：进入下单页可以自动化，价格、数量、方向与提交必须确认"
        ],
        challenges: [
          "不同应用的控件结构、坐标系和动画节奏差异很大，不能依赖固定模板",
          "临时浮层与键盘会改变可点击区域，需要结合前后截图判断界面是否真正完成切换",
          "模型切换后工具调用能力可能退化，因此必须把规划协议、状态和执行层解耦",
          "自动化既要追求完成率，也要避免越权操作和不可逆动作"
        ],
        outputs: [
          "可运行的 Android Computer Use 主链路与会话状态机",
          "视觉工具调用、协议修复、超时和失败恢复机制",
          "浮窗 HUD、截图反馈、运行状态与安全确认框架"
        ],
        stack: ["Kotlin", "Jetpack Compose", "AccessibilityService", "DashScope GUI Plus", "Qwen", "Vision", "JSON Actions"],
        stages: [
          ["视觉—执行主链路", "done"],
          ["模型协议与异常恢复", "active"],
          ["跨应用回归测试与公开演示", "todo"]
        ],
        next: "继续压测多应用、多弹窗和长任务场景，收敛失败类型，并整理一套可复现的 Computer Use 演示与技术说明。"
      },
      {
        id: "liquid-glass",
        code: "GLS",
        colour: "violet",
        category: "dev",
        name: "Liquid Glass Design",
        subtitle: "从 Web 视觉稿迁移到原生 Jetpack Compose 的液态玻璃系统",
        status: "原生迁移",
        statusTone: "active",
        type: "UI 系统 / 图形渲染",
        period: "2026.05 — 至今",
        role: "视觉设计 / Compose 实现 / 性能优化",
        summary: "将原有 HTML/CSS/JS/WebView 界面原封不动迁移为原生 Jetpack Compose，保留页面结构、布局比例、交互逻辑和液态玻璃视觉语言。设计目标不是普通毛玻璃，而是接近 iOS 26 的透明材质：中性玻璃本体、薄边缘高光、背景折射、体积暗核、焦散与按压回弹。",
        architecture: [
          "UnifiedGlassBackdropLayer 统一管理 Shell、Card 与 Nav 的背景采样和合成",
          "BlurredBackdrop 缓存全屏模糊结果，GlassItemRegistry 记录组件区域并复用采样",
          "Android 13+ 使用 AGSL RuntimeShader 与圆角 SDF 计算边缘折射、轮廓高光和体积感",
          "低版本使用可控拉伸与雾面 fallback，保证 minSdk 26 仍可运行",
          "Chip 与 Floating 元素独立绘制，避免所有玻璃层重复模糊背景"
        ],
        highlights: [
          "从 WebView 路线切换到原生 Compose，并跑通 GitHub Actions APK 构建",
          "保持蓝色星空/夜景背景，玻璃本身维持中性透明，不使用蓝紫色卡片填充",
          "完成暗核、分层边缘、镜面高光、焦散带、色散闪光与体积阴影",
          "加入拖拽、飞行、撞击、面板按压/抬升、弹窗模糊/变暗/缩放等状态动画",
          "针对移动端降低重复 blur、阴影和背景动画成本，同时保留完整空间感"
        ],
        challenges: [
          "Compose 与 CSS backdrop-filter 的渲染模型不同，不能简单照搬滤镜参数",
          "多个半透明组件重叠时容易产生脏灰、过曝和重复采样",
          "视觉效果越强，GPU 开销越高，需要把统一采样、缓存和局部 Shader 结合",
          "要求界面结构与原网页一致，不能为了实现方便另画一套近似版"
        ],
        outputs: [
          "原生 Compose 液态玻璃组件与统一设计令牌",
          "可交互的玻璃珠、卡片、导航和弹窗效果实验台",
          "Android 13+ Shader 路径与旧版本性能降级路径"
        ],
        stack: ["Kotlin", "Jetpack Compose", "AGSL", "RuntimeShader", "SDF", "Blur Cache", "GitHub Actions"],
        stages: [
          ["Web 结构与交互迁移", "done"],
          ["统一玻璃渲染架构", "active"],
          ["真机性能与视觉基线锁定", "todo"]
        ],
        next: "锁定一套不依赖补丁覆盖的稳定基线，完成不同 Android 版本、分辨率和性能档位的真机验证。"
      },
      {
        id: "stock-crawler",
        code: "STK",
        colour: "mint",
        category: "dev",
        name: "股票行情爬虫与代理服务",
        subtitle: "A 股实时行情、分时、盘口与榜单数据服务",
        status: "服务运行",
        statusTone: "active",
        type: "数据采集 / FastAPI 服务",
        period: "2026.06 — 至今",
        role: "后端开发 / 数据源适配 / 缓存设计",
        summary: "独立后端目录 ai-ledger-stock-proxy，部署在 Render，由 Android 客户端通过 HTTP API 获取 A 股行情。系统直接对接公开行情接口并进行字段标准化、缓存和降级，不依赖手机端抓取网页。主页接口可同时聚合主要指数、约 5000 只 A 股、行业板块和派生榜单。",
        architecture: [
          "FastAPI + Uvicorn 提供统一 REST API，HTTPX 管理并发请求、超时和重试",
          "东方财富 push2 / push2delay / push2his 作为报价、分时和历史数据主源",
          "五日分时可降级到腾讯数据源；集合竞价使用东方财富与通达信 7709 协议，TDX 优先",
          "18 秒 fresh cache 保证常用页面响应速度，6 小时 stale cache 用于上游异常降级",
          "后台预热主要指数、全市场股票、板块和榜单；Render 冷启动后自动恢复数据"
        ],
        highlights: [
          "市场首页覆盖约 10 个主要指数、约 5000 只 A 股和板块排行",
          "支持报价、分时、五档盘口、逐笔成交、日线/历史走势和集合竞价数据",
          "为最近查看的股票启动活跃 tick worker，交易时段约每 0.9 秒刷新一次",
          "限制最多 4 只并发活跃股票，避免无意义的全市场高频轮询",
          "Android 通过 /api/stock/a-share/market/home 等接口直接消费标准化结构数据"
        ],
        challenges: [
          "公开行情接口字段多且变动频繁，需要统一代码、市场、时间和涨跌幅口径",
          "Render Free 长时间空闲会休眠，冷启动必须配合 stale cache 与后台预热",
          "高频逐笔数据容易造成请求放大，因此按最近访问股票动态启停 worker",
          "多数据源返回速度和完整度不同，需要清晰的优先级、降级和错误隔离"
        ],
        outputs: [
          "可独立部署的 A 股行情代理后端",
          "面向 App 的统一市场首页、个股详情和实时 tick 接口",
          "缓存预热、数据源降级和活跃股票刷新机制"
        ],
        stack: ["Python", "FastAPI", "Uvicorn", "HTTPX", "Eastmoney", "TDX 7709", "Render"],
        stages: [
          ["市场首页与个股数据", "done"],
          ["实时 tick 与多源降级", "active"],
          ["稳定性监控与独立网页完善", "todo"]
        ],
        next: "继续完善数据源健康检查、冷启动体验和异常字段校验，并先把独立股票行情网页打磨完成，再同步到 App。"
      },
      {
        id: "gan-hemt",
        code: "GaN",
        colour: "cyan",
        category: "engineering",
        name: "GaN HEMT Simulation",
        subtitle: "增强型功率器件 TCAD 建模、重离子与温度扫描",
        status: "参数扫描",
        statusTone: "research",
        type: "半导体器件仿真",
        period: "2026.07 — 至今",
        role: "器件建模 / 数值求解 / 结果可视化",
        summary: "使用 Sentaurus 建立增强型 GaN HEMT 器件模型，研究漏极电压、栅压、结温与重离子 LET 对漏极电流和安全工作区的耦合影响。目标不仅是得到单条 Id–Vd 曲线，还要建立工程可用的 Tj–Vg 合格域和二维/三维判据图。",
        architecture: [
          "SDE 构建设备结构，重点加密 2DEG 与栅漏 2 nm 邻域",
          "迁移率采用 DopingDep、HighFieldSat、Enormal，复合采用 SRH 与 Auger",
          "雪崩模型使用 Okuto，并通过 ExtendedPrecision、RelErrControl 和分段 QuasiStationary 提高收敛性",
          "温度、栅压、LET 与电流限值由独立扫描脚本组织，结果再进入 MATLAB/Python 可视化",
          "应用层使用 R_on、Rθjc 和环境温度建立温升与安全域映射"
        ],
        highlights: [
          "开展 Vd 0—650 V、Vg −5—0 V、温度约 −55—150 ℃、LET 0.2—5 的组合扫描",
          "针对 Newton 不收敛、竖线曲线和高场模型冲突建立缩步与模型排查策略",
          "围绕 20/25/40 μA 等电流判据生成不同 LET 条件下的 Tj–Vg 合格域",
          "同时输出专业白底二维图与三维趋势图，保持准确刻度和真实趋势",
          "逐步校核高温、高 LET 区域的数值稳定性与物理合理性"
        ],
        challenges: [
          "重离子、高温和高漏压叠加时方程刚性显著增强，极易失去收敛",
          "器件结构、物理模型和扫描步长任一设置不合理都会生成伪曲线",
          "需要区分瞬态峰值、稳态端点电流与应用层限制，避免混用判据",
          "结果图既要专业美观，也必须严格保持仿真数据的数值关系"
        ],
        outputs: [
          "可复用的增强型 GaN HEMT Sentaurus 模型",
          "温度—栅压—LET 参数扫描与收敛策略",
          "Id–Vd 曲线、Tj–Vg 合格域及二维/三维工程图件"
        ],
        stack: ["Sentaurus SDE", "Sentaurus Device", "TCAD", "GaN HEMT", "Heavy Ion", "MATLAB", "Numerical Solvers"],
        stages: [
          ["结构、网格与物理模型", "done"],
          ["温度 / Vg / LET 联合扫描", "active"],
          ["实验/文献校核与正式报告", "todo"]
        ],
        next: "完成高风险参数区的复算和一致性检查，并统一输出可直接用于报告与答辩的正式图件。"
      },
      {
        id: "ocean-eratio",
        code: "POC",
        colour: "gold",
        category: "research",
        name: "Global Ocean e-ratio Research",
        subtitle: "全球海洋颗粒碳输出效率数据库与机制分类",
        status: "论文推进",
        statusTone: "paper",
        type: "海洋生物地球化学 / 数据分析",
        period: "2025.10 — 至今",
        role: "数据库构建 / 统计模型 / 论文图件",
        summary: "整合全球 234Th 推算的颗粒有机碳输出通量、卫星 NPP、Longhurst 生态省区和环境因子，建立全球 e-ratio 数据库，并解释不同海区的物理注入、上升流、颗粒形成与食物网控制机制，目标期刊为 Global Biogeochemical Cycles。",
        architecture: [
          "汇总站位级 POC export 数据，保留深度、时间、重复站位和来源信息",
          "NPP 以 CbPM 为主、VGPM 为补充，按时间窗口匹配并年化",
          "自动匹配 Longhurst Province / Region / Biome，并维护人工复核结果",
          "使用 Spearman、偏相关、残差分析、GAM/HGAM 和敏感性分析构建机制证据链",
          "主文与补充材料分别组织机制地图、代表省区四图、热力图、矩阵和诊断结果"
        ],
        highlights: [
          "数据库覆盖 1989—2023 年、超过 1000 个站位，主分析聚焦 2003—2023 年",
          "计算 100 m POC export / NPP 的年尺度 e-ratio，并执行 0—1 质量控制",
          "建立 Wind-mixing/physical-injection、Upwelling、Particle formation/food-web、Composite、Uncertain 五类机制",
          "完成代表省区 ANTA、CHIL、NADR、SANT、NATR、PEQD、ARCT、ARCH 的机制图",
          "已形成机制地图、证据得分热力图和自动分类—人工复核矩阵"
        ],
        challenges: [
          "不同研究的采样深度、时间尺度和通量口径不完全一致，需要锁定统一输出深度与匹配规则",
          "e-ratio 同时受物理输运、生产力和群落组成影响，单变量相关不能直接解释机制",
          "省区样本量和季节覆盖不均，需要主分析与敏感性分析并行",
          "目标期刊对数据可追溯性、统计诊断和图件规范要求很高"
        ],
        outputs: [
          "analysis-ready 全球 POC–NPP–环境因子数据库",
          "Longhurst 省区机制分类与 frozen-chain evidence score",
          "GBC 主文图件、补充诊断图和论文方法框架"
        ],
        stack: ["Python", "R", "mgcv", "GAM/HGAM", "Remote Sensing", "Longhurst", "Statistics"],
        stages: [
          ["数据清洗、NPP 匹配与省区归属", "done"],
          ["机制分类与代表省区分析", "done"],
          ["V2 数据库、敏感性分析与论文写作", "active"]
        ],
        next: "冻结不覆盖原文件的 analysis-ready V2 数据库，补齐敏感性分析和诊断，并完成 GBC 稿件主文与补充材料。"
      }
    ],
    en: []
  };

  projectCatalog.en = projectCatalog.zh.map((project) => ({ ...project }));

  const labels = {
    zh: {
      heading: "PROJECTS.EXE / 项目管理器", path: "C:\\YUCHEN\\PROJECTS",
      all: "全部", dev: "应用开发", engineering: "工程与器件", research: "科研分析",
      files: "5 个项目", active: "5 个持续推进", selected: "已选择",
      overview: "项目概览", architecture: "系统架构", highlights: "关键工作",
      challenges: "技术难点", outputs: "阶段成果", stack: "技术栈",
      roadmap: "当前进度", next: "下一步", type: "类型", period: "周期",
      role: "职责", status: "状态", profile: "打开 GitHub 主页",
      privateNote: "项目内容按当前真实进度整理；部分仓库、数据与论文材料暂未公开。",
      empty: "此分类下暂无项目。"
    },
    en: {
      heading: "PROJECTS.EXE / PROJECT MANAGER", path: "C:\\YUCHEN\\PROJECTS",
      all: "ALL", dev: "APP DEV", engineering: "ENGINEERING", research: "RESEARCH",
      files: "5 PROJECTS", active: "5 IN PROGRESS", selected: "SELECTED",
      overview: "OVERVIEW", architecture: "ARCHITECTURE", highlights: "KEY WORK",
      challenges: "CHALLENGES", outputs: "OUTPUTS", stack: "TECH STACK",
      roadmap: "PROGRESS", next: "NEXT STEP", type: "TYPE", period: "PERIOD",
      role: "ROLE", status: "STATUS", profile: "OPEN GITHUB PROFILE",
      privateNote: "Project details reflect current progress; some repositories, data and manuscript materials remain private.",
      empty: "NO PROJECTS IN THIS CATEGORY."
    }
  };

  function projectExplorerTemplate(lang) {
    const projects = projectCatalog[lang];
    const text = labels[lang];
    return `
      <section class="projects-app" data-project-lang="${lang}">
        <header class="projects-header">
          <div>
            <h2 class="section-title projects-heading">${text.heading}</h2>
            <div class="projects-path"><span class="projects-drive">C:</span>${text.path.slice(2)}<span class="path-cursor"></span></div>
          </div>
          <div class="projects-counters" aria-label="Project summary"><span>${text.files}</span><span>${text.active}</span></div>
        </header>
        <div class="project-toolbar" role="toolbar" aria-label="Project filters">
          ${filterButton("all", text.all, true)}${filterButton("dev", text.dev)}${filterButton("engineering", text.engineering)}${filterButton("research", text.research)}
        </div>
        <div class="project-explorer">
          <div class="project-browser" aria-label="Project list">
            <div class="project-browser-head"><span>NAME</span><span>STATUS</span></div>
            <div class="project-rows">${projects.map((project, index) => projectRow(project, index === 0)).join("")}</div>
            <div class="project-empty" hidden>${text.empty}</div>
          </div>
          <article class="project-inspector" id="projectInspector" aria-live="polite"></article>
        </div>
        <footer class="projects-footer">
          <span><i class="projects-led"></i>${text.selected}: <strong data-selected-project>${projects[0].name}</strong></span>
          <span>${text.privateNote}</span>
        </footer>
      </section>`;
  }

  function filterButton(filter, label, active = false) {
    return `<button class="project-filter${active ? " is-active" : ""}" type="button" data-project-filter="${filter}">${label}</button>`;
  }

  function projectRow(project, selected) {
    return `<button class="project-row${selected ? " is-selected" : ""}" type="button" data-project-id="${project.id}" data-project-category="${project.category}" aria-pressed="${selected}">
      <span class="project-row-icon project-colour-${project.colour}">${project.code}</span>
      <span class="project-row-copy"><strong>${project.name}</strong><small>${project.subtitle}</small></span>
      <span class="project-row-status tone-${project.statusTone}"><i></i>${project.status}</span>
    </button>`;
  }

  function inspectorTemplate(project, lang) {
    const text = labels[lang];
    return `
      <div class="inspector-titlebar">
        <span class="inspector-icon project-colour-${project.colour}">${project.code}</span>
        <div><h3>${project.name}</h3><p>${project.subtitle}</p></div>
        <span class="inspector-status tone-${project.statusTone}">${project.status}</span>
      </div>
      <div class="inspector-file">README.TXT — ${project.id.toUpperCase()}</div>
      <div class="project-facts">${factCell(text.type, project.type)}${factCell(text.period, project.period)}${factCell(text.role, project.role)}${factCell(text.status, project.status)}</div>
      ${detailPanel(text.overview, `<p class="project-summary">${project.summary}</p>`)}
      ${detailPanel(text.architecture, detailList(project.architecture, "architecture-list"))}
      ${detailPanel(text.highlights, detailList(project.highlights, "project-highlights"))}
      ${detailPanel(text.challenges, detailList(project.challenges, "challenge-list"))}
      ${detailPanel(text.outputs, detailList(project.outputs, "output-list"))}
      ${detailPanel(text.stack, `<div class="project-stack">${project.stack.map((item) => `<span>${item}</span>`).join("")}</div>`)}
      ${detailPanel(text.roadmap, `<ol class="project-roadmap">${project.stages.map(([item, status]) => `<li class="roadmap-${status}"><i></i><span>${item}</span><b>${status === "done" ? "OK" : status === "active" ? "RUN" : "..."}</b></li>`).join("")}</ol>`)}
      ${detailPanel(text.next, `<p class="project-next">${project.next}</p>`)}
      <div class="project-actions"><a class="retro-action" href="https://github.com/yuchenm1303-png" target="_blank" rel="noreferrer">${text.profile}</a></div>`;
  }

  function factCell(label, value) { return `<div class="project-fact"><span>${label}</span><strong>${value}</strong></div>`; }
  function detailPanel(title, body) { return `<section class="inspector-panel"><h4>${title}</h4>${body}</section>`; }
  function detailList(items, className) { return `<ul class="project-detail-list ${className}">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`; }

  content.zh.sections.projects = projectExplorerTemplate("zh");
  content.en.sections.projects = projectExplorerTemplate("en");

  const baseRender = render;
  render = function renderWithProjectExplorer() {
    baseRender();
    if (state.section === "projects") initialiseProjectExplorer();
  };

  function initialiseProjectExplorer() {
    const root = contentElement.querySelector(".projects-app");
    if (!root) return;
    const lang = root.dataset.projectLang;
    const projects = projectCatalog[lang];
    const rows = [...root.querySelectorAll(".project-row")];
    const filters = [...root.querySelectorAll(".project-filter")];
    const inspector = root.querySelector("#projectInspector");
    const selectedLabel = root.querySelector("[data-selected-project]");
    const emptyState = root.querySelector(".project-empty");
    let selectedId = projects[0].id;

    const showProject = (id) => {
      const project = projects.find((item) => item.id === id);
      if (!project) return;
      selectedId = id;
      inspector.classList.remove("inspector-refresh");
      void inspector.offsetWidth;
      inspector.innerHTML = inspectorTemplate(project, lang);
      inspector.scrollTop = 0;
      inspector.classList.add("inspector-refresh");
      selectedLabel.textContent = project.name;
      rows.forEach((row) => {
        const selected = row.dataset.projectId === id;
        row.classList.toggle("is-selected", selected);
        row.setAttribute("aria-pressed", String(selected));
      });
    };

    const applyFilter = (filter) => {
      filters.forEach((button) => button.classList.toggle("is-active", button.dataset.projectFilter === filter));
      const visibleRows = [];
      rows.forEach((row) => {
        const visible = filter === "all" || row.dataset.projectCategory === filter;
        row.hidden = !visible;
        if (visible) visibleRows.push(row);
      });
      emptyState.hidden = visibleRows.length !== 0;
      if (visibleRows.length && !visibleRows.some((row) => row.dataset.projectId === selectedId)) showProject(visibleRows[0].dataset.projectId);
    };

    rows.forEach((row) => row.addEventListener("click", () => showProject(row.dataset.projectId)));
    filters.forEach((button) => button.addEventListener("click", () => applyFilter(button.dataset.projectFilter)));
    root.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const visibleRows = rows.filter((row) => !row.hidden);
      const currentIndex = visibleRows.findIndex((row) => row.dataset.projectId === selectedId);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + step + visibleRows.length) % visibleRows.length;
      event.preventDefault();
      visibleRows[nextIndex].focus();
      showProject(visibleRows[nextIndex].dataset.projectId);
    });

    applyFilter("all");
    showProject(selectedId);
  }
})();
