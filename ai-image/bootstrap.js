(() => {
  const root = document.documentElement;
  const SUPPORTED_MODES = ['studio', 'lock', 'legacy'];
  const requested = new URLSearchParams(location.search).get('mode');
  let currentMode = SUPPORTED_MODES.includes(requested) ? requested : 'studio';
  let navigationBusy = false;
  let pendingMode = null;
  let statusEpoch = 0;
  let modeEnterTimer = null;

  root.dataset.imageMode = currentMode;

  const sourceWorkspace = document.querySelector('.workspace');
  const workspaceTemplate = sourceWorkspace?.cloneNode(true) || null;
  sourceWorkspace?.remove();

  const modeSwitch = document.querySelector('.mode-switch');
  const inlineHost = document.createElement('section');
  inlineHost.className = 'mode-inline-host';
  inlineHost.setAttribute('aria-live', 'polite');
  inlineHost.setAttribute('aria-label', '单图生成模式');
  modeSwitch?.insertAdjacentElement('afterend', inlineHost);

  /*
   * studio-smart.js historically expects #engineNoteText even though the
   * Studio UI does not render that legacy note. Give it a private proxy only
   * while the module captures its DOM references. Single-image modes then own
   * the real #engineNoteText inside their mounted workspace.
   */
  const studioEngineNoteProxy = document.createElement('span');
  studioEngineNoteProxy.id = 'studioEngineNoteProxy';
  studioEngineNoteProxy.hidden = true;
  document.body.appendChild(studioEngineNoteProxy);

  const instances = new Map();
  const runtimePromises = new Map();
  let activeInlineMode = null;
  let studioRuntimePromise = null;

  const engineState = document.querySelector('#engineState');
  const eyebrow = document.querySelector('.eyebrow');
  const heroTitle = document.querySelector('.hero h1');
  const heroCopy = document.querySelector('.hero-copy');
  const heroChips = [...document.querySelectorAll('.hero-chips span')];
  const featureCards = [...document.querySelectorAll('.feature-card')];

  const setChip = (index, text) => {
    if (heroChips[index]) heroChips[index].textContent = text;
  };

  const setFeature = (index, title, copy) => {
    const card = featureCards[index];
    if (!card) return;
    const strong = card.querySelector('strong');
    const paragraph = card.querySelector('p');
    if (strong) strong.textContent = title;
    if (paragraph) paragraph.textContent = copy;
  };

  function pulseModeEntry() {
    root.classList.remove('mode-enter');
    void root.offsetWidth;
    root.classList.add('mode-enter');
    if (modeEnterTimer) window.clearTimeout(modeEnterTimer);
    modeEnterTimer = window.setTimeout(() => {
      root.classList.remove('mode-enter');
      modeEnterTimer = null;
    }, 220);
  }

  function setShellStatus(offline, label) {
    if (!engineState) return;
    engineState.classList.toggle('is-offline', Boolean(offline));
    const labelNode = engineState.querySelector('span');
    if (labelNode) labelNode.textContent = label;
  }

  function setModeNote(mode, note) {
    if (mode === 'studio') {
      studioEngineNoteProxy.textContent = note || '';
      const providerNote = document.querySelector('#studioProviderNote');
      if (providerNote && note) providerNote.textContent = note;
      return;
    }
    const workspace = instances.get(mode);
    const noteNode = workspace?.querySelector('#engineNoteText');
    if (noteNode && note) noteNode.textContent = note;
  }

  function regionLabel(region) {
    if (region === 'cn') return '中国站';
    if (region === 'global') return '国际站';
    return '';
  }

  async function refreshModeStatus(mode) {
    const epoch = ++statusEpoch;
    const endpoint = mode === 'lock'
      ? (root.dataset.backgroundApiEndpoint || '').trim()
      : (root.dataset.apiEndpoint || '').trim();
    const anonKey = (root.dataset.supabaseAnonKey || '').trim();

    if (!endpoint || !anonKey) {
      if (mode === currentMode && epoch === statusEpoch) {
        setShellStatus(true, '生成服务配置缺失');
        setModeNote(mode, '网页尚未配置生成接口。');
      }
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (mode !== currentMode || epoch !== statusEpoch) return;

      if (response.ok && data?.ready) {
        const region = regionLabel(data.region);
        if (mode === 'studio') {
          setShellStatus(false, region ? `电商工作台已连接 · ${region}` : '电商工作台已连接');
          setModeNote(mode, `智能一致性默认直接使用完整商品参考图${region ? ` · ${region}` : ''}。`);
        } else if (mode === 'lock') {
          setShellStatus(false, region ? `商品锁定已连接 · ${region}` : '商品锁定已连接');
          setModeNote(mode, `MiniMax 仅生成背景；商品主体使用真实像素合成${region ? ` · ${region}` : ''}。`);
        } else {
          setShellStatus(false, region ? `MiniMax 已连接 · ${region}` : 'MiniMax 已连接');
          setModeNote(mode, `MiniMax Image-01 参考图重绘已就绪${region ? ` · ${region}` : ''}。`);
        }
        return;
      }

      setShellStatus(true, data?.error === 'minimax_api_key_invalid' ? 'MiniMax Key 无效' : '生成服务异常');
      setModeNote(mode, '生成服务当前健康检查未通过。');
    } catch (error) {
      if (mode !== currentMode || epoch !== statusEpoch) return;
      console.warn('[AI Image Router] health check failed', error);
      setShellStatus(true, '生成服务暂不可用');
      setModeNote(mode, '暂时无法连接生成服务，请稍后重试。');
    }
  }

  function applyModeCopy(mode) {
    if (mode === 'legacy') {
      document.title = '旧版 AI 图生图 · Smirel';
      if (eyebrow) eyebrow.textContent = 'LEGACY IMAGE-TO-IMAGE';
      if (heroTitle) heroTitle.textContent = '旧版 AI 图生图';
      if (heroCopy) heroCopy.textContent = '把商品参考图交给 MiniMax 重新生成，方便与商品锁定和电商工作台随时对比。';
      setChip(0, '参考图重绘'); setChip(1, 'MiniMax'); setChip(2, '旧版保留');
      setFeature(0, '参考图生成', '把图片作为 MiniMax 的视觉参考，适合需要 AI 重新设计或重绘主体的场景。');
      setFeature(1, '快速试风格', '直接输入商品与场景描述，快速比较不同风格和比例。');
      setFeature(2, '与新版并存', '旧链路没有删除，需要时可以随时切回进行效果对比。');
      return;
    }

    if (mode === 'lock') {
      document.title = 'AI 商品锁定 · Smirel';
      if (eyebrow) eyebrow.textContent = 'LOCKED PRODUCT COMPOSITION';
      if (heroTitle) heroTitle.textContent = '商品锁定';
      if (heroCopy) heroCopy.textContent = '需要商品 Logo、颜色和包装像素严格不变时使用。系统抠出真实商品，AI 只生成场景背景。';
      setChip(0, '真实商品像素'); setChip(1, 'AI 背景'); setChip(2, '本地合成');
      setFeature(0, '真实商品锁定', '商品主体使用原图真实像素，不交给生成模型重新绘制。');
      setFeature(1, '背景独立生成', 'MiniMax 只负责空场景背景，再在浏览器本地完成商品合成。');
      setFeature(2, '严格一致性', '适合包装、Logo、结构和文字不能发生变化的商品。');
      return;
    }

    document.title = 'AI 电商视觉工作台 · Smirel';
    if (eyebrow) eyebrow.textContent = 'AI ECOMMERCE VISUAL WORKSPACE';
    if (heroTitle) heroTitle.textContent = 'AI 电商视觉工作台';
    if (heroCopy) heroCopy.textContent = '上传商品图即可开始。默认直接用完整商品参考图生成，不要求抠图；只有需要更强商品保护时才启用严格像素锁定。';
    setChip(0, '无需抠图'); setChip(1, '任务计划'); setChip(2, '逐图 QA');
    setFeature(0, '智能一致性优先', '普通商品直接使用完整参考图生成；抠图与 Mask 只作为严格一致性的后台增强能力。');
    setFeature(1, 'Task / Plan 生产线', '套图拆成独立任务，每张图有自己的目标、Prompt、生成状态与结果。');
    setFeature(2, 'QA 与失败续跑', '生成后重点确认商品 Logo、颜色、结构与文字；不合格只重做这一张，成功结果保留。');
  }

  function configureWorkspace(workspace, mode) {
    workspace.classList.remove('fade-in');
    workspace.classList.add('mode-inline-workspace');
    workspace.querySelectorAll('.panel.cards.fade-in').forEach((panel) => panel.classList.remove('fade-in'));
    const q = (selector) => workspace.querySelector(selector);
    const imageFieldTitle = q('#imageFieldTitle');
    const imageFieldHint = q('#imageFieldHint');
    const promptFieldTitle = q('#promptFieldTitle');
    const promptInput = q('#promptInput');
    const noteTitle = q('.engine-note strong');

    if (mode === 'legacy') {
      if (imageFieldTitle) imageFieldTitle.textContent = '商品参考图';
      if (imageFieldHint) imageFieldHint.textContent = '可选';
      if (promptFieldTitle) promptFieldTitle.textContent = '商品与场景描述';
      if (promptInput) promptInput.placeholder = '例如：白色香水瓶，放在浅灰色石材台面上，柔和侧光，高级商业摄影，干净背景';
      if (noteTitle) noteTitle.textContent = 'MiniMax Image-01 · 旧版参考图';
    } else {
      if (imageFieldTitle) imageFieldTitle.textContent = '商品原图';
      if (imageFieldHint) imageFieldHint.textContent = '商品锁定模式必选';
      if (promptFieldTitle) promptFieldTitle.textContent = '场景描述';
      if (noteTitle) noteTitle.textContent = '商品锁定 · MiniMax Background';
    }
  }

  function getWorkspace(mode) {
    if (instances.has(mode)) return instances.get(mode);
    if (!workspaceTemplate) return null;
    const workspace = workspaceTemplate.cloneNode(true);
    configureWorkspace(workspace, mode);
    instances.set(mode, workspace);
    return workspace;
  }

  function detachInlineWorkspace() {
    if (!activeInlineMode) return;
    const active = instances.get(activeInlineMode);
    if (active?.isConnected) active.remove();
    activeInlineMode = null;
  }

  function loadSingleRuntime(mode) {
    if (runtimePromises.has(mode)) return runtimePromises.get(mode);

    const promise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.dataset.imageRuntime = mode;
      if (mode === 'legacy') {
        script.src = './app.js?v=20260903-inline-1';
      } else {
        script.type = 'module';
        script.src = './product-lock.js?v=20260903-inline-1';
      }
      script.addEventListener('load', () => resolve(true), { once: true });
      script.addEventListener('error', () => {
        console.error(`[AI Image Router] ${mode} runtime failed to load`);
        resolve(false);
      }, { once: true });
      document.body.appendChild(script);
    });

    runtimePromises.set(mode, promise);
    return promise;
  }

  function ensureStudioRuntime() {
    if (studioRuntimePromise) return studioRuntimePromise;

    studioRuntimePromise = new Promise((resolve) => {
      studioEngineNoteProxy.id = 'engineNoteText';

      const finish = (ok) => {
        studioEngineNoteProxy.id = 'studioEngineNoteProxy';
        resolve(ok);
      };

      const appendWorkflow = () => {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = './studio-smart.js?v=20260903-smart-2';
        script.addEventListener('load', () => finish(true), { once: true });
        script.addEventListener('error', () => finish(false), { once: true });
        document.body.appendChild(script);
      };

      const transport = document.createElement('script');
      transport.src = './studio-transport.js?v=20260903-resilient-1';
      transport.addEventListener('load', appendWorkflow, { once: true });
      transport.addEventListener('error', appendWorkflow, { once: true });
      document.body.appendChild(transport);
    });

    return studioRuntimePromise;
  }

  function writeModeUrl(mode, replace = false) {
    const url = new URL(location.href);
    url.searchParams.set('mode', mode);
    const state = { ...(history.state || {}), smirelImageMode: mode };
    if (replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
  }

  function updateActiveTab(mode) {
    document.querySelectorAll('[data-mode-link]').forEach((link) => {
      link.classList.toggle('active', link.dataset.modeLink === mode);
    });
  }

  async function activateMode(mode, { push = true, replace = false } = {}) {
    currentMode = mode;
    root.dataset.imageMode = mode;
    if (push) writeModeUrl(mode, replace);
    updateActiveTab(mode);
    applyModeCopy(mode);

    if (mode === 'studio') {
      detachInlineWorkspace();
      pulseModeEntry();
      navigationBusy = true;
      const ok = await ensureStudioRuntime();
      navigationBusy = false;
      if (!ok && currentMode === 'studio') setShellStatus(true, '工作台加载失败');
    } else {
      detachInlineWorkspace();
      const workspace = getWorkspace(mode);
      if (workspace) {
        inlineHost.appendChild(workspace);
        activeInlineMode = mode;
      }
      pulseModeEntry();
      navigationBusy = true;
      const ok = await loadSingleRuntime(mode);
      navigationBusy = false;
      if (!ok && currentMode === mode) setShellStatus(true, '生成器加载失败');
    }

    if (currentMode === mode) {
      void refreshModeStatus(mode);
      window.setTimeout(() => {
        if (currentMode === mode) void refreshModeStatus(mode);
      }, 900);
    }

    if (pendingMode && pendingMode !== currentMode) {
      const next = pendingMode;
      pendingMode = null;
      switchMode(next, { push: true });
    } else {
      pendingMode = null;
    }
  }

  function switchMode(mode, options = {}) {
    if (!SUPPORTED_MODES.includes(mode) || mode === currentMode) return;
    if (navigationBusy) {
      pendingMode = mode;
      return;
    }

    void activateMode(mode, options);
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

  addEventListener('popstate', () => {
    const urlMode = new URLSearchParams(location.search).get('mode');
    const mode = SUPPORTED_MODES.includes(urlMode) ? urlMode : 'studio';
    if (mode === currentMode) return;
    switchMode(mode, { push: false });
  });

  updateActiveTab(currentMode);
  applyModeCopy(currentMode);
  if (!SUPPORTED_MODES.includes(requested)) writeModeUrl(currentMode, true);
  void activateMode(currentMode, { push: false });
})();