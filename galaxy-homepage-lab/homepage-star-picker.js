(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelIntegratedStarPicker) return;

  const QUERY_KEY = 'picker';
  const QUERY_VALUE = '1';
  const STORAGE_KEY = 'smirel:integrated-star-picker:v1';
  const UI_STORAGE_KEY = 'smirel:integrated-star-picker:visible';
  const FIELD_ORDER = ['about', 'projects', 'blog', 'contact'];
  const FIELD_COLORS = Object.freeze({
    about: '#ffd9a8',
    projects: '#c6e6ff',
    blog: '#ffe1a8',
    contact: '#bfeaff',
  });

  function queryEnabled() {
    try {
      return new URLSearchParams(window.location.search).get(QUERY_KEY) === QUERY_VALUE;
    } catch {
      return false;
    }
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function installPicker(controller, context) {
    if (!controller || controller.__smirelIntegratedStarPickerController) return controller;

    const { THREE, camera, brightField, canvas, pointer, CONFIG } = context || {};
    const geometry = brightField?.geometry;
    const positions = geometry?.getAttribute?.('position');
    const brightness = geometry?.getAttribute?.('starBrightness');
    const scale = geometry?.getAttribute?.('starScale');
    if (!THREE || !camera || !canvas || !positions || !brightness) return controller;

    const catalog = Array.isArray(controller.catalog)
      ? controller.catalog
      : (window.__SMIREL_STELLAR_CATALOG__ || []);
    const objectById = new Map(catalog.map((item) => [item.id, item]));
    const fields = FIELD_ORDER
      .map((id) => objectById.get(id))
      .filter((item) => item?.kind === 'field');
    if (!fields.length) return controller;

    const state = {
      uiVisible: queryEnabled() || localStorage.getItem(UI_STORAGE_KEY) === '1',
      active: false,
      activeFieldId: 'blog',
      activeSlotId: null,
      hoveredIndex: -1,
      hoveredScreen: null,
      candidates: [],
      projectedCandidates: [],
      selections: new Map(),
      lockedMains: new Map(),
      drag: null,
      mouseX: -1000,
      mouseY: -1000,
      yaw: 0,
      pitch: 0,
      keys: new Set(),
      currentFieldSnapshotReady: false,
      lastUiSync: 0,
      candidateBrightnessMin: 1.38,
      candidateDepthMin: 12,
      candidateDepthMax: 48,
    };

    const saved = safeParse(localStorage.getItem(STORAGE_KEY), null);
    if (saved?.selections && typeof saved.selections === 'object') {
      for (const [id, index] of Object.entries(saved.selections)) {
        if (Number.isInteger(index) && index >= 0 && index < positions.count) state.selections.set(id, index);
      }
    }
    if (saved?.lockedMains && typeof saved.lockedMains === 'object') {
      for (const [id, index] of Object.entries(saved.lockedMains)) {
        if (Number.isInteger(index) && index >= 0 && index < positions.count) state.lockedMains.set(id, index);
      }
    }
    if (FIELD_ORDER.includes(saved?.activeFieldId)) state.activeFieldId = saved.activeFieldId;

    function positionAt(index, out = new THREE.Vector3()) {
      return out.set(positions.getX(index), positions.getY(index), positions.getZ(index));
    }

    function buildCandidatePool() {
      const bins = new Map();
      const scratch = new THREE.Vector3();
      const azimuthBins = 16;
      const elevationBins = 8;
      const depthBins = 3;
      const depthSpan = state.candidateDepthMax - state.candidateDepthMin;

      for (let i = 0; i < positions.count; i += 1) {
        const b = brightness.getX(i);
        if (b < state.candidateBrightnessMin) continue;
        scratch.set(positions.getX(i), positions.getY(i), positions.getZ(i));
        const depth = -scratch.z;
        if (depth < state.candidateDepthMin || depth > state.candidateDepthMax) continue;
        const radius = scratch.length();
        if (radius < 1e-4) continue;

        const azimuth = Math.atan2(scratch.x, -scratch.z);
        const elevation = Math.asin(clamp(scratch.y / radius, -1, 1));
        const az = clamp(Math.floor(((azimuth + Math.PI) / (Math.PI * 2)) * azimuthBins), 0, azimuthBins - 1);
        const el = clamp(Math.floor(((elevation + Math.PI * 0.5) / Math.PI) * elevationBins), 0, elevationBins - 1);
        const dz = clamp(Math.floor(((depth - state.candidateDepthMin) / Math.max(depthSpan, 1e-4)) * depthBins), 0, depthBins - 1);
        const key = `${az}:${el}:${dz}`;
        const score = b * 1.45 + (scale ? scale.getX(i) : 0) * 0.045 - Math.abs(depth - 28) * 0.0025;
        const previous = bins.get(key);
        if (!previous || score > previous.score) bins.set(key, { index: i, score, brightness: b, depth });
      }

      const winners = [...bins.values()].sort((a, b) => b.score - a.score);
      const accepted = [];
      const acceptedDirs = [];
      const direction = new THREE.Vector3();
      const minDot = Math.cos(THREE.MathUtils.degToRad(2.8));

      for (const candidate of winners) {
        positionAt(candidate.index, direction).normalize();
        let tooClose = false;
        for (const previous of acceptedDirs) {
          if (direction.dot(previous) > minDot) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;
        accepted.push(candidate);
        acceptedDirs.push(direction.clone());
      }

      state.candidates = accepted;
      return accepted;
    }

    buildCandidatePool();

    const style = document.createElement('style');
    style.dataset.smirelIntegratedStarPicker = 'true';
    style.textContent = `
      .smirel-picker-launch {
        position: fixed; right: 18px; top: 18px; z-index: 74;
        display: none; align-items: center; gap: 8px;
        min-height: 34px; padding: 0 12px;
        border: 1px solid rgba(205,228,255,.16); border-radius: 999px;
        background: rgba(5,8,12,.76); color: rgba(245,249,255,.86);
        backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        font: 700 10px/1 ui-sans-serif,system-ui,sans-serif;
        letter-spacing: .11em; text-transform: uppercase; cursor: pointer;
        box-shadow: 0 12px 36px rgba(0,0,0,.28);
      }
      body.smirel-picker-ui-visible .smirel-picker-launch { display: flex; }
      .smirel-picker-launch i { width: 7px; height: 7px; border-radius: 50%; background: #718091; box-shadow: 0 0 0 4px rgba(150,200,255,.05); }
      body.smirel-star-picker-active .smirel-picker-launch i { background: #bfe8ff; box-shadow: 0 0 14px rgba(172,226,255,.65); }

      .smirel-picker-overlay {
        position: fixed; inset: 0; z-index: 38; width: 100vw; height: 100vh;
        display: none; pointer-events: none; touch-action: none;
      }
      body.smirel-star-picker-active .smirel-picker-overlay { display: block; pointer-events: auto; cursor: crosshair; }
      body.smirel-star-picker-active .smirel-picker-overlay.is-dragging { cursor: grabbing; }

      .smirel-picker-panel {
        position: fixed; right: 18px; top: 62px; bottom: 18px; z-index: 75;
        width: min(370px, calc(100vw - 36px)); display: none; flex-direction: column;
        border: 1px solid rgba(196,224,255,.16); border-radius: 18px;
        background: rgba(5,8,12,.88); color: rgba(240,246,252,.88);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        box-shadow: 0 24px 70px rgba(0,0,0,.48); overflow: hidden;
        font-family: ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      body.smirel-star-picker-active .smirel-picker-panel { display: flex; }
      .smirel-picker-panel * { box-sizing: border-box; }
      .smirel-picker-head { padding: 16px 17px 13px; border-bottom: 1px solid rgba(255,255,255,.08); }
      .smirel-picker-head strong { display:block; color:#fff; font-size:14px; letter-spacing:.02em; }
      .smirel-picker-head p { margin:6px 0 0; color:rgba(223,234,244,.48); font-size:11px; line-height:1.55; }
      .smirel-picker-tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.07); }
      .smirel-picker-tab { min-width:0; padding:9px 5px; border:1px solid rgba(255,255,255,.08); border-radius:9px; background:rgba(255,255,255,.025); color:rgba(235,242,249,.54); font:700 9px/1 ui-sans-serif,system-ui; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; }
      .smirel-picker-tab.is-active { border-color:color-mix(in srgb,var(--field-color) 48%,transparent); color:#fff; background:color-mix(in srgb,var(--field-color) 9%,transparent); }
      .smirel-picker-main-lock { margin:0 12px 8px; padding:10px 11px; border:1px solid rgba(255,255,255,.07); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .smirel-picker-main-lock span { font-size:11px; color:rgba(235,242,249,.58); }
      .smirel-picker-main-lock b { font:700 10px/1 ui-monospace,SFMono-Regular,Consolas,monospace; color:#fff; }
      .smirel-picker-slots { flex:1; min-height:0; overflow:auto; padding:0 12px 12px; }
      .smirel-picker-slot { width:100%; display:grid; grid-template-columns:28px 1fr auto; gap:9px; align-items:center; margin-top:7px; padding:10px; border:1px solid rgba(255,255,255,.06); border-radius:10px; background:rgba(255,255,255,.018); color:inherit; text-align:left; cursor:pointer; }
      .smirel-picker-slot:hover { border-color:rgba(220,237,255,.14); background:rgba(255,255,255,.035); }
      .smirel-picker-slot.is-active { border-color:color-mix(in srgb,var(--field-color) 55%,transparent); background:color-mix(in srgb,var(--field-color) 8%,transparent); }
      .smirel-picker-slot em { display:grid; place-items:center; width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,.10); color:rgba(255,255,255,.50); font:700 9px/1 ui-monospace,monospace; font-style:normal; }
      .smirel-picker-slot strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; font-weight:650; color:rgba(247,250,253,.82); }
      .smirel-picker-slot small { display:block; margin-top:4px; color:rgba(224,235,245,.35); font:600 9px/1 ui-monospace,monospace; }
      .smirel-picker-slot .clear { padding:4px 6px; border:0; background:transparent; color:rgba(255,255,255,.24); cursor:pointer; font-size:14px; }
      .smirel-picker-slot .clear:hover { color:#ffb7b7; }
      .smirel-picker-foot { padding:11px 12px 13px; border-top:1px solid rgba(255,255,255,.07); }
      .smirel-picker-status { display:flex; justify-content:space-between; gap:8px; margin-bottom:9px; color:rgba(226,237,246,.42); font:600 9px/1.35 ui-monospace,monospace; }
      .smirel-picker-actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
      .smirel-picker-actions button { padding:9px; border:1px solid rgba(255,255,255,.09); border-radius:9px; background:rgba(255,255,255,.025); color:rgba(245,249,253,.72); font:650 10px/1 ui-sans-serif,system-ui; cursor:pointer; }
      .smirel-picker-actions button:hover { background:rgba(255,255,255,.05); color:#fff; }
      .smirel-picker-actions .primary { border-color:rgba(173,222,255,.25); background:rgba(123,192,235,.08); color:#e8f7ff; }

      .smirel-picker-tip { position:fixed; z-index:76; display:none; pointer-events:none; transform:translate(15px,15px); padding:7px 9px; border-radius:8px; border:1px solid rgba(218,237,255,.13); background:rgba(3,6,10,.90); color:#fff; font:650 9px/1.3 ui-monospace,monospace; box-shadow:0 10px 30px rgba(0,0,0,.35); white-space:nowrap; }
      body.smirel-star-picker-active .smirel-picker-tip.is-visible { display:block; }

      .smirel-picker-selected-layer { position:fixed; inset:0; z-index:41; pointer-events:none; display:none; }
      body.smirel-star-picker-active .smirel-picker-selected-layer { display:block; }
      .smirel-picker-selected { position:absolute; transform:translate(-50%,-50%); color:var(--field-color); }
      .smirel-picker-selected::before { content:''; position:absolute; left:50%; top:50%; width:18px; height:18px; transform:translate(-50%,-50%); border:1px solid color-mix(in srgb,var(--field-color) 70%,transparent); border-radius:50%; box-shadow:0 0 16px color-mix(in srgb,var(--field-color) 20%,transparent); }
      .smirel-picker-selected span { position:absolute; left:17px; top:-6px; min-width:max-content; max-width:240px; padding:3px 5px; color:rgba(247,250,253,.78); background:rgba(0,0,0,.42); border-radius:4px; text-shadow:0 1px 8px #000; font:650 9px/1.2 ui-sans-serif,system-ui; white-space:nowrap; }
      .smirel-picker-selected.is-right span { left:auto; right:17px; text-align:right; }

      body.smirel-star-picker-active .smirel-companion-star,
      body.smirel-star-picker-active .smirel-constellation-map { opacity:0 !important; pointer-events:none !important; }
      body.smirel-star-picker-active .smirel-field-star { pointer-events:none !important; }
      body.smirel-star-picker-active .home-index,
      body.smirel-star-picker-active .home-intro { pointer-events:none !important; }
      body.smirel-star-picker-active { user-select:none; }
      body.smirel-star-picker-active .smirel-picker-panel,
      body.smirel-star-picker-active .smirel-picker-panel * { user-select:text; }

      @media (max-width: 820px) {
        .smirel-picker-panel { width:min(330px,calc(100vw - 24px)); right:12px; top:56px; bottom:12px; }
        .smirel-picker-launch { right:12px; top:12px; }
      }
    `;
    document.head.appendChild(style);

    const launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'smirel-picker-launch';
    launch.innerHTML = '<i></i><span>选星器 OFF</span>';
    document.body.appendChild(launch);

    const overlay = document.createElement('canvas');
    overlay.className = 'smirel-picker-overlay';
    document.body.appendChild(overlay);
    const overlayCtx = overlay.getContext('2d');

    const selectedLayer = document.createElement('div');
    selectedLayer.className = 'smirel-picker-selected-layer';
    document.body.appendChild(selectedLayer);

    const tip = document.createElement('div');
    tip.className = 'smirel-picker-tip';
    document.body.appendChild(tip);

    const panel = document.createElement('aside');
    panel.className = 'smirel-picker-panel';
    panel.setAttribute('aria-label', 'Homepage star picker');
    panel.innerHTML = `
      <div class="smirel-picker-head">
        <strong>在当前主页里选伴星</strong>
        <p>主星锁定。先点下面一个伴星槽位，再左拖旋转、右拖平移、滚轮前后移动。只有经过三维分桶筛选的明亮候选星可以选择。</p>
      </div>
      <div class="smirel-picker-tabs"></div>
      <div class="smirel-picker-main-lock"><span>当前主星（锁定）</span><b>等待解析…</b></div>
      <div class="smirel-picker-slots"></div>
      <div class="smirel-picker-foot">
        <div class="smirel-picker-status"><span class="candidate-count">候选 —</span><span class="camera-status">自由视角</span></div>
        <div class="smirel-picker-actions">
          <button type="button" data-action="reset-camera">重置视角</button>
          <button type="button" data-action="restore-field">恢复当前栏</button>
          <button type="button" data-action="copy-field">复制当前栏</button>
          <button type="button" class="primary" data-action="copy-all">复制全部结果</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const tabsRoot = panel.querySelector('.smirel-picker-tabs');
    const slotsRoot = panel.querySelector('.smirel-picker-slots');
    const mainLockEl = panel.querySelector('.smirel-picker-main-lock b');
    const candidateCountEl = panel.querySelector('.candidate-count');
    const cameraStatusEl = panel.querySelector('.camera-status');

    const selectedEls = new Map();
    const originalFieldSelections = new Map();
    const scratchProjected = new THREE.Vector3();
    const scratchDirection = new THREE.Vector3();
    const scratchRight = new THREE.Vector3();
    const scratchUp = new THREE.Vector3();
    const scratchForward = new THREE.Vector3();
    const tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    function persist() {
      const selections = Object.fromEntries(state.selections.entries());
      const lockedMains = Object.fromEntries(state.lockedMains.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ selections, lockedMains, activeFieldId: state.activeFieldId }));
    }

    function showToast(message) {
      tip.textContent = message;
      tip.style.left = `${Math.max(12, Math.min(window.innerWidth - 260, state.mouseX))}px`;
      tip.style.top = `${Math.max(12, Math.min(window.innerHeight - 80, state.mouseY))}px`;
      tip.classList.add('is-visible');
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => { tip.classList.remove('is-visible'); showToast.timer = 0; }, 1350);
    }

    function fieldNodes(fieldId) {
      const field = objectById.get(fieldId);
      return (field?.constellation?.nodes || []).map((id) => objectById.get(id)).filter(Boolean);
    }

    function snapshotAnchorsIfReady() {
      controller.resolveSpatialAnchors?.(controller.getProjectionViewport?.());
      let changed = false;
      for (const field of fields) {
        const main = controller.getSpatialAnchor?.(field.id);
        if (main && !state.lockedMains.has(field.id)) {
          state.lockedMains.set(field.id, main.index);
          changed = true;
        }
        for (const object of fieldNodes(field.id)) {
          const anchor = controller.getSpatialAnchor?.(object.id);
          if (!anchor) continue;
          const originalKey = `${field.id}:${object.id}`;
          if (!originalFieldSelections.has(originalKey)) originalFieldSelections.set(originalKey, anchor.index);
          if (!state.selections.has(object.id)) {
            state.selections.set(object.id, anchor.index);
            changed = true;
          }
        }
      }
      if (changed) {
        persist();
        renderPanel();
      }
      state.currentFieldSnapshotReady = state.lockedMains.size === fields.length;
    }

    function fieldColor(fieldId) {
      return FIELD_COLORS[fieldId] || '#d8efff';
    }

    function renderPanel() {
      if (!state.uiVisible) return;
      tabsRoot.innerHTML = '';
      for (const field of fields) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `smirel-picker-tab${field.id === state.activeFieldId ? ' is-active' : ''}`;
        button.style.setProperty('--field-color', fieldColor(field.id));
        button.textContent = field.title;
        button.addEventListener('click', () => {
          state.activeFieldId = field.id;
          state.activeSlotId = null;
          persist();
          renderPanel();
          updateSelectedLayer();
        });
        tabsRoot.appendChild(button);
      }

      const mainIndex = state.lockedMains.get(state.activeFieldId);
      mainLockEl.textContent = Number.isInteger(mainIndex) ? `#${mainIndex} · LOCKED` : '等待解析…';

      slotsRoot.innerHTML = '';
      const nodes = fieldNodes(state.activeFieldId);
      nodes.forEach((object, order) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `smirel-picker-slot${state.activeSlotId === object.id ? ' is-active' : ''}`;
        button.style.setProperty('--field-color', fieldColor(state.activeFieldId));
        const index = state.selections.get(object.id);
        button.innerHTML = `
          <em>${String(order + 1).padStart(2, '0')}</em>
          <span><strong>${object.navTitle || object.title || object.id}</strong><small>${Number.isInteger(index) ? `#${index} · B ${brightness.getX(index).toFixed(2)} · Z ${(-positions.getZ(index)).toFixed(1)}` : '未选择'}</small></span>
          <span class="clear" title="清除">×</span>
        `;
        button.addEventListener('click', (event) => {
          if (event.target.closest('.clear')) {
            state.selections.delete(object.id);
            persist();
            renderPanel();
            updateSelectedLayer();
            return;
          }
          state.activeSlotId = object.id;
          renderPanel();
        });
        slotsRoot.appendChild(button);
      });

      candidateCountEl.textContent = `均匀明亮候选 ${state.candidates.length}`;
      cameraStatusEl.textContent = state.activeSlotId
        ? `正在选择：${objectById.get(state.activeSlotId)?.navTitle || objectById.get(state.activeSlotId)?.title || state.activeSlotId}`
        : '先选一个伴星槽位';
    }

    function syncUiVisible() {
      document.body.classList.toggle('smirel-picker-ui-visible', state.uiVisible);
      if (state.uiVisible) localStorage.setItem(UI_STORAGE_KEY, '1');
      else localStorage.removeItem(UI_STORAGE_KEY);
      launch.querySelector('span').textContent = state.active ? '选星器 ON' : '选星器 OFF';
      renderPanel();
    }

    function updateCameraAnglesFromCurrent() {
      camera.getWorldDirection(scratchDirection);
      state.yaw = Math.atan2(scratchDirection.x, -scratchDirection.z);
      state.pitch = Math.asin(clamp(scratchDirection.y, -0.999, 0.999));
    }

    function setActive(active) {
      state.active = Boolean(active);
      document.body.classList.toggle('smirel-star-picker-active', state.active);
      launch.querySelector('span').textContent = state.active ? '选星器 ON' : '选星器 OFF';
      if (state.active) {
        controller.constellation?.close?.(true);
        snapshotAnchorsIfReady();
        updateCameraAnglesFromCurrent();
        if (!state.activeSlotId) state.activeSlotId = fieldNodes(state.activeFieldId)[0]?.id || null;
        renderPanel();
      } else {
        state.drag = null;
        overlay.classList.remove('is-dragging');
        state.keys.clear();
        state.hoveredIndex = -1;
        tip.classList.remove('is-visible');
        if (pointer) {
          pointer.targetX = pointer.currentX = 0;
          pointer.targetY = pointer.currentY = 0;
        }
        camera.position.set(0, 0, 0);
        camera.fov = CONFIG?.fov || 55;
        camera.lookAt(0, 0, -12);
        camera.updateProjectionMatrix();
      }
    }

    launch.addEventListener('click', () => setActive(!state.active));

    function resizeOverlay() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (overlay.width !== pixelWidth || overlay.height !== pixelHeight) {
        overlay.width = pixelWidth;
        overlay.height = pixelHeight;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
      }
      overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width, height };
    }

    function reservedIndices() {
      const set = new Set(state.lockedMains.values());
      for (const [id, index] of state.selections) if (id !== state.activeSlotId) set.add(index);
      return set;
    }

    function projectIndex(index, width, height, out = {}) {
      positionAt(index, scratchProjected).project(camera);
      out.visible = scratchProjected.z >= -1 && scratchProjected.z <= 1
        && Math.abs(scratchProjected.x) <= 1.03
        && Math.abs(scratchProjected.y) <= 1.03;
      out.x = (scratchProjected.x * 0.5 + 0.5) * width;
      out.y = (-scratchProjected.y * 0.5 + 0.5) * height;
      return out;
    }

    function drawOverlay() {
      const { width, height } = resizeOverlay();
      overlayCtx.clearRect(0, 0, width, height);
      state.projectedCandidates.length = 0;
      if (!state.active) return;

      const color = fieldColor(state.activeFieldId);
      const reserved = reservedIndices();
      let nearest = null;
      let nearestDistance = 24;

      overlayCtx.save();
      overlayCtx.lineWidth = 1;
      for (const candidate of state.candidates) {
        if (reserved.has(candidate.index)) continue;
        const p = projectIndex(candidate.index, width, height, {});
        if (!p.visible) continue;
        state.projectedCandidates.push({ ...candidate, ...p });
        const distance = Math.hypot(p.x - state.mouseX, p.y - state.mouseY);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = { ...candidate, ...p };
        }
        const alpha = clamp(0.10 + (candidate.brightness - state.candidateBrightnessMin) * 0.11, 0.10, 0.24);
        overlayCtx.strokeStyle = `rgba(210,235,255,${alpha.toFixed(3)})`;
        overlayCtx.beginPath();
        overlayCtx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        overlayCtx.stroke();
      }

      const mainIndex = state.lockedMains.get(state.activeFieldId);
      if (Number.isInteger(mainIndex)) {
        const main = projectIndex(mainIndex, width, height, {});
        if (main.visible) {
          overlayCtx.strokeStyle = color;
          overlayCtx.globalAlpha = 0.75;
          overlayCtx.lineWidth = 1.2;
          overlayCtx.beginPath();
          overlayCtx.arc(main.x, main.y, 19, 0, Math.PI * 2);
          overlayCtx.stroke();
          overlayCtx.globalAlpha = 1;
        }
      }

      const activeSelected = state.activeSlotId ? state.selections.get(state.activeSlotId) : null;
      if (Number.isInteger(activeSelected)) {
        const selected = projectIndex(activeSelected, width, height, {});
        if (selected.visible) {
          overlayCtx.strokeStyle = color;
          overlayCtx.lineWidth = 1.5;
          overlayCtx.beginPath();
          overlayCtx.arc(selected.x, selected.y, 12, 0, Math.PI * 2);
          overlayCtx.stroke();
        }
      }

      state.hoveredIndex = nearest?.index ?? -1;
      state.hoveredScreen = nearest || null;
      if (nearest) {
        overlayCtx.strokeStyle = '#ffffff';
        overlayCtx.shadowColor = color;
        overlayCtx.shadowBlur = 16;
        overlayCtx.lineWidth = 1.6;
        overlayCtx.beginPath();
        overlayCtx.arc(nearest.x, nearest.y, 13, 0, Math.PI * 2);
        overlayCtx.stroke();
        overlayCtx.shadowBlur = 0;
        overlayCtx.beginPath();
        overlayCtx.moveTo(nearest.x - 18, nearest.y); overlayCtx.lineTo(nearest.x - 10, nearest.y);
        overlayCtx.moveTo(nearest.x + 10, nearest.y); overlayCtx.lineTo(nearest.x + 18, nearest.y);
        overlayCtx.moveTo(nearest.x, nearest.y - 18); overlayCtx.lineTo(nearest.x, nearest.y - 10);
        overlayCtx.moveTo(nearest.x, nearest.y + 10); overlayCtx.lineTo(nearest.x, nearest.y + 18);
        overlayCtx.stroke();
        tip.textContent = `#${nearest.index} · 亮度 ${nearest.brightness.toFixed(2)} · 深度 ${nearest.depth.toFixed(1)}`;
        tip.style.left = `${state.mouseX}px`;
        tip.style.top = `${state.mouseY}px`;
        tip.classList.add('is-visible');
      } else if (!showToast.timer) {
        tip.classList.remove('is-visible');
      }
      overlayCtx.restore();
    }

    function ensureSelectedElement(object) {
      let element = selectedEls.get(object.id);
      if (element) return element;
      element = document.createElement('div');
      element.className = 'smirel-picker-selected';
      element.style.setProperty('--field-color', fieldColor(object.parentField));
      element.innerHTML = '<span></span>';
      selectedLayer.appendChild(element);
      selectedEls.set(object.id, element);
      return element;
    }

    function updateSelectedLayer() {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      const activeIds = new Set(fieldNodes(state.activeFieldId).map((object) => object.id));
      for (const [id, element] of selectedEls) if (!activeIds.has(id)) element.style.display = 'none';
      for (const object of fieldNodes(state.activeFieldId)) {
        const index = state.selections.get(object.id);
        if (!Number.isInteger(index)) continue;
        const element = ensureSelectedElement(object);
        const p = projectIndex(index, width, height, {});
        if (!p.visible) {
          element.style.display = 'none';
          continue;
        }
        element.style.display = 'block';
        element.style.left = `${p.x}px`;
        element.style.top = `${p.y}px`;
        element.classList.toggle('is-right', p.x > width * 0.58);
        element.querySelector('span').textContent = object.navTitle || object.title || object.id;
      }
    }

    function assignHovered() {
      if (!state.activeSlotId) return showToast('先在右侧选一个伴星槽位');
      if (!Number.isInteger(state.hoveredIndex) || state.hoveredIndex < 0) return;
      const duplicate = [...state.selections.entries()].find(([id, index]) => id !== state.activeSlotId && index === state.hoveredIndex);
      if (duplicate) return showToast('这颗星已经被另一个伴星槽位使用');
      state.selections.set(state.activeSlotId, state.hoveredIndex);
      persist();
      renderPanel();
      updateSelectedLayer();
      showToast(`已绑定 #${state.hoveredIndex}`);
    }

    overlay.addEventListener('pointerdown', (event) => {
      if (!state.active || (event.button !== 0 && event.button !== 2)) return;
      event.preventDefault();
      state.drag = { button: event.button, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
      overlay.setPointerCapture?.(event.pointerId);
      overlay.classList.add('is-dragging');
    });

    overlay.addEventListener('pointermove', (event) => {
      state.mouseX = event.clientX;
      state.mouseY = event.clientY;
      if (!state.drag) return;
      const dx = event.clientX - state.drag.x;
      const dy = event.clientY - state.drag.y;
      if (Math.hypot(event.clientX - state.drag.startX, event.clientY - state.drag.startY) > 4) state.drag.moved = true;
      state.drag.x = event.clientX;
      state.drag.y = event.clientY;

      if (state.drag.button === 0 && state.drag.moved) {
        state.yaw -= dx * 0.0032;
        state.pitch = clamp(state.pitch - dy * 0.0032, -1.48, 1.48);
      } else if (state.drag.button === 2) {
        camera.updateMatrixWorld();
        camera.getWorldDirection(scratchForward);
        scratchRight.crossVectors(scratchForward, camera.up).normalize();
        scratchUp.crossVectors(scratchRight, scratchForward).normalize();
        const move = 0.014 * clamp(Math.abs(camera.position.z) * 0.08 + 1, 1, 3.5);
        camera.position.addScaledVector(scratchRight, -dx * move);
        camera.position.addScaledVector(scratchUp, dy * move);
      }
    }, { passive: false });

    overlay.addEventListener('pointerup', (event) => {
      if (!state.drag) return;
      const moved = state.drag.moved;
      const button = state.drag.button;
      state.drag = null;
      overlay.classList.remove('is-dragging');
      try { overlay.releasePointerCapture?.(event.pointerId); } catch {}
      if (button === 0 && !moved) assignHovered();
    });
    overlay.addEventListener('pointercancel', () => { state.drag = null; overlay.classList.remove('is-dragging'); });
    overlay.addEventListener('contextmenu', (event) => event.preventDefault());
    overlay.addEventListener('wheel', (event) => {
      if (!state.active) return;
      event.preventDefault();
      camera.getWorldDirection(scratchForward);
      camera.position.addScaledVector(scratchForward, clamp(event.deltaY * 0.010, -5, 5));
    }, { passive: false });

    window.addEventListener('keydown', (event) => {
      if (event.shiftKey && event.key.toLowerCase() === 'p') {
        state.uiVisible = true;
        syncUiVisible();
        setActive(!state.active);
        return;
      }
      if (!state.active) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      if (['w','a','s','d','q','e'].includes(key)) {
        state.keys.add(key);
        event.preventDefault();
      }
      if (event.key === 'Escape') setActive(false);
    });
    window.addEventListener('keyup', (event) => state.keys.delete(event.key.toLowerCase()));

    function applyKeyboardCamera(dt) {
      if (!state.keys.size) return;
      camera.getWorldDirection(scratchForward).normalize();
      scratchRight.crossVectors(scratchForward, camera.up).normalize();
      scratchUp.crossVectors(scratchRight, scratchForward).normalize();
      const speed = 8.0 * dt;
      if (state.keys.has('w')) camera.position.addScaledVector(scratchForward, speed);
      if (state.keys.has('s')) camera.position.addScaledVector(scratchForward, -speed);
      if (state.keys.has('a')) camera.position.addScaledVector(scratchRight, -speed);
      if (state.keys.has('d')) camera.position.addScaledVector(scratchRight, speed);
      if (state.keys.has('q')) camera.position.addScaledVector(scratchUp, -speed);
      if (state.keys.has('e')) camera.position.addScaledVector(scratchUp, speed);
    }

    function applyPickerCamera(dt) {
      if (!state.active) return;
      applyKeyboardCamera(dt);
      tempEuler.set(state.pitch, state.yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(tempEuler);
      camera.fov = CONFIG?.fov || 55;
      camera.updateProjectionMatrix();
      if (pointer) {
        pointer.targetX = pointer.currentX = 0;
        pointer.targetY = pointer.currentY = 0;
      }
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        showToast('已复制');
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        showToast('已复制');
      }
    }

    function exportField(fieldId) {
      const field = objectById.get(fieldId);
      const companions = {};
      for (const object of fieldNodes(fieldId)) {
        const index = state.selections.get(object.id);
        if (Number.isInteger(index)) companions[object.id] = index;
      }
      return { field: fieldId, title: field?.title || fieldId, lockedMain: state.lockedMains.get(fieldId) ?? null, companions };
    }

    function exportAll() {
      const fieldsOut = {};
      for (const field of fields) fieldsOut[field.id] = exportField(field.id);
      return { source: 'smirel.com integrated star picker', selectedAt: new Date().toISOString(), fields: fieldsOut };
    }

    panel.addEventListener('pointerenter', () => { state.mouseX = -1000; state.mouseY = -1000; tip.classList.remove('is-visible'); });
    panel.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'reset-camera') {
        camera.position.set(0, 0, 0);
        camera.lookAt(0, 0, -12);
        updateCameraAnglesFromCurrent();
      }
      if (action === 'restore-field') {
        for (const object of fieldNodes(state.activeFieldId)) {
          const key = `${state.activeFieldId}:${object.id}`;
          const original = originalFieldSelections.get(key);
          if (Number.isInteger(original)) state.selections.set(object.id, original);
          else state.selections.delete(object.id);
        }
        persist();
        renderPanel();
        updateSelectedLayer();
        showToast('已恢复当前栏初始星位');
      }
      if (action === 'copy-field') copyText(JSON.stringify(exportField(state.activeFieldId), null, 2));
      if (action === 'copy-all') copyText(JSON.stringify(exportAll(), null, 2));
    });

    function updatePickerUi(now) {
      if (!state.uiVisible) return;
      if (!state.currentFieldSnapshotReady || now - state.lastUiSync > 1600) {
        state.lastUiSync = now;
        snapshotAnchorsIfReady();
      }
      if (!state.active) return;
      drawOverlay();
      updateSelectedLayer();
    }

    const baseUpdate = typeof controller.update === 'function' ? controller.update.bind(controller) : () => false;
    controller.update = (now, dt, elapsed) => {
      if (state.active) applyPickerCamera(dt);
      const ownsCamera = baseUpdate(now, dt, elapsed);
      updatePickerUi(now);
      return state.active ? true : ownsCamera;
    };

    controller.starPicker = {
      get active() { return state.active; },
      get candidates() { return state.candidates; },
      get selections() { return new Map(state.selections); },
      get lockedMains() { return new Map(state.lockedMains); },
      setActive,
      exportAll,
    };
    controller.__smirelIntegratedStarPickerController = true;

    if (state.uiVisible) document.body.classList.add('smirel-picker-ui-visible');
    syncUiVisible();
    if (queryEnabled()) setActive(true);

    return controller;
  }

  const pickerInstall = function integratedStarPickerInstall(context) {
    const controller = baseInstall(context);
    return installPicker(controller, context);
  };
  pickerInstall.__smirelIntegratedStarPicker = true;
  window[INSTALL_KEY] = pickerInstall;
})();
