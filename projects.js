(() => {
  const projectCatalog = {
    zh: [
      {
        id: "liquid-glass",
        code: "GLS",
        colour: "violet",
        category: "dev",
        name: "Liquid Glass Design",
        subtitle: "Web 与 Jetpack Compose 液态玻璃系统",
        status: "持续优化",
        statusTone: "active",
        type: "UI 系统 / 图形渲染",
        period: "2026.05 — 至今",
        role: "视觉设计 / Compose 实现 / 性能优化",
        summary: "围绕透明材质、边缘折射、主体透镜和按压反馈，构建可在网页与 Android 原生界面中复用的液态玻璃系统。重点不是叠加特效，而是稳定背景采样、控制 OpenGL 使用范围，并让材质、交互和性能保持一致。",
        highlights: [
          "完成网页阅读器与原生 Compose 的两套液态玻璃实现",
          "建立单卡 OpenGL Shell、背景采样与圆肩折射结构",
          "优化移动端 WebGL Host 生命周期、按压动画和显存占用"
        ],
        stack: ["Kotlin", "Jetpack Compose", "OpenGL", "AGSL", "WebGL", "SDF"],
        next: "继续完成不同设备和分辨率下的真机验证，并锁定稳定视觉基线。"
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
        summary: "独立行情代理服务部署在 Render，通过 HTTP API 向客户端提供 A 股报价、分时、盘口、历史走势和榜单数据。系统负责字段标准化、缓存、预热和多数据源降级。",
        highlights: [
          "聚合主要指数、约 5000 只 A 股及行业板块数据",
          "支持报价、分时、五档盘口、逐笔成交和历史走势",
          "使用 fresh/stale cache 与动态 tick worker 控制延迟和请求量"
        ],
        stack: ["Python", "FastAPI", "Uvicorn", "HTTPX", "Eastmoney", "Render"],
        next: "继续完善数据源健康检查、冷启动体验和异常字段校验。"
      },
      {
        id: "gan-hemt",
        code: "GaN",
        colour: "cyan",
        category: "engineering",
        name: "GaN HEMT Simulation",
        subtitle: "增强型功率器件 TCAD 建模与参数扫描",
        status: "参数扫描",
        statusTone: "research",
        type: "半导体器件仿真",
        period: "2026.03 — 至今",
        role: "器件建模 / 数值求解 / 结果可视化",
        summary: "使用 Sentaurus 建立增强型 GaN HEMT 器件模型，研究漏极电压、栅压、结温与重离子 LET 对漏极电流和安全工作区的耦合影响，并输出 Id–Vd 曲线与 Tj–Vg 合格域。",
        highlights: [
          "完成器件结构、关键区域网格和基础物理模型配置",
          "建立分段 QuasiStationary、缩步与高场收敛排查流程",
          "生成不同 LET 和电流判据下的二维及三维工程图件"
        ],
        stack: ["Sentaurus", "TCAD", "GaN HEMT", "Heavy Ion", "MATLAB"],
        next: "完成高风险参数区复算、文献校核和正式报告图件。"
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
        summary: "整合全球 234Th 颗粒有机碳输出通量、卫星 NPP、Longhurst 生态省区和环境因子，建立 e-ratio 数据库并分析不同海区的主要控制机制。",
        highlights: [
          "数据库覆盖 1989—2023 年、超过 1000 个站位",
          "完成 Longhurst 省区匹配、机制分类和代表省区分析",
          "形成机制地图、证据得分热力图与分类复核矩阵"
        ],
        stack: ["Python", "R", "mgcv", "GAM/HGAM", "Remote Sensing", "Statistics"],
        next: "冻结 analysis-ready V2 数据库，补齐敏感性分析并推进 GBC 稿件。"
      }
    ],
    en: []
  };

  projectCatalog.en = projectCatalog.zh.map((project) => ({ ...project }));

  const labels = {
    zh: {
      heading: "PROJECTS.EXE / 项目",
      path: "C:\\YUCHEN\\PROJECTS",
      all: "全部",
      dev: "开发与设计",
      engineering: "工程与器件",
      research: "科研分析",
      selected: "已选择",
      overview: "项目概览",
      highlights: "关键工作",
      stack: "技术栈",
      next: "下一步",
      type: "类型",
      period: "周期",
      role: "职责",
      profile: "打开 GitHub 主页",
      privateNote: "部分仓库、数据与论文材料暂未公开。",
      empty: "此分类下暂无项目。"
    },
    en: {
      heading: "PROJECTS.EXE / PROJECTS",
      path: "C:\\YUCHEN\\PROJECTS",
      all: "ALL",
      dev: "DEV & DESIGN",
      engineering: "ENGINEERING",
      research: "RESEARCH",
      selected: "SELECTED",
      overview: "OVERVIEW",
      highlights: "KEY WORK",
      stack: "TECH STACK",
      next: "NEXT STEP",
      type: "TYPE",
      period: "PERIOD",
      role: "ROLE",
      profile: "OPEN GITHUB PROFILE",
      privateNote: "Some repositories, data and manuscript materials remain private.",
      empty: "NO PROJECTS IN THIS CATEGORY."
    }
  };

  function projectExplorerTemplate(lang) {
    const projects = projectCatalog[lang];
    const text = labels[lang];
    const projectCount = lang === "zh" ? `${projects.length} 个项目` : `${projects.length} PROJECTS`;

    return `
      <section class="projects-app" data-project-lang="${lang}">
        <header class="projects-header">
          <div>
            <h2 class="section-title projects-heading">${text.heading}</h2>
            <div class="projects-path"><span class="projects-drive">C:</span>${text.path.slice(2)}<span class="path-cursor"></span></div>
          </div>
          <div class="projects-counters" aria-label="Project summary"><span>${projectCount}</span></div>
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
      <div class="project-facts">${factCell(text.type, project.type)}${factCell(text.period, project.period)}${factCell(text.role, project.role)}</div>
      ${detailPanel(text.overview, `<p class="project-summary">${project.summary}</p>`)}
      ${detailPanel(text.highlights, detailList(project.highlights, "project-highlights"))}
      ${detailPanel(text.stack, `<div class="project-stack">${project.stack.map((item) => `<span>${item}</span>`).join("")}</div>`)}
      ${detailPanel(text.next, `<p class="project-next">${project.next}</p>`)}
      <div class="project-actions"><a class="retro-action" href="https://github.com/yuchenm1303-png" target="_blank" rel="noreferrer">${text.profile}</a></div>`;
  }

  function factCell(label, value) {
    return `<div class="project-fact"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function detailPanel(title, body) {
    return `<section class="inspector-panel"><h4>${title}</h4>${body}</section>`;
  }

  function detailList(items, className) {
    return `<ul class="project-detail-list ${className}">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
  }

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
      if (visibleRows.length && !visibleRows.some((row) => row.dataset.projectId === selectedId)) {
        showProject(visibleRows[0].dataset.projectId);
      }
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
