(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelReadableProjectDetail) return;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const EDITORIAL_COPY = Object.freeze({
    'ai-ledger': {
      intro: '一个在 Android 上长期迭代的个人 AI 助手。',
      summary: '我从 2026 年 3 月开始做这个项目。它以聊天为入口，也能调用搜索、行情、提醒和设备能力；在需要操作手机时，会读取当前界面，再通过无障碍服务完成点击、输入和返回等动作。',
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
      intro: '把供应商商品链接整理成可检查、可执行的 Makro 上架任务。',
      summary: '这是我为 Makro Seller Center 做的一套 Windows 桌面工具。输入 1688 或供应商链接后，它会抓取商品信息、整理缺失字段，先生成一份可检查的填写方案，再打开受控 Edge 完成表单和图片；最后提交仍交给人工确认。',
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
      intro: '让手机自动化根据当前界面做决定，而不是照着固定脚本走。',
      summary: '项目会持续读取屏幕，让视觉模型判断下一步，再把动作交给 Android 无障碍服务执行。每一步之后都会重新截图确认，因此弹窗、键盘或页面变化出现时，流程可以根据现场继续。',
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
      intro: '把网页里的液态玻璃视觉迁到原生 Android，而不是重新画一套近似版。',
      summary: '这个项目主要解决两个问题：一是保留原网页的透明材质、折射和按压反馈，二是在手机上把 GPU 开销控制住。现在核心界面已经转到 Jetpack Compose，并保留 Android 13+ 的 Shader 路径和低版本降级方案。',
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
      intro: '给 App 提供稳定、统一的 A 股行情数据，而不是让手机自己抓网页。',
      summary: '这是一个独立部署的 FastAPI 服务。它把多个公开行情源整理成统一接口，提供指数、个股、分时、盘口、历史走势和集合竞价数据，并用缓存和备用数据源处理上游波动。',
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
      intro: '用 Sentaurus 做增强型 GaN HEMT 的高压、温度和重离子联合扫描。',
      summary: '项目关注漏极电压、栅压、结温和 LET 共同变化时的器件电流与安全工作区。除了 Id–Vd 曲线，还会把结果整理成 Tj–Vg 合格域和二维、三维工程图，用于后续报告和校核。',
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

  const listMarkup = (items, className, numbered = false) => {
    const tag = numbered ? 'ol' : 'ul';
    return `<${tag} class="${className}">${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`;
  };

  const section = (label, body, extraClass = '') => `
    <section class="project-archive-section ${extraClass}">
      <h3 class="project-archive-label">${escapeHtml(label)}</h3>
      <div class="project-archive-section-body">${body}</div>
    </section>
  `;

  function projectMarkup(object) {
    const detail = object.projectDetail;
    if (!detail) return '';

    const copy = EDITORIAL_COPY[object.id] || {
      intro: object.lede || object.title || '',
      summary: detail.summary || '',
      work: detail.highlights || [],
      implementation: detail.architecture || [],
    };

    const facts = [
      ['类型', detail.type],
      ['时间', detail.period],
      ['负责', detail.role],
      ['状态', detail.status],
    ].map(([label, value]) => `
      <div class="project-archive-fact">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join('');

    const stack = (detail.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
    const links = (object.links || []).map((link) => (
      `<a class="project-archive-link" href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)} ↗</a>`
    )).join('');

    return `
      <article class="project-archive">
        <section class="project-archive-intro">
          <p class="project-archive-eyebrow">项目简介</p>
          <h2 class="project-archive-thesis">${escapeHtml(copy.intro)}</h2>
          <p class="project-archive-summary">${escapeHtml(copy.summary)}</p>
          <div class="project-archive-facts">${facts}</div>
        </section>

        <div class="project-archive-columns">
          ${section('做了什么', listMarkup(copy.work, 'project-archive-list'))}
          ${section('怎么实现', listMarkup(copy.implementation, 'project-architecture-list', true))}
        </div>

        <footer class="project-archive-footer">
          <div class="project-stack-list" aria-label="技术栈">${stack}</div>
          ${links ? `<div class="project-archive-links">${links}</div>` : ''}
        </footer>
      </article>
    `;
  }

  const readableInstall = function installReadableProjectDetail(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const shell = document.querySelector('.star-detail-shell');
    const main = shell?.querySelector('.star-detail-main');
    let renderedId = null;

    const renderIfNeeded = () => {
      if (!shell || !main || shell.dataset.starKind !== 'project') {
        renderedId = null;
        return;
      }

      const id = shell.dataset.starId || '';
      if (!id || renderedId === id) return;
      const object = (window.__SMIREL_STELLAR_CATALOG__ || []).find((item) => item.id === id);
      if (!object?.projectDetail) return;

      main.innerHTML = projectMarkup(object);
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

  readableInstall.__smirelReadableProjectDetail = true;
  window[INSTALL_KEY] = readableInstall;
})();
