(() => {
  const projectCatalog = {
    zh: [
      {
        id: "ai-agent",
        code: "AI",
        colour: "pink",
        category: "dev",
        name: "AI Agent / Android App",
        subtitle: "手机端视觉智能体与界面自动化",
        status: "开发中",
        statusTone: "active",
        type: "应用开发",
        period: "2026.06 — 至今",
        role: "独立设计 / Android 开发",
        summary: "围绕 Android 无障碍服务、视觉理解与大模型决策链路，构建能够观察屏幕、理解任务并执行界面操作的手机端智能体。项目同时包含悬浮窗、HUD、截图反馈和运行状态管理。",
        highlights: [
          "搭建“视觉理解 → 决策 → 无障碍执行”的完整主链路",
          "持续优化浮窗 HUD、截图反馈、边缘光和交互状态",
          "围绕模型切换、视觉工具调用与会话状态排查稳定性"
        ],
        stack: ["Kotlin", "Android", "Accessibility", "LLM", "Vision", "Agent"],
        stages: [
          ["界面与浮窗系统", "done"],
          ["视觉智能体主链路", "active"],
          ["稳定性验证与展示整理", "todo"]
        ],
        next: "完成纯净模型链路的稳定性验证，并整理可公开展示的演示流程与技术说明。"
      },
      {
        id: "gan-hemt",
        code: "GaN",
        colour: "cyan",
        category: "engineering",
        name: "GaN HEMT Simulation",
        subtitle: "增强型功率器件 TCAD 建模与扫描",
        status: "科研验证",
        statusTone: "research",
        type: "半导体仿真",
        period: "2026.07 — 至今",
        role: "器件建模 / 参数扫描",
        summary: "使用 Sentaurus 建立增强型 GaN HEMT 器件模型，研究栅压、结温和重离子 LET 对器件漏极电流及安全工作区的影响，并将仿真结果整理成工程化二维、三维判据图。",
        highlights: [
          "完成器件结构、网格、物理模型和分段准静态求解设置",
          "开展 −50 至 150 ℃、多栅压与多 LET 条件参数扫描",
          "围绕电流限值构建 Tj–Vg 合格域和可视化判据"
        ],
        stack: ["Sentaurus", "TCAD", "GaN", "Heavy Ion", "MATLAB", "Physics"],
        stages: [
          ["器件结构与物理模型", "done"],
          ["温度 / 栅压 / LET 扫描", "active"],
          ["结果校核与论文图件", "todo"]
        ],
        next: "继续校核高温和高 LET 区域的数值收敛性，并统一输出专业白底结果图。"
      },
      {
        id: "cradle-dynamics",
        code: "MAT",
        colour: "violet",
        category: "engineering",
        name: "Cradle–Pendulum Dynamics",
        subtitle: "摇篮—摆架—工作台耦合动力学",
        status: "建模中",
        statusTone: "active",
        type: "工程动力学",
        period: "2026.07 — 至今",
        role: "系统建模 / MATLAB",
        summary: "针对壳体、摆架、工作台、心轴和轴承组成的耦合系统，完成质量、阻尼、刚度矩阵装配，提取约束模态，并逐步加入赫兹接触和刹车扭转刚度等非线性因素。",
        highlights: [
          "完成左右壳体、摆架、工作台与刚性区的全局自由度规划",
          "建立罚函数 MPC、偏置刚性连接及受约束模态求解流程",
          "准备使用 Newmark 法接入轴承非线性恢复力"
        ],
        stack: ["MATLAB", "FEM", "Newmark", "Modal", "MPC", "Hertz Contact"],
        stages: [
          ["线性矩阵装配与模态", "done"],
          ["非线性轴承力接入", "active"],
          ["时域响应与实验对照", "todo"]
        ],
        next: "完成非线性恢复力接口与时域积分验证，重点检查工作台 Z 向显著峰。"
      },
      {
        id: "ocean-eratio",
        code: "POC",
        colour: "gold",
        category: "research",
        name: "Global Ocean e-ratio Research",
        subtitle: "全球海洋颗粒碳输出效率机制研究",
        status: "论文推进",
        statusTone: "paper",
        type: "科研数据分析",
        period: "2025.10 — 至今",
        role: "数据库 / 统计分析",
        summary: "整合全球 234Th 颗粒有机碳输出通量、卫星 NPP、Longhurst 生态省区和环境因子，建立 e-ratio 数据库，并对不同海区的物理注入、上升流和食物网机制进行分类与机制链分析。",
        highlights: [
          "完成 2003—2023 年站位数据整合、NPP 匹配和省区归属",
          "建立五类机制分类、证据得分热力图和人工复核矩阵",
          "围绕 GBC 投稿标准持续优化代表省区图和统计模型"
        ],
        stack: ["Python", "R", "GAM", "Remote Sensing", "Longhurst", "Statistics"],
        stages: [
          ["数据库清洗与变量匹配", "done"],
          ["机制分类与代表省区分析", "done"],
          ["图件优化与论文写作", "active"]
        ],
        next: "锁定 analysis-ready V2 数据库，并完成主文图件、敏感性分析和方法部分写作。"
      }
    ],
    en: [
      {
        id: "ai-agent",
        code: "AI",
        colour: "pink",
        category: "dev",
        name: "AI Agent / Android App",
        subtitle: "Phone-side visual agent and UI automation",
        status: "ACTIVE",
        statusTone: "active",
        type: "Application Development",
        period: "2026.06 — Present",
        role: "Independent Design / Android",
        summary: "An Android visual agent built around accessibility services, screen understanding and LLM decision-making. The system observes the interface, plans actions and executes them while maintaining HUD, overlay, screenshot feedback and session state.",
        highlights: [
          "Built the full vision → reasoning → accessibility execution pipeline",
          "Designed the floating HUD, screenshot feedback and persistent edge lighting",
          "Investigated model switching, visual tool calls and session stability"
        ],
        stack: ["Kotlin", "Android", "Accessibility", "LLM", "Vision", "Agent"],
        stages: [
          ["Overlay and HUD system", "done"],
          ["Core visual-agent pipeline", "active"],
          ["Stability validation and demo", "todo"]
        ],
        next: "Validate the clean model pipeline and prepare a public demonstration with technical notes."
      },
      {
        id: "gan-hemt",
        code: "GaN",
        colour: "cyan",
        category: "engineering",
        name: "GaN HEMT Simulation",
        subtitle: "TCAD modelling and operating-domain sweeps",
        status: "RESEARCH",
        statusTone: "research",
        type: "Semiconductor Simulation",
        period: "2026.07 — Present",
        role: "Device Modelling / Sweeps",
        summary: "A Sentaurus model of enhancement-mode GaN HEMTs used to study gate voltage, junction temperature and heavy-ion LET effects on drain current and safe operating regions, with engineering-oriented 2D and 3D result maps.",
        highlights: [
          "Configured device geometry, mesh, physics and segmented quasi-stationary solves",
          "Swept temperature, gate voltage and multiple LET conditions",
          "Built Tj–Vg qualification domains around current-limit criteria"
        ],
        stack: ["Sentaurus", "TCAD", "GaN", "Heavy Ion", "MATLAB", "Physics"],
        stages: [
          ["Device and physics model", "done"],
          ["Temperature / Vg / LET sweep", "active"],
          ["Validation and publication figures", "todo"]
        ],
        next: "Validate convergence in high-temperature and high-LET regions and standardise the final white-background figures."
      },
      {
        id: "cradle-dynamics",
        code: "MAT",
        colour: "violet",
        category: "engineering",
        name: "Cradle–Pendulum Dynamics",
        subtitle: "Coupled cradle, pendulum and worktable dynamics",
        status: "MODELLING",
        statusTone: "active",
        type: "Engineering Dynamics",
        period: "2026.07 — Present",
        role: "System Modelling / MATLAB",
        summary: "A coupled structural model of shells, pendulum frames, worktable, spindles and bearings. The work covers global mass, damping and stiffness assembly, constrained modes, and the gradual introduction of Hertzian contact and brake torsional stiffness.",
        highlights: [
          "Defined the global DOF layout for shells, pendulum, worktable and rigid regions",
          "Implemented penalty MPC, offset rigid links and constrained modal analysis",
          "Prepared a Newmark workflow for nonlinear bearing restoring forces"
        ],
        stack: ["MATLAB", "FEM", "Newmark", "Modal", "MPC", "Hertz Contact"],
        stages: [
          ["Linear assembly and modes", "done"],
          ["Nonlinear bearing-force coupling", "active"],
          ["Time response and validation", "todo"]
        ],
        next: "Complete nonlinear force coupling and verify the worktable Z-direction response peaks."
      },
      {
        id: "ocean-eratio",
        code: "POC",
        colour: "gold",
        category: "research",
        name: "Global Ocean e-ratio Research",
        subtitle: "Mechanisms of global particulate-carbon export efficiency",
        status: "PAPER",
        statusTone: "paper",
        type: "Research Data Analysis",
        period: "2025.10 — Present",
        role: "Database / Statistics",
        summary: "A global database combining 234Th-derived POC export, satellite NPP, Longhurst provinces and environmental variables to classify physical injection, upwelling and food-web mechanisms across ocean regions.",
        highlights: [
          "Integrated 2003–2023 station data, NPP matching and province attribution",
          "Built five mechanism classes, evidence-score heatmaps and a review matrix",
          "Refined representative-province figures and models for a GBC manuscript"
        ],
        stack: ["Python", "R", "GAM", "Remote Sensing", "Longhurst", "Statistics"],
        stages: [
          ["Database cleaning and matching", "done"],
          ["Mechanism classification", "done"],
          ["Figures and manuscript", "active"]
        ],
        next: "Freeze the analysis-ready V2 database and complete main figures, sensitivity analyses and methods writing."
      }
    ]
  };

  const labels = {
    zh: {
      heading: "PROJECTS.EXE / 项目管理器",
      path: "C:\\YUCHEN\\PROJECTS",
      all: "全部",
      dev: "应用开发",
      engineering: "工程建模",
      research: "科研分析",
      files: "4 个项目",
      active: "3 个进行中",
      selected: "已选择",
      overview: "项目概览",
      highlights: "关键工作",
      stack: "技术栈",
      roadmap: "当前进度",
      next: "下一步",
      type: "类型",
      period: "周期",
      role: "职责",
      status: "状态",
      profile: "打开 GitHub 主页",
      privateNote: "部分项目仍在开发或论文阶段，公开仓库与完整材料会逐步整理。",
      empty: "此分类下暂无项目。"
    },
    en: {
      heading: "PROJECTS.EXE / PROJECT MANAGER",
      path: "C:\\YUCHEN\\PROJECTS",
      all: "ALL",
      dev: "APP DEV",
      engineering: "ENGINEERING",
      research: "RESEARCH",
      files: "4 PROJECTS",
      active: "3 ACTIVE",
      selected: "SELECTED",
      overview: "OVERVIEW",
      highlights: "KEY WORK",
      stack: "TECH STACK",
      roadmap: "PROGRESS",
      next: "NEXT STEP",
      type: "TYPE",
      period: "PERIOD",
      role: "ROLE",
      status: "STATUS",
      profile: "OPEN GITHUB PROFILE",
      privateNote: "Some repositories and full materials remain private while development and manuscript work continue.",
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
          <div class="projects-counters" aria-label="Project summary">
            <span>${text.files}</span>
            <span>${text.active}</span>
          </div>
        </header>

        <div class="project-toolbar" role="toolbar" aria-label="Project filters">
          ${filterButton("all", text.all, true)}
          ${filterButton("dev", text.dev)}
          ${filterButton("engineering", text.engineering)}
          ${filterButton("research", text.research)}
        </div>

        <div class="project-explorer">
          <div class="project-browser" aria-label="Project list">
            <div class="project-browser-head">
              <span>NAME</span>
              <span>STATUS</span>
            </div>
            <div class="project-rows">
              ${projects.map((project, index) => projectRow(project, index === 0)).join("")}
            </div>
            <div class="project-empty" hidden>${text.empty}</div>
          </div>
          <article class="project-inspector" id="projectInspector" aria-live="polite"></article>
        </div>

        <footer class="projects-footer">
          <span><i class="projects-led"></i>${text.selected}: <strong data-selected-project>${projects[0].name}</strong></span>
          <span>${text.privateNote}</span>
        </footer>
      </section>
    `;
  }

  function filterButton(filter, label, active = false) {
    return `<button class="project-filter${active ? " is-active" : ""}" type="button" data-project-filter="${filter}">${label}</button>`;
  }

  function projectRow(project, selected) {
    return `
      <button class="project-row${selected ? " is-selected" : ""}" type="button"
        data-project-id="${project.id}" data-project-category="${project.category}" aria-pressed="${selected}">
        <span class="project-row-icon project-colour-${project.colour}">${project.code}</span>
        <span class="project-row-copy">
          <strong>${project.name}</strong>
          <small>${project.subtitle}</small>
        </span>
        <span class="project-row-status tone-${project.statusTone}"><i></i>${project.status}</span>
      </button>
    `;
  }

  function inspectorTemplate(project, lang) {
    const text = labels[lang];
    return `
      <div class="inspector-titlebar">
        <span class="inspector-icon project-colour-${project.colour}">${project.code}</span>
        <div>
          <h3>${project.name}</h3>
          <p>${project.subtitle}</p>
        </div>
        <span class="inspector-status tone-${project.statusTone}">${project.status}</span>
      </div>

      <div class="inspector-file">README.TXT — ${project.id.toUpperCase()}</div>

      <div class="project-facts">
        ${factCell(text.type, project.type)}
        ${factCell(text.period, project.period)}
        ${factCell(text.role, project.role)}
        ${factCell(text.status, project.status)}
      </div>

      ${detailPanel(text.overview, `<p class="project-summary">${project.summary}</p>`)}
      ${detailPanel(text.highlights, `<ul class="project-highlights">${project.highlights.map((item) => `<li>${item}</li>`).join("")}</ul>`)}
      ${detailPanel(text.stack, `<div class="project-stack">${project.stack.map((item) => `<span>${item}</span>`).join("")}</div>`)}
      ${detailPanel(text.roadmap, `<ol class="project-roadmap">${project.stages.map(([item, status]) => `<li class="roadmap-${status}"><i></i><span>${item}</span><b>${status === "done" ? "OK" : status === "active" ? "RUN" : "..."}</b></li>`).join("")}</ol>`)}
      ${detailPanel(text.next, `<p class="project-next">${project.next}</p>`)}

      <div class="project-actions">
        <a class="retro-action" href="https://github.com/yuchenm1303-png" target="_blank" rel="noreferrer">${text.profile}</a>
      </div>
    `;
  }

  function factCell(label, value) {
    return `<div class="project-fact"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function detailPanel(title, body) {
    return `<section class="inspector-panel"><h4>${title}</h4>${body}</section>`;
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
    let activeFilter = "all";

    const showProject = (id) => {
      const project = projects.find((item) => item.id === id);
      if (!project) return;
      selectedId = id;
      inspector.classList.remove("inspector-refresh");
      void inspector.offsetWidth;
      inspector.innerHTML = inspectorTemplate(project, lang);
      inspector.classList.add("inspector-refresh");
      selectedLabel.textContent = project.name;
      rows.forEach((row) => {
        const selected = row.dataset.projectId === id;
        row.classList.toggle("is-selected", selected);
        row.setAttribute("aria-pressed", String(selected));
      });
    };

    const applyFilter = (filter) => {
      activeFilter = filter;
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

    rows.forEach((row) => {
      row.addEventListener("click", () => showProject(row.dataset.projectId));
    });

    filters.forEach((button) => {
      button.addEventListener("click", () => applyFilter(button.dataset.projectFilter));
    });

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

    applyFilter(activeFilter);
    showProject(selectedId);
  }
})();
