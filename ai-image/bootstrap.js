(() => {
  const root = document.documentElement;
  const SUPPORTED_MODES = ['studio', 'lock', 'legacy'];
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('mode');
  let currentMode = SUPPORTED_MODES.includes(requested) ? requested : 'studio';
  let studioRuntimeState = 'idle';

  root.dataset.imageMode = currentMode;

  function ensureStylesheet(id, href) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  ensureStylesheet('modeRouterStyles', './mode-router.css?v=20260903-router-1');
  ensureStylesheet('studioWorkbenchPanelStyles', './studio-workbench-panel.css?v=20260903-solid-panel-1');

  document.querySelectorAll('.studio-sidebar, .studio-plan-panel').forEach((panel) => {
    panel.classList.remove('cards', 'studio-beach-glass-card');
    panel.classList.add('studio-workbench-panel');
  });

  const noteTitle = document.querySelector('.engine-note strong');
  const eyebrow = document.querySelector('.eyebrow');
  const heroTitle = document.querySelector('.hero h1');
  const heroCopy = document.querySelector('.hero-copy');
  const heroChips = [...document.querySelectorAll('.hero-chips span')];
  const imageFieldTitle = document.querySelector('#imageFieldTitle');
  const imageFieldHint = document.querySelector('#imageFieldHint');
  const promptFieldTitle = document.querySelector('#promptFieldTitle');
  const promptInput = document.querySelector('#promptInput');
  const featureCards = [...document.querySelectorAll('.feature-card')];
  const engineState = document.querySelector('#engineState');
  const engineNoteText = document.querySelector('#engineNoteText');
  const modeSwitch = document.querySelector('.mode-switch');

  const setChip = (index, text) => { if (heroChips[index]) heroChips[index].textContent = text; };
  const setFeature = (index, title, copy) => {
    const card = featureCards[index];
    if (!card) return;
    const strong = card.querySelector('strong');
    const paragraph = card.querySelector('p');
    if (strong) strong.textContent = title;
    if (paragraph) paragraph.textContent = copy;
  };

  function setShellStatus(offline, label, note = '') {
    if (engineState) {
      engineState.classList.toggle('is-offline', Boolean(offline));
      const labelNode = engineState.querySelector('span');
      if (labelNode) labelNode.textContent = label;
    }
    if (engineNoteText && note) engineNoteText.textContent = note;
  }

  function applyModeCopy(mode) {
    if (mode === 'legacy') {
      document.title = '旧版 AI 图生图 · Smirel';
      if (eyebrow) eyebrow.textContent = 'LEGACY IMAGE-TO-IMAGE';
      if (heroTitle) heroTitle.textContent = '旧版 AI 图生图';
      if (noteTitle) noteTitle.textContent = 'MiniMax Image-01 · 旧版参考图';
      if (heroCopy) heroCopy.textContent = '把商品参考图交给 MiniMax 重新生成，方便与商品锁定和电商工作台随时对比。';
      if (imageFieldTitle) imageFieldTitle.textContent = '商品参考图';
      if (imageFieldHint) imageFieldHint.textContent = '可选';
      if (promptFieldTitle) promptFieldTitle.textContent = '商品与场景描述';
      if (promptInput) promptInput.placeholder = '例如：白色香水瓶，放在浅灰色石材台面上，柔和侧光，高级商业摄影，干净背景';
      setChip(0, '参考图重绘'); setChip(1, 'MiniMax'); setChip(2, '旧版保留');
      setFeature(0, '参考图生成', '把图片作为 MiniMax 的视觉参考，适合需要 AI 重新设计或重绘主体的场景。');
      setFeature(1, '快速试风格', '直接输入商品与场景描述，快速比较不同风格和比例。');
      setFeature(2, '与新版并存', '旧链路没有删除，需要时可以随时切回进行效果对比。');
      return;
    }

    if (mode === 'lock') {
      document.title = 'AI 商品锁定 · Smirel';
      if (eyebrow) eyebrow.textContent = 'PRODUCT PIXEL LOCK';
      if (heroTitle) heroTitle.textContent = 'AI 商品锁定';
      if (noteTitle) noteTitle.textContent = '商品锁定 · MiniMax Background';
      if (heroCopy) heroCopy.textContent = '上传真实商品图，本地自动抠出并锁定商品像素；AI 只生成背景，再自动合成商业场景图。';
      if (imageFieldTitle) imageFieldTitle.textContent = '商品原图';
      if (imageFieldHint) imageFieldHint.textContent = '商品锁定模式必选';
      if (promptFieldTitle) promptFieldTitle.textContent = '场景描述';
      setChip(0, '商品锁定'); setChip(1, 'AI 场景'); setChip(2, '多尺寸');
      setFeature(0, '锁定真实商品', '商品在浏览器本地抠图，生成时不交给 AI 重新绘制。');
      setFeature(1, 'AI 只做场景', 'MiniMax 生成留有商品摆放区域的背景，再与真实商品自动合成。');
      setFeature(2, '旧版随时保留', '需要对比时可一键切换回原来的 MiniMax 参考图重绘流程。');
      return;
    }

    document.title = 'AI 电商视觉工作台 · Smirel';
    if (eyebrow) eyebrow.textContent = 'AI ECOMMERCE VISUAL WORKSPACE';
    if (heroTitle) heroTitle.textContent = 'AI 电商视觉工作台';
    if (noteTitle) noteTitle.textContent = '智能一致性 · 套图生产线';
    if (heroCopy) heroCopy.textContent = '上传商品图即可开始。默认直接用完整商品参考图生成，不要求抠图；只有需要更强商品保护时才启用严格像素锁定。';
    setChip(0, '无需抠图'); setChip(1, '任务计划'); setChip(2, '逐图 QA');
    setFeature(0, '智能一致性优先', '普通商品直接使用完整参考图生成；抠图与 Mask 只作为严格一致性的后台增强能力。');
    setFeature(1, 'Task / Plan 生产线', '套图拆成独立任务，每张图有自己的目标、Prompt、生成状态与结果。');
    setFeature(2, 'QA 与失败续跑', '生成后重点确认商品 Logo、颜色、结构与文字；不合格只重做这一张，成功结果保留。');
  }

  const frameHost = document.createElement('div');
  frameHost.className = 'mode-frame-host';
  frameHost.setAttribute('aria-live', 'polite');
  frameHost.setAttribute('aria-label', '单图生成模式');

  const frames = {};
  ['lock', 'legacy'].forEach((mode) => {
    const frame = document.createElement('iframe');
    frame.className = 'mode-frame';
    frame.dataset.mode = mode;
    frame.title = mode === 'lock' ? '商品锁定生成器' : '旧版图生图生成器';
    frame.src = `./mode-frame.html?mode=${mode}&v=20260903-router-1`;
    frame.loading = 'eager';
    frame.scrolling = 'no';
    frame.setAttribute('allow', 'clipboard-write');
    frame.addEventListener('load', () => {
      frame.contentWindow?.postMessage({ type: 'smirel-mode-frame-status-request' }, location.origin);
    });
    frames[mode] = frame;
    frameHost.appendChild(frame);
  });

  if (modeSwitch) modeSwitch.insertAdjacentElement('afterend', frameHost);

  function updateActiveMode(mode) {
    document.querySelectorAll('[data-mode-link]').forEach((link) => {
      link.classList.toggle('active', link.dataset.modeLink === mode);
    });
    Object.entries(frames).forEach(([frameMode, frame]) => {
      frame.classList.toggle('is-active', frameMode === mode);
      frame.setAttribute('aria-hidden', frameMode === mode ? 'false' : 'true');
    });
  }

  function writeModeUrl(mode, replace = false) {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    const state = { ...(history.state || {}), smirelImageMode: mode };
    if (replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
  }

  function ensureStudioRuntime() {
    if (studioRuntimeState !== 'idle') return;
    studioRuntimeState = 'loading';
    setShellStatus(true, '正在检查生成服务', '正在连接 AI 电商工作台生成服务。');

    const appendWorkflow = () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = './studio-smart.js?v=20260903-smart-2';
      script.addEventListener('load', () => { studioRuntimeState = 'ready'; });
      script.addEventListener('error', () => {
        studioRuntimeState = 'error';
        setShellStatus(true, '工作台加载失败', 'AI 电商工作台脚本加载失败，请稍后重试。');
      });
      document.body.appendChild(script);
    };

    const transport = document.createElement('script');
    transport.src = './studio-transport.js?v=20260903-resilient-1';
    transport.addEventListener('load', appendWorkflow, { once: true });
    transport.addEventListener('error', appendWorkflow, { once: true });
    document.body.appendChild(transport);
  }

  function requestFrameStatus(mode) {
    const frame = frames[mode];
    if (!frame) return;
    setShellStatus(true, '正在检查生成服务', mode === 'legacy' ? '正在连接旧版图生图服务。' : '正在连接商品锁定服务。');
    frame.contentWindow?.postMessage({ type: 'smirel-mode-frame-status-request' }, location.origin);
  }

  function commitMode(mode, { push = true, replace = false } = {}) {
    if (!SUPPORTED_MODES.includes(mode)) mode = 'studio';
    currentMode = mode;
    root.dataset.imageMode = mode;

    if (push) writeModeUrl(mode, replace);
    updateActiveMode(mode);
    applyModeCopy(mode);

    if (mode === 'studio') ensureStudioRuntime();
    else requestFrameStatus(mode);
  }

  function switchMode(mode, options = {}) {
    if (!SUPPORTED_MODES.includes(mode) || mode === currentMode) return;
    const change = () => commitMode(mode, options);
    if (typeof document.startViewTransition === 'function') {
      document.startViewTransition(change);
    } else {
      change();
    }
  }

  document.querySelectorAll('[data-mode-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const mode = link.dataset.modeLink;
      if (!SUPPORTED_MODES.includes(mode)) return;
      event.preventDefault();
      switchMode(mode, { push: true });
    });
  });

  window.addEventListener('popstate', () => {
    const urlMode = new URLSearchParams(location.search).get('mode');
    switchMode(SUPPORTED_MODES.includes(urlMode) ? urlMode : 'studio', { push: false });
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    const data = event.data || {};
    const mode = data.mode;
    const frame = frames[mode];
    if (!frame || event.source !== frame.contentWindow) return;

    if (data.type === 'smirel-mode-frame-height') {
      const height = Math.max(650, Math.min(14000, Number(data.height) || 650));
      frame.style.height = `${height}px`;
      return;
    }

    if (data.type === 'smirel-mode-frame-status' && currentMode === mode) {
      setShellStatus(Boolean(data.offline), data.label || '生成服务', data.note || '');
    }
  });

  updateActiveMode(currentMode);
  applyModeCopy(currentMode);

  if (!SUPPORTED_MODES.includes(requested)) writeModeUrl(currentMode, true);
  if (currentMode === 'studio') ensureStudioRuntime();
  else requestFrameStatus(currentMode);
})();
