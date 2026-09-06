(() => {
  'use strict';

  const QUERY_KEY = 'picker';
  const QUERY_VALUE = '1';

  function queryEnabled() {
    try {
      return new URLSearchParams(window.location.search).get(QUERY_KEY) === QUERY_VALUE;
    } catch {
      return false;
    }
  }

  // Hard gate: the picker does not wrap the homepage runtime, allocate UI, read
  // saved selections, or register shortcuts on a normal production visit.
  if (!queryEnabled()) return;

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelIntegratedStarPickerV2) return;

  const STORAGE_KEY = 'smirel:integrated-star-picker:v2';
  const FIELD_ORDER = ['about', 'projects', 'blog', 'contact'];
  const FIELD_COLORS = Object.freeze({
    about: '#ffd9a8',
    projects: '#c6e6ff',
    blog: '#ffe1a8',
    contact: '#bfeaff',
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function readSaved() {
    try {
      return safeParse(localStorage.getItem(STORAGE_KEY), null);
    } catch {
      return null;
    }
  }

  function writeSaved(payload) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }

  function installPicker(controller, context) {
    if (!controller || controller.__smirelIntegratedStarPickerV2Controller) return controller;

    const { THREE, camera, brightField, canvas, pointer, CONFIG } = context || {};
    const geometry = brightField?.geometry;
    const positions = geometry?.getAttribute?.('position');
    const brightness = geometry?.getAttribute?.('starBrightness');
    const scale = geometry?.getAttribute?.('starScale');
    if (!THREE || !camera || !canvas || !positions || !brightness) return controller;
    if (typeof controller.getSpatialAnchor !== 'function') {
      console.warn('[homepage-star-picker-v2] constellation runtime unavailable');
      return controller;
    }

    const catalog = Array.isArray(controller.catalog)
      ? controller.catalog
      : (window.__SMIREL_STELLAR_CATALOG__ || []);
    const objectById = new Map(catalog.map((item) => [item.id, item]));
    const fields = FIELD_ORDER
      .map((id) => objectById.get(id))
      .filter((item) => item?.kind === 'field' && item.constellation?.nodes?.length);
    if (!fields.length) return controller;

    const saved = readSaved();
    const savedSelections = saved?.selections && typeof saved.selections === 'object'
      ? saved.selections
      : {};

    const state = {
      active: false,
      activeFieldId: FIELD_ORDER.includes(saved?.activeFieldId) ? saved.activeFieldId : 'blog',
      activeSlotId: null,
      previewFieldId: null,
      hoveredIndex: -1,
      hoveredCandidate: null,
      mouseX: -1000,
      mouseY: -1000,
      drag: null,
      yaw: 0,
      pitch: 0,
      keys: new Set(),
      snapshotReady: false,
      candidates: [],
      projectedCandidateCount: 0,
      lockedMains: new Map(),
      originalSelections: new Map(),
      selections: new Map(),
      candidateBrightnessMin: 1.38,
      candidateDepthMin: 12,
      candidateDepthMax: 48,
      prePicker: null,
    };

    const scratchPosition = new THREE.Vector3();
    const scratchProjected = new THREE.Vector3();
    const scratchDirection = new THREE.Vector3();
    const scratchForward = new THREE.Vector3();
    const scratchRight = new THREE.Vector3();
    const scratchUp = new THREE.Vector3();
    const tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    function positionAt(index, out = new THREE.Vector3()) {
      return out.set(positions.getX(index), positions.getY(index), positions.getZ(index));
    }

    function fieldNodes(fieldId) {
      const field = objectById.get(fieldId);
      return (field?.constellation?.nodes || [])
        .map((id) => objectById.get(id))
        .filter(Boolean);
    }

    function fieldColor(fieldId) {
      return FIELD_COLORS[fieldId] || '#d8efff';
    }

    function validIndex(index) {
      return Number.isInteger(index) && index >= 0 && index < positions.count;
    }

    function buildCandidatePool() {
      const bins = new Map();
      const azimuthBins = 16;
      const elevationBins = 8;
      const depthBins = 3;
      const depthSpan = state.candidateDepthMax - state.candidateDepthMin;

      for (let i = 0; i < positions.count; i += 1) {
        const b = brightness.getX(i);
        if (b < state.candidateBrightnessMin) continue;

        positionAt(i, scratchPosition);
        const depth = -scratchPosition.z;
        if (depth < state.candidateDepthMin || depth > state.candidateDepthMax) continue;

        const radius = scratchPosition.length();
        if (radius < 1e-4) continue;

        const azimuth = Math.atan2(scratchPosition.x, -scratchPosition.z);
        const elevation = Math.asin(clamp(scratchPosition.y / radius, -1, 1));
        const az = clamp(
          Math.floor(((azimuth + Math.PI) / (Math.PI * 2)) * azimuthBins),
          0,
          azimuthBins - 1,
        );
        const el = clamp(
          Math.floor(((elevation + Math.PI * 0.5) / Math.PI) * elevationBins),
          0,
          elevationBins - 1,
        );
        const dz = clamp(
          Math.floor(
            ((depth - state.candidateDepthMin) / Math.max(depthSpan, 1e-4)) * depthBins,
          ),
          0,
          depthBins - 1,
        );

        const key = `${az}:${el}:${dz}`;
        const score = b * 1.45
          + (scale ? scale.getX(i) : 0) * 0.045
          - Math.abs(depth - 28) * 0.0025;
        const previous = bins.get(key);
        if (!previous || score > previous.score) {
          bins.set(key, { index: i, score, brightness: b, depth });
        }
      }

      const winners = [...bins.values()].sort((a, b) => b.score - a.score);
      const accepted = [];
      const acceptedDirections = [];
      const direction = new THREE.Vector3();
      const minDot = Math.cos(THREE.MathUtils.degToRad(2.8));

      for (const candidate of winners) {
        positionAt(candidate.index, direction).normalize();
        let tooClose = false;
        for (const previous of acceptedDirections) {
          if (direction.dot(previous) > minDot) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;
        accepted.push(candidate);
        acceptedDirections.push(direction.clone());
      }

      state.candidates = accepted;
    }

    buildCandidatePool();

    const style = document.createElement('style');
    style.dataset.smirelIntegratedStarPickerV2 = 'true';
    style.textContent = `
      .smirel-picker-v2-launch {
        position: fixed;
        right: 18px;
        top: 18px;
        z-index: 84;
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid rgba(205,228,255,.16);
        border-radius: 999px;
        background: rgba(5,8,12,.78);
        color: rgba(245,249,255,.86);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 12px 36px rgba(0,0,0,.28);
        font: 700 10px/1 ui-sans-serif,system-ui,sans-serif;
        letter-spacing: .11em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .smirel-picker-v2-launch i {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #718091;
        box-shadow: 0 0 0 4px rgba(150,200,255,.05);
      }
      body.smirel-star-picker-v2-active .smirel-picker-v2-launch i {
        background: #bfe8ff;
        box-shadow: 0 0 14px rgba(172,226,255,.65);
      }

      .smirel-picker-v2-overlay {
        position: fixed;
        inset: 0;
        z-index: 38;
        width: 100vw;
        height: 100vh;
        display: none;
        pointer-events: none;
        touch-action: none;
      }
      body.smirel-star-picker-v2-active .smirel-picker-v2-overlay {
        display: block;
        pointer-events: auto;
        cursor: crosshair;
      }
      body.smirel-star-picker-v2-active .smirel-picker-v2-overlay.is-dragging {
        cursor: grabbing;
      }

      .smirel-picker-v2-panel {
        position: fixed;
        right: 18px;
        top: 62px;
        bottom: 18px;
        z-index: 85;
        width: min(370px, calc(100vw - 36px));
        display: none;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(196,224,255,.16);
        border-radius: 18px;
        background: rgba(5,8,12,.89);
        color: rgba(240,246,252,.88);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        box-shadow: 0 24px 70px rgba(0,0,0,.48);
        font-family: ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      body.smirel-star-picker-v2-active .smirel-picker-v2-panel { display: flex; }
      .smirel-picker-v2-panel * { box-sizing: border-box; }

      .smirel-picker-v2-head {
        padding: 16px 17px 13px;
        border-bottom: 1px solid rgba(255,255,255,.08);
      }
      .smirel-picker-v2-head strong {
        display: block;
        color: #fff;
        font-size: 14px;
        letter-spacing: .02em;
      }
      .smirel-picker-v2-head p {
        margin: 6px 0 0;
        color: rgba(223,234,244,.48);
        font-size: 11px;
        line-height: 1.55;
      }

      .smirel-picker-v2-tabs {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,.07);
      }
      .smirel-picker-v2-tab {
        min-width: 0;
        padding: 9px 5px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 9px;
        background: rgba(255,255,255,.025);
        color: rgba(235,242,249,.54);
        font: 700 9px/1 ui-sans-serif,system-ui;
        letter-spacing: .06em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .smirel-picker-v2-tab.is-active {
        border-color: color-mix(in srgb, var(--field-color) 48%, transparent);
        color: #fff;
        background: color-mix(in srgb, var(--field-color) 9%, transparent);
      }

      .smirel-picker-v2-main-lock {
        margin: 0 12px 8px;
        padding: 10px 11px;
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .smirel-picker-v2-main-lock span {
        color: rgba(235,242,249,.58);
        font-size: 11px;
      }
      .smirel-picker-v2-main-lock b {
        color: #fff;
        font: 700 10px/1 ui-monospace,SFMono-Regular,Consolas,monospace;
      }

      .smirel-picker-v2-slots {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 0 12px 12px;
      }
      .smirel-picker-v2-slot {
        width: 100%;
        display: grid;
        grid-template-columns: 28px 1fr;
        gap: 9px;
        align-items: center;
        margin-top: 7px;
        padding: 10px;
        border: 1px solid rgba(255,255,255,.06);
        border-radius: 10px;
        background: rgba(255,255,255,.018);
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      .smirel-picker-v2-slot:hover {
        border-color: rgba(220,237,255,.14);
        background: rgba(255,255,255,.035);
      }
      .smirel-picker-v2-slot.is-active {
        border-color: color-mix(in srgb, var(--field-color) 55%, transparent);
        background: color-mix(in srgb, var(--field-color) 8%, transparent);
      }
      .smirel-picker-v2-slot em {
        display: grid;
        place-items: center;
        width: 26px;
        height: 26px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 50%;
        color: rgba(255,255,255,.50);
        font: 700 9px/1 ui-monospace,monospace;
        font-style: normal;
      }
      .smirel-picker-v2-slot strong {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: rgba(247,250,253,.82);
        font-size: 11px;
        font-weight: 650;
      }
      .smirel-picker-v2-slot small {
        display: block;
        margin-top: 4px;
        color: rgba(224,235,245,.38);
        font: 600 9px/1 ui-monospace,monospace;
      }

      .smirel-picker-v2-foot {
        padding: 11px 12px 13px;
        border-top: 1px solid rgba(255,255,255,.07);
      }
      .smirel-picker-v2-status {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 9px;
        color: rgba(226,237,246,.44);
        font: 600 9px/1.35 ui-monospace,monospace;
      }
      .smirel-picker-v2-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 7px;
      }
      .smirel-picker-v2-actions button {
        padding: 9px;
        border: 1px solid rgba(255,255,255,.09);
        border-radius: 9px;
        background: rgba(255,255,255,.025);
        color: rgba(245,249,253,.72);
        font: 650 10px/1 ui-sans-serif,system-ui;
        cursor: pointer;
      }
      .smirel-picker-v2-actions button:hover {
        background: rgba(255,255,255,.05);
        color: #fff;
      }
      .smirel-picker-v2-actions .primary {
        border-color: rgba(173,222,255,.25);
        background: rgba(123,192,235,.08);
        color: #e8f7ff;
      }

      .smirel-picker-v2-tip {
        position: fixed;
        z-index: 86;
        display: none;
        pointer-events: none;
        transform: translate(15px,15px);
        padding: 7px 9px;
        border: 1px solid rgba(218,237,255,.13);
        border-radius: 8px;
        background: rgba(3,6,10,.92);
        color: #fff;
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        white-space: nowrap;
        font: 650 9px/1.3 ui-monospace,monospace;
      }
      body.smirel-star-picker-v2-active .smirel-picker-v2-tip.is-visible {
        display: block;
      }

      body.smirel-star-picker-v2-active .home-index,
      body.smirel-star-picker-v2-active .home-intro,
      body.smirel-star-picker-v2-active .smirel-field-star,
      body.smirel-star-picker-v2-active .smirel-companion-star {
        pointer-events: none !important;
      }
      body.smirel-star-picker-v2-active {
        user-select: none;
      }
      body.smirel-star-picker-v2-active .smirel-picker-v2-panel,
      body.smirel-star-picker-v2-active .smirel-picker-v2-panel * {
        user-select: text;
      }

      @media (max-width: 820px) {
        .smirel-picker-v2-panel {
          width: min(330px, calc(100vw - 24px));
          right: 12px;
          top: 56px;
          bottom: 12px;
        }
        .smirel-picker-v2-launch {
          right: 12px;
          top: 12px;
        }
      }
    `;
    document.head.appendChild(style);

    const launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'smirel-picker-v2-launch';
    launch.innerHTML = '<i></i><span>选星器 OFF</span>';
    document.body.appendChild(launch);

    const overlay = document.createElement('canvas');
    overlay.className = 'smirel-picker-v2-overlay';
    document.body.appendChild(overlay);
    const overlayCtx = overlay.getContext('2d');

    const tip = document.createElement('div');
    tip.className = 'smirel-picker-v2-tip';
    document.body.appendChild(tip);

    const panel = document.createElement('aside');
    panel.className = 'smirel-picker-v2-panel';
    panel.setAttribute('aria-label', 'Homepage integrated star picker');
    panel.innerHTML = `
      <div class="smirel-picker-v2-head">
        <strong>在真实主页里选伴星</strong>
        <p>四颗主星锁定不动。先选择主星和伴星槽位，再直接在当前真实银河中找星。左拖旋转、右拖平移、滚轮前后移动。</p>
      </div>
      <div class="smirel-picker-v2-tabs"></div>
      <div class="smirel-picker-v2-main-lock"><span>当前主星（锁定）</span><b>等待解析…</b></div>
      <div class="smirel-picker-v2-slots"></div>
      <div class="smirel-picker-v2-foot">
        <div class="smirel-picker-v2-status">
          <span class="candidate-count">候选 —</span>
          <span class="slot-status">先选伴星槽位</span>
        </div>
        <div class="smirel-picker-v2-actions">
          <button type="button" data-action="reset-camera">重置视角</button>
          <button type="button" data-action="restore-field">恢复当前栏</button>
          <button type="button" data-action="copy-field">复制当前栏</button>
          <button type="button" class="primary" data-action="copy-all">复制 FIXED_INDICES</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const tabsRoot = panel.querySelector('.smirel-picker-v2-tabs');
    const slotsRoot = panel.querySelector('.smirel-picker-v2-slots');
    const mainLockEl = panel.querySelector('.smirel-picker-v2-main-lock b');
    const candidateCountEl = panel.querySelector('.candidate-count');
    const slotStatusEl = panel.querySelector('.slot-status');

    function persist() {
      writeSaved({
        activeFieldId: state.activeFieldId,
        selections: Object.fromEntries(state.selections.entries()),
      });
    }

    function showToast(message) {
      tip.textContent = message;
      const x = Number.isFinite(state.mouseX) ? state.mouseX : window.innerWidth * 0.5;
      const y = Number.isFinite(state.mouseY) ? state.mouseY : window.innerHeight * 0.5;
      tip.style.left = `${Math.max(12, Math.min(window.innerWidth - 280, x))}px`;
      tip.style.top = `${Math.max(12, Math.min(window.innerHeight - 80, y))}px`;
      tip.classList.add('is-visible');
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => {
        tip.classList.remove('is-visible');
        showToast.timer = 0;
      }, 1400);
    }

    function applyIndexToAnchor(objectId, index) {
      const object = objectById.get(objectId);
      if (!object || object.kind === 'field' || !validIndex(index)) return false;
      const anchor = controller.getSpatialAnchor(objectId);
      if (!anchor) return false;
      anchor.index = index;
      if (anchor.position?.copy) {
        anchor.position.copy(positionAt(index, scratchPosition));
      } else {
        anchor.position = positionAt(index).clone();
      }
      return true;
    }

    function ensureSnapshot() {
      if (state.snapshotReady) return true;

      controller.resolveSpatialAnchors?.(controller.getProjectionViewport?.());

      for (const field of fields) {
        if (!controller.getSpatialAnchor(field.id)) return false;
        for (const object of fieldNodes(field.id)) {
          if (!controller.getSpatialAnchor(object.id)) return false;
        }
      }

      const occupied = new Set();

      // Main stars are session-authoritative and are never loaded from storage or
      // mutated by the picker.
      for (const field of fields) {
        const anchor = controller.getSpatialAnchor(field.id);
        state.lockedMains.set(field.id, anchor.index);
        occupied.add(anchor.index);
      }

      for (const field of fields) {
        for (const object of fieldNodes(field.id)) {
          const anchor = controller.getSpatialAnchor(object.id);
          state.originalSelections.set(object.id, anchor.index);

          const savedIndex = savedSelections[object.id];
          let chosen = validIndex(savedIndex) && !occupied.has(savedIndex)
            ? savedIndex
            : anchor.index;

          if (occupied.has(chosen) && chosen !== anchor.index) chosen = anchor.index;
          state.selections.set(object.id, chosen);
          occupied.add(chosen);
          if (chosen !== anchor.index) applyIndexToAnchor(object.id, chosen);
        }
      }

      state.snapshotReady = true;
      persist();
      renderPanel();
      if (state.active) activateFieldPreview(state.activeFieldId);
      return true;
    }

    function renderPanel() {
      tabsRoot.innerHTML = '';
      for (const field of fields) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `smirel-picker-v2-tab${field.id === state.activeFieldId ? ' is-active' : ''}`;
        button.style.setProperty('--field-color', fieldColor(field.id));
        button.textContent = field.title;
        button.addEventListener('click', () => {
          if (field.id === state.activeFieldId) return;
          state.activeFieldId = field.id;
          state.activeSlotId = null;
          persist();
          renderPanel();
          activateFieldPreview(field.id);
        });
        tabsRoot.appendChild(button);
      }

      const mainIndex = state.lockedMains.get(state.activeFieldId);
      mainLockEl.textContent = validIndex(mainIndex) ? `#${mainIndex} · LOCKED` : '等待解析…';

      slotsRoot.innerHTML = '';
      const nodes = fieldNodes(state.activeFieldId);
      nodes.forEach((object, order) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `smirel-picker-v2-slot${state.activeSlotId === object.id ? ' is-active' : ''}`;
        button.style.setProperty('--field-color', fieldColor(state.activeFieldId));
        const index = state.selections.get(object.id);
        button.innerHTML = `
          <em>${String(order + 1).padStart(2, '0')}</em>
          <span>
            <strong>${object.navTitle || object.title || object.id}</strong>
            <small>${validIndex(index)
              ? `#${index} · B ${brightness.getX(index).toFixed(2)} · Z ${(-positions.getZ(index)).toFixed(1)}`
              : '等待星位解析'}</small>
          </span>
        `;
        button.addEventListener('click', () => {
          state.activeSlotId = object.id;
          renderPanel();
        });
        slotsRoot.appendChild(button);
      });

      candidateCountEl.textContent = `均匀明亮候选 ${state.candidates.length} · 当前视野 ${state.projectedCandidateCount}`;
      slotStatusEl.textContent = state.activeSlotId
        ? `正在选择：${objectById.get(state.activeSlotId)?.navTitle
          || objectById.get(state.activeSlotId)?.title
          || state.activeSlotId}`
        : '先选一个伴星槽位';
    }

    function updateCameraAnglesFromCurrent() {
      camera.getWorldDirection(scratchDirection);
      state.yaw = Math.atan2(scratchDirection.x, -scratchDirection.z);
      state.pitch = Math.asin(clamp(scratchDirection.y, -0.999, 0.999));
    }

    function capturePrePickerCamera() {
      state.prePicker = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        fov: camera.fov,
        pointer: pointer ? {
          targetX: pointer.targetX,
          targetY: pointer.targetY,
          currentX: pointer.currentX,
          currentY: pointer.currentY,
        } : null,
      };
    }

    function restorePrePickerCamera() {
      if (!state.prePicker) return;
      camera.position.copy(state.prePicker.position);
      camera.quaternion.copy(state.prePicker.quaternion);
      camera.fov = state.prePicker.fov;
      camera.updateProjectionMatrix();
      if (pointer && state.prePicker.pointer) {
        pointer.targetX = state.prePicker.pointer.targetX;
        pointer.targetY = state.prePicker.pointer.targetY;
        pointer.currentX = state.prePicker.pointer.currentX;
        pointer.currentY = state.prePicker.pointer.currentY;
      }
      state.prePicker = null;
    }

    function activateFieldPreview(fieldId) {
      if (!state.active || !state.snapshotReady) return;
      if (state.previewFieldId && state.previewFieldId !== fieldId) {
        controller.constellation?.setPersistentField?.(state.previewFieldId, false);
      }
      state.previewFieldId = fieldId;
      if (typeof controller.constellation?.setPersistentField === 'function') {
        controller.constellation.setPersistentField(fieldId, true);
      } else {
        controller.constellation?.open?.(fieldId, true);
      }
    }

    function setActive(active) {
      const next = Boolean(active);
      if (next === state.active) return;

      if (next) {
        capturePrePickerCamera();
        state.active = true;
        document.body.classList.add('smirel-star-picker-v2-active');
        launch.querySelector('span').textContent = '选星器 ON';
        controller.constellation?.close?.(true);
        ensureSnapshot();
        updateCameraAnglesFromCurrent();
        state.activeSlotId = null;
        activateFieldPreview(state.activeFieldId);
        renderPanel();
      } else {
        if (state.previewFieldId) {
          controller.constellation?.setPersistentField?.(state.previewFieldId, false);
        }
        state.previewFieldId = null;
        state.active = false;
        state.activeSlotId = null;
        state.drag = null;
        state.keys.clear();
        state.hoveredIndex = -1;
        state.hoveredCandidate = null;
        overlay.classList.remove('is-dragging');
        tip.classList.remove('is-visible');
        document.body.classList.remove('smirel-star-picker-v2-active');
        launch.querySelector('span').textContent = '选星器 OFF';
        restorePrePickerCamera();
        renderPanel();
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
      const reserved = new Set(state.lockedMains.values());
      for (const [id, index] of state.selections) {
        if (id !== state.activeSlotId && validIndex(index)) reserved.add(index);
      }
      return reserved;
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
      if (!state.active) return;

      const color = fieldColor(state.activeFieldId);
      const reserved = reservedIndices();
      let nearest = null;
      let nearestDistance = 26;
      let visibleCount = 0;

      overlayCtx.save();
      overlayCtx.lineWidth = 1;

      for (const candidate of state.candidates) {
        if (reserved.has(candidate.index)) continue;
        const p = projectIndex(candidate.index, width, height, {});
        if (!p.visible) continue;
        visibleCount += 1;

        const distance = Math.hypot(p.x - state.mouseX, p.y - state.mouseY);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = { ...candidate, ...p };
        }

        const alpha = clamp(
          0.10 + (candidate.brightness - state.candidateBrightnessMin) * 0.11,
          0.10,
          0.25,
        );
        overlayCtx.strokeStyle = `rgba(210,235,255,${alpha.toFixed(3)})`;
        overlayCtx.beginPath();
        overlayCtx.arc(p.x, p.y, 4.8, 0, Math.PI * 2);
        overlayCtx.stroke();
      }

      state.projectedCandidateCount = visibleCount;

      const mainIndex = state.lockedMains.get(state.activeFieldId);
      if (validIndex(mainIndex)) {
        const main = projectIndex(mainIndex, width, height, {});
        if (main.visible) {
          overlayCtx.strokeStyle = color;
          overlayCtx.globalAlpha = 0.82;
          overlayCtx.lineWidth = 1.25;
          overlayCtx.beginPath();
          overlayCtx.arc(main.x, main.y, 20, 0, Math.PI * 2);
          overlayCtx.stroke();
          overlayCtx.globalAlpha = 1;
        }
      }

      const selectedIndex = state.activeSlotId
        ? state.selections.get(state.activeSlotId)
        : null;
      if (validIndex(selectedIndex)) {
        const selected = projectIndex(selectedIndex, width, height, {});
        if (selected.visible) {
          overlayCtx.strokeStyle = color;
          overlayCtx.lineWidth = 1.5;
          overlayCtx.beginPath();
          overlayCtx.arc(selected.x, selected.y, 13, 0, Math.PI * 2);
          overlayCtx.stroke();
        }
      }

      state.hoveredIndex = nearest?.index ?? -1;
      state.hoveredCandidate = nearest;

      if (nearest) {
        overlayCtx.strokeStyle = '#ffffff';
        overlayCtx.shadowColor = color;
        overlayCtx.shadowBlur = 16;
        overlayCtx.lineWidth = 1.6;
        overlayCtx.beginPath();
        overlayCtx.arc(nearest.x, nearest.y, 14, 0, Math.PI * 2);
        overlayCtx.stroke();
        overlayCtx.shadowBlur = 0;

        overlayCtx.beginPath();
        overlayCtx.moveTo(nearest.x - 20, nearest.y);
        overlayCtx.lineTo(nearest.x - 11, nearest.y);
        overlayCtx.moveTo(nearest.x + 11, nearest.y);
        overlayCtx.lineTo(nearest.x + 20, nearest.y);
        overlayCtx.moveTo(nearest.x, nearest.y - 20);
        overlayCtx.lineTo(nearest.x, nearest.y - 11);
        overlayCtx.moveTo(nearest.x, nearest.y + 11);
        overlayCtx.lineTo(nearest.x, nearest.y + 20);
        overlayCtx.stroke();

        tip.textContent = `#${nearest.index} · 亮度 ${nearest.brightness.toFixed(2)} · 深度 ${nearest.depth.toFixed(1)}`;
        tip.style.left = `${state.mouseX}px`;
        tip.style.top = `${state.mouseY}px`;
        tip.classList.add('is-visible');
      } else if (!showToast.timer) {
        tip.classList.remove('is-visible');
      }

      overlayCtx.restore();

      if (drawOverlay.lastVisibleCount !== visibleCount) {
        drawOverlay.lastVisibleCount = visibleCount;
        candidateCountEl.textContent = `均匀明亮候选 ${state.candidates.length} · 当前视野 ${visibleCount}`;
      }
    }

    function assignHovered() {
      if (!state.activeSlotId) {
        showToast('先在右侧选择一个伴星槽位');
        return;
      }
      if (!validIndex(state.hoveredIndex)) return;

      const duplicate = [...state.selections.entries()]
        .find(([id, index]) => id !== state.activeSlotId && index === state.hoveredIndex);
      if (duplicate) {
        showToast('这颗星已经被另一个伴星使用');
        return;
      }
      if ([...state.lockedMains.values()].includes(state.hoveredIndex)) {
        showToast('主星已锁定，不能作为伴星');
        return;
      }

      if (!applyIndexToAnchor(state.activeSlotId, state.hoveredIndex)) {
        showToast('真实星座锚点尚未准备好');
        return;
      }

      state.selections.set(state.activeSlotId, state.hoveredIndex);
      persist();
      activateFieldPreview(state.activeFieldId);
      renderPanel();
      showToast(`已实时绑定 #${state.hoveredIndex}`);
    }

    overlay.addEventListener('pointerdown', (event) => {
      if (!state.active || (event.button !== 0 && event.button !== 2)) return;
      event.preventDefault();
      state.drag = {
        button: event.button,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      overlay.setPointerCapture?.(event.pointerId);
      overlay.classList.add('is-dragging');
    });

    overlay.addEventListener('pointermove', (event) => {
      state.mouseX = event.clientX;
      state.mouseY = event.clientY;
      if (!state.drag) return;

      const dx = event.clientX - state.drag.x;
      const dy = event.clientY - state.drag.y;
      if (Math.hypot(
        event.clientX - state.drag.startX,
        event.clientY - state.drag.startY,
      ) > 4) {
        state.drag.moved = true;
      }
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
        const move = 0.014
          * clamp(Math.abs(camera.position.z) * 0.08 + 1, 1, 3.5);
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

    overlay.addEventListener('pointercancel', () => {
      state.drag = null;
      overlay.classList.remove('is-dragging');
    });

    overlay.addEventListener('contextmenu', (event) => event.preventDefault());

    overlay.addEventListener('wheel', (event) => {
      if (!state.active) return;
      event.preventDefault();
      camera.getWorldDirection(scratchForward);
      camera.position.addScaledVector(
        scratchForward,
        clamp(event.deltaY * 0.010, -5, 5),
      );
    }, { passive: false });

    window.addEventListener('keydown', (event) => {
      if (event.shiftKey && event.key.toLowerCase() === 'p') {
        setActive(!state.active);
        event.preventDefault();
        return;
      }
      if (!state.active) return;
      if (event.target instanceof HTMLInputElement
          || event.target instanceof HTMLTextAreaElement) return;

      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
        state.keys.add(key);
        event.preventDefault();
      }
      if (event.key === 'Escape') setActive(false);
    });

    window.addEventListener('keyup', (event) => {
      state.keys.delete(event.key.toLowerCase());
    });

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

    function fixedIndexEntries(fieldId = null) {
      const selectedFields = fieldId
        ? fields.filter((field) => field.id === fieldId)
        : fields;
      const entries = [];

      for (const field of selectedFields) {
        const mainIndex = state.lockedMains.get(field.id);
        if (validIndex(mainIndex)) entries.push([field.id, mainIndex]);
        for (const object of fieldNodes(field.id)) {
          const index = state.selections.get(object.id);
          if (validIndex(index)) entries.push([object.id, index]);
        }
      }
      return entries;
    }

    function exportFixedIndices(fieldId = null) {
      const lines = fixedIndexEntries(fieldId)
        .map(([id, index]) => `  ${JSON.stringify(id)}: ${index},`);
      return [
        'const FIXED_INDICES = Object.freeze({',
        ...lines,
        '});',
      ].join('\n');
    }

    function restoreField(fieldId) {
      for (const object of fieldNodes(fieldId)) {
        const original = state.originalSelections.get(object.id);
        if (!validIndex(original)) continue;
        applyIndexToAnchor(object.id, original);
        state.selections.set(object.id, original);
      }
      persist();
      activateFieldPreview(fieldId);
      renderPanel();
      showToast('已恢复当前栏进入选星器时的星位');
    }

    panel.addEventListener('pointerenter', () => {
      state.mouseX = -1000;
      state.mouseY = -1000;
      if (!showToast.timer) tip.classList.remove('is-visible');
    });

    panel.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      if (action === 'reset-camera') {
        camera.position.set(0, 0, 0);
        camera.lookAt(0, 0, -12);
        camera.fov = CONFIG?.fov || 55;
        camera.updateProjectionMatrix();
        updateCameraAnglesFromCurrent();
      }
      if (action === 'restore-field') restoreField(state.activeFieldId);
      if (action === 'copy-field') {
        copyText(exportFixedIndices(state.activeFieldId));
      }
      if (action === 'copy-all') {
        copyText(exportFixedIndices());
      }
    });

    const baseUpdate = typeof controller.update === 'function'
      ? controller.update.bind(controller)
      : () => false;

    const needsDescriptor = Object.getOwnPropertyDescriptor(
      controller,
      'needsContinuousRender',
    );
    const baseNeedsContinuous = needsDescriptor?.get
      ? needsDescriptor.get.bind(controller)
      : () => Boolean(needsDescriptor?.value);

    controller.update = (now, dt, elapsed) => {
      if (state.active) applyPickerCamera(dt);
      const ownsCamera = baseUpdate(now, dt, elapsed);

      if (!state.snapshotReady) ensureSnapshot();
      if (state.active) {
        applyPickerCamera(dt);
        activateFieldPreview(state.activeFieldId);
        drawOverlay();
      }

      return state.active ? true : ownsCamera;
    };

    Object.defineProperty(controller, 'needsContinuousRender', {
      configurable: true,
      enumerable: true,
      get() {
        return state.active || baseNeedsContinuous();
      },
    });

    controller.starPicker = {
      get active() { return state.active; },
      get activeFieldId() { return state.activeFieldId; },
      get activeSlotId() { return state.activeSlotId; },
      get candidates() { return state.candidates; },
      get selections() { return new Map(state.selections); },
      get lockedMains() { return new Map(state.lockedMains); },
      setActive,
      exportFixedIndices,
    };

    controller.__smirelIntegratedStarPickerV2Controller = true;

    renderPanel();
    setActive(true);
    return controller;
  }

  const pickerInstall = function integratedStarPickerV2Install(context) {
    const controller = baseInstall(context);
    return installPicker(controller, context);
  };

  pickerInstall.__smirelIntegratedStarPickerV2 = true;
  window[INSTALL_KEY] = pickerInstall;
})();
