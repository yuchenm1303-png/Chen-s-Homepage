(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelProjectOverviewDetail) return;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const EDITORIAL_COPY = Object.freeze({
    'ai-ledger': {
      intro: '一个能聊天，也能在手机上动手做事的 Android AI 助手。',
      summary: '除了聊天，它还能调用搜索、行情、提醒等工具，并在需要时读取当前界面，通过无障碍服务完成简单操作。',
      type: 'Android AI 助手',
      role: 'Android / Agent',
      status: '持续开发',
      points: [
        '流式聊天与多模型切换',
        '搜索、行情、提醒等工具',
        '读取屏幕后执行手机操作',
        '原生 Compose + OpenGL 界面',
      ],
      work: [
        '原生 Android 客户端，支持流式聊天、多模型切换、记忆和工具调用。',
        '把搜索、天气、汇率、行情、提醒、账本和设备控制放进同一套工具系统。',
        '加入悬浮入口和屏幕操作能力，让助手可以跨应用完成简单任务。',
        '持续优化 OpenGL 玻璃界面、动画和真机性能。',
      ],
      implementation: [
        'Kotlin + Jetpack Compose 负责客户端和状态管理。',
        'Cloudflare Worker 负责模型路由、流式输出和工具协议。',
        '视觉模型负责判断下一步，无障碍服务只执行明确动作并回读结果。',
      ],
    },
    'listing-studio': {
      intro: '把一个供应商商品链接，变成可以检查后再执行的 Makro 上架任务。',
      summary: '输入 1688 或供应商链接后，程序会整理商品信息和缺失字段，先生成上架草稿；确认无误后，再由受控 Edge 写入 Makro Seller Center。',
      type: 'Windows 电商工具',
      role: '产品 / Python / 自动化',
      status: '持续开发',
      points: [
        '输入一个商品链接',
        '自动整理规格与图片',
        '先审阅草稿，再写入后台',
        '支持单商品和批量任务',
      ],
      work: [
        '单个和批量商品都能在同一个桌面工作台里处理。',
        '浏览器登录状态可复用，失败任务可以恢复，不必每次从头开始。',
        '上架前先给出只读填写方案；价格、库存等经营字段不会被程序擅自补写。',
        'Windows 安装包、自更新、下载授权和运行诊断已经接入。',
      ],
      implementation: [
        '先读取 Makro 当前页面的真实字段，再决定要填什么，不依赖固定表单模板。',
        '供应商页面的文字、规格、SKU 和图片先原样保存，再交给模型做字段理解。',
        '写入后重新读取页面确认结果；异常时保留现场，方便继续处理。',
      ],
    },
    'computer-use': {
      intro: '让手机自动化根据眼前的界面做决定，而不是照着固定脚本走。',
      summary: '系统持续读取当前屏幕，让视觉模型决定下一步，再交给 Android 无障碍服务执行；每一步之后都会重新确认界面。',
      type: 'Android 自动化',
      role: 'Android / Agent',
      status: '持续开发',
      points: [
        '截图后判断下一步动作',
        '点击、输入、滑动与返回',
        '每一步执行后重新确认',
        '关键操作保留人工确认',
      ],
      work: [
        '完成截图、判断、点击、输入、滑动和结果确认的完整循环。',
        '处理弹窗、键盘、加载层和短暂遮挡等常见中断。',
        '把模型输出限制成明确动作，避免直接执行含糊指令。',
        '对交易等不可逆操作保留人工确认。',
      ],
      implementation: [
        'VisualLoopRunner 管理每一轮截图、超时和任务结束条件。',
        '视觉模型只负责规划；AccessibilityService 和设备命令负责实际操作。',
        '会话状态记录上一步动作和结果，便于失败恢复和继续执行。',
      ],
    },
    'liquid-glass': {
      intro: '把网页里的液态玻璃效果迁到原生 Android，同时把性能控制住。',
      summary: '保留折射、边缘高光、暗核和按压反馈，并把界面迁到 Jetpack Compose；高版本走 Shader，旧版本使用更轻的降级方案。',
      type: 'Android UI / 渲染',
      role: '设计 / Compose / 性能',
      status: '迭代中',
      points: [
        'WebView 迁到原生 Compose',
        '统一背景采样减少重复模糊',
        'AGSL 实现折射与边缘效果',
        '不同 Android 版本可降级',
      ],
      work: [
        '把主要页面和交互从 WebView 迁到原生 Compose。',
        '统一背景采样，减少多个玻璃组件重复模糊同一帧。',
        '实现边缘折射、暗核、高光、焦散和按压回弹。',
        '针对不同 Android 版本保留可控的降级路径。',
      ],
      implementation: [
        'Compose 负责布局和交互，AGSL RuntimeShader 负责高版本玻璃效果。',
        'Backdrop 缓存全屏模糊结果，各组件只读取自己的区域。',
        '旧版本减少实时 Shader 和重复采样，优先保证交互稳定。',
      ],
    },
    'stock-crawler': {
      intro: '给 App 提供统一的 A 股行情接口，不让手机自己抓网页。',
      summary: '这是一个独立部署的 FastAPI 服务，把多个公开行情源整理成同一套接口，并用缓存和备用数据源处理上游波动。',
      type: 'A 股数据服务',
      role: '后端 / 数据源 / 缓存',
      status: '运行中',
      points: [
        '指数、个股与板块统一接口',
        '分时、盘口与历史走势',
        '最近查看股票提高刷新频率',
        '缓存与备用数据源降级',
      ],
      work: [
        '统一主要指数、约 5000 只 A 股和板块数据的字段格式。',
        '提供报价、分时、盘口、逐笔、历史走势和集合竞价接口。',
        '只对最近查看的股票提高刷新频率，避免无意义的全市场高频请求。',
        '用 fresh / stale 两级缓存减轻冷启动和上游故障影响。',
      ],
      implementation: [
        'FastAPI + HTTPX 负责 API、并发请求、超时和重试。',
        '东方财富作为主要数据源，腾讯和 TDX 在部分场景下补位。',
        '后台预热常用数据，Render 冷启动后自动恢复。',
      ],
    },
    'gan-hemt': {
      intro: '用 Sentaurus 看 GaN HEMT 在高压、温度和重离子条件下会发生什么。',
      summary: '扫描漏极电压、栅压、结温和 LET，记录器件电流与收敛情况，再把结果整理成 Id–Vd 曲线和安全工作区。',
      type: 'GaN HEMT 仿真',
      role: '建模 / 求解 / 可视化',
      status: '仿真中',
      points: [
        '器件结构与高场区域加密',
        'Vd / Vg / 温度 / LET 联合扫描',
        '异常曲线与收敛问题复算',
        '输出安全工作区和工程图',
      ],
      work: [
        '建立器件结构、网格和主要物理模型，并重点加密高场区域。',
        '扫描 Vd、Vg、温度和 LET，记录收敛与异常结果。',
        '针对 Newton 不收敛和伪曲线调整步长、模型和求解设置。',
        '按电流限值生成可直接比较的安全域图。',
      ],
      implementation: [
        'Sentaurus SDE 负责结构与网格，Sentaurus Device 负责数值求解。',
        '高风险参数区使用更小步长和更高数值精度复算。',
        'MATLAB / Python 只负责后处理和作图，不改变原始仿真关系。',
      ],
    },
  });

  const listMarkup = (items, className) => (
    `<ul class="${className}">${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
  );

  const section = (label, body, extraClass = '') => `
    <section class="project-detail-section ${extraClass}">
      <h3 class="project-detail-section-label">${escapeHtml(label)}</h3>
      <div class="project-detail-section-body">${body}</div>
    </section>
  `;

  const detailFactsMarkup = (detail) => [
    ['类型', detail.type],
    ['时间', detail.period],
    ['负责', detail.role],
    ['状态', detail.status],
  ].map(([label, value]) => `
    <div class="project-detail-fact">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('');

  const progressMarkup = (stages) => `
    <ol class="project-detail-progress">
      ${(stages || []).map(([item, state], index) => {
        const stateLabel = state === 'done' ? '已完成' : state === 'active' ? '进行中' : '下一步';
        return `
          <li class="is-${escapeHtml(state)}">
            <span>${String(index + 1).padStart(2, '0')}</span>
            <p>${escapeHtml(item)}</p>
            <b>${stateLabel}</b>
          </li>
        `;
      }).join('')}
    </ol>
  `;

  function detailedMarkup(object, copy) {
    const detail = object.projectDetail;
    const stack = (detail.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
    const links = (object.links || []).map((link) => (
      `<a class="project-detail-link" href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)} ↗</a>`
    )).join('');

    return `
      <div class="project-detail-document">
        <button class="project-detail-close" type="button" data-project-detail-close>← 返回项目概览</button>

        <header class="project-detail-intro">
          <p class="project-detail-kicker">项目详情</p>
          <h2>${escapeHtml(copy.intro)}</h2>
          <p>${escapeHtml(detail.summary || copy.summary)}</p>
          <div class="project-detail-facts">${detailFactsMarkup(detail)}</div>
        </header>

        <div class="project-detail-two-column">
          ${section('我做了什么', listMarkup(copy.work, 'project-detail-list'))}
          ${section('实现方式', listMarkup(copy.implementation, 'project-detail-list'))}
        </div>

        ${section('系统结构', listMarkup(detail.architecture, 'project-detail-numbered'))}

        <div class="project-detail-two-column">
          ${section('主要工作', listMarkup(detail.highlights, 'project-detail-list'))}
          ${section('难点', listMarkup(detail.challenges, 'project-detail-list'))}
        </div>

        ${section('产出', listMarkup(detail.outputs, 'project-detail-output'))}

        ${section('技术栈', `<div class="project-detail-stack">${stack}</div>`)}

        ${section('进度', progressMarkup(detail.stages))}

        ${section('接下来', `<p class="project-detail-next">${escapeHtml(detail.next || '')}</p>${links ? `<div class="project-detail-links">${links}</div>` : ''}`)}
      </div>
    `;
  }

  function projectMarkup(object) {
    const detail = object.projectDetail;
    if (!detail) return '';

    const copy = EDITORIAL_COPY[object.id] || {
      intro: object.lede || object.title || '',
      summary: detail.summary || '',
      type: detail.type || '项目',
      role: detail.role || '',
      status: detail.status || '',
      points: (detail.highlights || []).slice(0, 4),
      work: detail.highlights || [],
      implementation: detail.architecture || [],
    };

    const overviewFacts = [
      ['类型', copy.type],
      ['时间', detail.period],
      ['我负责', copy.role],
      ['状态', copy.status],
    ].map(([label, value]) => `
      <div class="project-overview-fact">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join('');

    const points = (copy.points || []).slice(0, 4).map((item) => `
      <li>${escapeHtml(item)}</li>
    `).join('');

    return `
      <article class="project-view">
        <section class="project-overview" aria-label="项目概览">
          <p class="project-overview-kicker">项目概览</p>
          <h2 class="project-overview-thesis">${escapeHtml(copy.intro)}</h2>
          <p class="project-overview-summary">${escapeHtml(copy.summary)}</p>

          <div class="project-overview-facts">${overviewFacts}</div>

          <ul class="project-overview-points">${points}</ul>

          <button class="project-overview-more" type="button" data-project-detail-open aria-expanded="false">
            <span>查看更多详情</span><b aria-hidden="true">↗</b>
          </button>
        </section>

        <section class="project-detail-overlay" data-project-detail-overlay hidden aria-hidden="true">
          ${detailedMarkup(object, copy)}
        </section>
      </article>
    `;
  }

  const overviewInstall = function installProjectOverviewDetail(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const shell = document.querySelector('.star-detail-shell');
    const main = shell?.querySelector('.star-detail-main');
    let renderedId = null;

    const closeExpandedDetail = () => {
      if (!shell || !main) return;
      const overlay = main.querySelector('[data-project-detail-overlay]');
      const openButton = main.querySelector('[data-project-detail-open]');
      if (!overlay || overlay.hidden) return;

      shell.classList.remove('project-detail-expanded');
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      openButton?.setAttribute('aria-expanded', 'false');
      openButton?.focus({ preventScroll: true });
    };

    const bindDetailControls = () => {
      if (!shell || !main) return;
      const openButton = main.querySelector('[data-project-detail-open]');
      const closeButton = main.querySelector('[data-project-detail-close]');
      const overlay = main.querySelector('[data-project-detail-overlay]');
      if (!openButton || !closeButton || !overlay) return;

      openButton.addEventListener('click', () => {
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        overlay.scrollTop = 0;
        shell.classList.add('project-detail-expanded');
        openButton.setAttribute('aria-expanded', 'true');
        closeButton.focus({ preventScroll: true });
      });

      closeButton.addEventListener('click', closeExpandedDetail);
    };

    const renderIfNeeded = () => {
      if (!shell || !main || shell.dataset.starKind !== 'project') {
        shell?.classList.remove('project-detail-expanded');
        renderedId = null;
        return;
      }

      const id = shell.dataset.starId || '';
      if (!id || renderedId === id) return;
      const object = (window.__SMIREL_STELLAR_CATALOG__ || []).find((item) => item.id === id);
      if (!object?.projectDetail) return;

      shell.classList.remove('project-detail-expanded');
      main.innerHTML = projectMarkup(object);
      bindDetailControls();
      renderedId = id;
    };

    const baseUpdate = controller.update.bind(controller);
    controller.update = (...args) => {
      const ownsCamera = baseUpdate(...args);
      renderIfNeeded();
      return ownsCamera;
    };

    return controller;
  };

  overviewInstall.__smirelProjectOverviewDetail = true;
  window[INSTALL_KEY] = overviewInstall;
})();
