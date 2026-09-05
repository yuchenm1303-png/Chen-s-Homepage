(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelConstellations) return;

  const constellationInstall = function installConstellations(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, camera, brightField } = context || {};
    if (!THREE || !camera || !brightField?.geometry) return controller;

    const catalog = Array.isArray(controller.catalog)
      ? controller.catalog
      : (window.__SMIREL_STELLAR_CATALOG__ || []);
    const positions = brightField.geometry.getAttribute('position');
    const brightness = brightField.geometry.getAttribute('starBrightness');
    const colors = brightField.geometry.getAttribute('starColor');
    if (!positions || !brightness || !colors) return controller;

    const fields = catalog.filter((item) => item.kind === 'field' && item.constellation?.nodes?.length);
    if (!fields.length) return controller;

    const objectById = new Map(catalog.map((item) => [item.id, item]));
    const spatialAnchors = new Map();
    const projected = new Map();
    const fieldButtons = new Map();
    const companionButtons = new Map();
    const edgeElements = new Map();

    let anchorsResolved = false;
    let openFieldId = null;
    let persistentFieldId = null;
    let closeTimer = 0;

    const scratch = {
      world: new THREE.Vector3(),
      projected: new THREE.Vector3(),
      candidateColor: new THREE.Color(),
      targetColor: new THREE.Color(),
    };

    const style = document.createElement('style');
    style.dataset.smirelConstellation = 'true';
    style.textContent = `
      /* The old per-project anchor UI is intentionally suppressed. The four field
         stars below are now the only primary navigation objects in the galaxy. */
      .smirel-star-anchor { display: none !important; }

      .smirel-field-star {
        --field-color: #d8efff;
        position: fixed;
        left: 0;
        top: 0;
        z-index: 9;
        width: 76px;
        height: 76px;
        margin: -38px 0 0 -38px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: rgba(247,250,255,.96);
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transition: opacity .30s ease;
      }
      .smirel-field-star::before {
        content: '';
        position: absolute;
        inset: 17px;
        border: 1px solid color-mix(in srgb, var(--field-color) 48%, transparent);
        border-radius: inherit;
        transform: scale(.82);
        box-shadow:
          0 0 20px color-mix(in srgb, var(--field-color) 13%, transparent),
          inset 0 0 12px rgba(255,255,255,.055);
        transition:
          transform .34s cubic-bezier(.2,.8,.2,1),
          border-color .25s ease,
          box-shadow .25s ease;
      }
      .smirel-field-star::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 4px;
        height: 4px;
        margin: -2px 0 0 -2px;
        border-radius: 50%;
        background: var(--field-color);
        box-shadow: 0 0 12px var(--field-color), 0 0 28px color-mix(in srgb, var(--field-color) 38%, transparent);
      }
      .smirel-field-star:hover::before,
      .smirel-field-star:focus-visible::before,
      .smirel-field-star.is-preview::before {
        transform: scale(1);
        border-color: color-mix(in srgb, var(--field-color) 86%, white 14%);
        box-shadow:
          0 0 30px color-mix(in srgb, var(--field-color) 24%, transparent),
          inset 0 0 15px rgba(255,255,255,.09);
      }
      .smirel-field-star__label {
        position: absolute;
        left: 61px;
        top: 25px;
        display: flex;
        align-items: baseline;
        gap: 9px;
        white-space: nowrap;
        text-align: left;
        text-shadow: 0 1px 12px #000, 0 0 22px #000;
      }
      .smirel-field-star__label strong {
        color: rgba(248,250,255,.82);
        font: 680 10px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .13em;
        text-transform: uppercase;
        transition: color .2s ease, opacity .2s ease;
      }
      .smirel-field-star__label small {
        color: rgba(255,255,255,.34);
        font: 650 8px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .smirel-field-star:hover .smirel-field-star__label strong,
      .smirel-field-star:focus-visible .smirel-field-star__label strong,
      .smirel-field-star.is-preview .smirel-field-star__label strong {
        color: rgba(255,255,255,.98);
      }

      .smirel-constellation-map {
        position: fixed;
        inset: 0;
        z-index: 7;
        width: 100vw;
        height: 100vh;
        overflow: visible;
        pointer-events: none;
      }
      .smirel-constellation-edge {
        --edge-delay: 0ms;
        vector-effect: non-scaling-stroke;
        stroke: rgba(187,219,251,.27);
        stroke-width: .78;
        stroke-linecap: round;
        fill: none;
        opacity: 0;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        filter: drop-shadow(0 0 4px rgba(170,216,255,.12));
        transition:
          opacity .18s ease var(--edge-delay),
          stroke-dashoffset .46s cubic-bezier(.22,.61,.36,1) var(--edge-delay);
      }
      .smirel-constellation-edge.is-open {
        opacity: 1;
        stroke-dashoffset: 0;
      }
      body.star-field-open .smirel-constellation-edge.is-open,
      body.star-field-transition .smirel-constellation-edge.is-open {
        stroke: rgba(197,227,255,.40);
        stroke-width: .92;
      }

      .smirel-companion-star {
        --companion-color: #d8efff;
        --companion-delay: 0ms;
        position: fixed;
        left: 0;
        top: 0;
        z-index: 9;
        width: 42px;
        height: 42px;
        margin: -21px 0 0 -21px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: rgba(245,249,255,.94);
        opacity: 0;
        pointer-events: none;
        cursor: pointer;
        transition: opacity .22s ease var(--companion-delay);
      }
      .smirel-companion-star::before {
        content: '';
        position: absolute;
        inset: 12px;
        border: 1px solid color-mix(in srgb, var(--companion-color) 42%, transparent);
        border-radius: 50%;
        transform: scale(.58);
        box-shadow: 0 0 12px color-mix(in srgb, var(--companion-color) 13%, transparent);
        transition:
          transform .38s cubic-bezier(.2,.8,.2,1),
          border-color .22s ease,
          box-shadow .22s ease;
      }
      .smirel-companion-star::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 3px;
        height: 3px;
        margin: -1.5px 0 0 -1.5px;
        border-radius: 50%;
        background: var(--companion-color);
        box-shadow: 0 0 9px var(--companion-color);
      }
      .smirel-companion-star.is-open {
        opacity: 1;
        pointer-events: auto;
      }
      .smirel-companion-star.is-open::before { transform: scale(1); }
      .smirel-companion-star.is-static { cursor: default; }
      .smirel-companion-star.is-static.is-open { pointer-events: none; }
      .smirel-companion-star:hover::before,
      .smirel-companion-star:focus-visible::before {
        border-color: color-mix(in srgb, var(--companion-color) 84%, white 16%);
        box-shadow: 0 0 22px color-mix(in srgb, var(--companion-color) 28%, transparent);
      }
      .smirel-companion-label {
        position: absolute;
        left: 36px;
        top: 11px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: max-content;
        max-width: 260px;
        text-align: left;
        white-space: nowrap;
        text-shadow: 0 1px 10px #000, 0 0 18px #000;
        opacity: .68;
        transform: translateX(-4px);
        transition: opacity .2s ease, transform .2s ease;
      }
      .smirel-companion-star.is-open .smirel-companion-label { transform: translateX(0); }
      .smirel-companion-star:hover .smirel-companion-label,
      .smirel-companion-star:focus-visible .smirel-companion-label,
      body.star-field-open .smirel-companion-label { opacity: .94; }
      .smirel-companion-label strong {
        overflow: hidden;
        max-width: 250px;
        text-overflow: ellipsis;
        color: rgba(248,251,255,.90);
        font: 630 9px/1.05 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .085em;
        text-transform: uppercase;
      }
      .smirel-companion-label small {
        color: rgba(255,255,255,.40);
        font: 560 7.5px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .10em;
        text-transform: uppercase;
      }

      body.star-flight-active .smirel-field-star,
      body.star-flight-active .smirel-constellation-map,
      body.star-flight-active .smirel-companion-star {
        opacity: 0 !important;
        pointer-events: none !important;
      }
      body.star-field-open .smirel-field-star,
      body.star-field-transition .smirel-field-star {
        opacity: 0 !important;
        pointer-events: none !important;
      }
      body.star-field-transition .smirel-companion-star {
        pointer-events: none !important;
      }

      @media (max-width: 760px) {
        .smirel-field-star { width: 64px; height: 64px; margin: -32px 0 0 -32px; }
        .smirel-field-star__label { left: 51px; top: 21px; }
        .smirel-field-star__label strong { font-size: 9px; }
        .smirel-companion-label strong { font-size: 8px; max-width: 180px; }
        .smirel-companion-label small { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        .smirel-field-star,
        .smirel-field-star::before,
        .smirel-constellation-edge,
        .smirel-companion-star,
        .smirel-companion-star::before,
        .smirel-companion-label {
          transition-duration: .01ms !important;
          transition-delay: 0ms !important;
        }
      }
    `;
    document.head.appendChild(style);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('smirel-constellation-map');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', `0 0 ${Math.max(window.innerWidth, 1)} ${Math.max(window.innerHeight, 1)}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    document.body.appendChild(svg);

    function pointInsideExpandedRect(x, y, rect, margin) {
      if (!rect) return false;
      return x >= rect.left - margin && x <= rect.right + margin
        && y >= rect.top - margin && y <= rect.bottom + margin;
    }

    function resetCompanionPresentation(button, clearTransform = false) {
      if (!button) return;
      button.style.opacity = '';
      button.style.pointerEvents = '';
      if (clearTransform) button.style.transform = '';
    }

    function resetEdgePresentation(line) {
      if (!line) return;
      line.style.opacity = '';
    }

    /* Keep this resolver byte-for-byte equivalent in behavior to the base flight
       resolver. That makes a DOM constellation node and the star that openObject()
       later approaches the same bright-field point, not two visually similar stars. */
    function resolveSpatialAnchors() {
      if (anchorsResolved || camera.aspect <= 0) return;

      const introRect = document.querySelector('.home-intro')?.getBoundingClientRect() || null;
      const indexRect = document.querySelector('.home-index')?.getBoundingClientRect() || null;
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      const usedAnchorIndices = new Set();
      const chosenProjected = [];

      for (const object of catalog) {
        const target = object.star?.target || [0, 0];
        const depthRange = object.star?.depth || [13, 38];
        const requestedBrightness = object.star?.minBrightness ?? 1.8;
        const brightnessPasses = [requestedBrightness, Math.max(1.35, requestedBrightness - 0.55), 1.05];
        scratch.targetColor.set(object.star?.tint || '#d8efff');

        let bestIndex = -1;
        let bestScore = -Infinity;
        let bestProjectedX = 0;
        let bestProjectedY = 0;

        for (const minBrightness of brightnessPasses) {
          for (let i = 0; i < positions.count; i += 1) {
            if (usedAnchorIndices.has(i)) continue;
            const b = brightness.getX(i);
            if (b < minBrightness) continue;

            scratch.world.fromBufferAttribute(positions, i);
            const depth = -scratch.world.z;
            if (depth < depthRange[0] || depth > depthRange[1]) continue;

            scratch.projected.copy(scratch.world).project(camera);
            if (scratch.projected.z < -1 || scratch.projected.z > 1) continue;
            if (Math.abs(scratch.projected.x) > 0.86 || Math.abs(scratch.projected.y) > 0.82) continue;

            const screenX = (scratch.projected.x * 0.5 + 0.5) * viewportWidth;
            const screenY = (-scratch.projected.y * 0.5 + 0.5) * viewportHeight;
            if (pointInsideExpandedRect(screenX, screenY, introRect, 42)) continue;
            if (pointInsideExpandedRect(screenX, screenY, indexRect, 34)) continue;

            let tooClose = false;
            for (const previous of chosenProjected) {
              const px = scratch.projected.x - previous.x;
              const py = scratch.projected.y - previous.y;
              if (px * px + py * py < 0.0225) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) continue;

            scratch.candidateColor.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));
            const colorDistance = Math.sqrt(
              (scratch.candidateColor.r - scratch.targetColor.r) ** 2
              + (scratch.candidateColor.g - scratch.targetColor.g) ** 2
              + (scratch.candidateColor.b - scratch.targetColor.b) ** 2
            );
            const dx = scratch.projected.x - target[0];
            const dy = scratch.projected.y - target[1];
            const positionPenalty = Math.sqrt(dx * dx + dy * dy);
            const depthCentre = (depthRange[0] + depthRange[1]) * 0.5;
            const depthPenalty = Math.abs(depth - depthCentre) / Math.max(depthRange[1] - depthRange[0], 1);
            const score = b * 0.40 - positionPenalty * 3.55 - colorDistance * 0.70 - depthPenalty * 0.18;

            if (score > bestScore) {
              bestScore = score;
              bestIndex = i;
              bestProjectedX = scratch.projected.x;
              bestProjectedY = scratch.projected.y;
            }
          }
          if (bestIndex >= 0) break;
        }

        if (bestIndex < 0) continue;
        spatialAnchors.set(object.id, {
          object,
          index: bestIndex,
          position: new THREE.Vector3().fromBufferAttribute(positions, bestIndex),
        });
        usedAnchorIndices.add(bestIndex);
        chosenProjected.push({ x: bestProjectedX, y: bestProjectedY });
      }

      anchorsResolved = true;
      buildOverlayObjects();
    }

    function companionMeta(object) {
      if (object.kind === 'contact') return object.action?.label || 'Contact';
      if (object.kind === 'profile') return object.meta?.[0] || 'Profile';
      const category = object.meta?.[0] || (object.kind === 'note' ? 'Article' : 'Project');
      return object.date ? `${category} · ${object.date}` : category;
    }

    function fieldLabel(field) {
      return `<span class="smirel-field-star__label"><strong>${field.title}</strong><small>${field.order}</small></span>`;
    }

    function createFieldButton(field) {
      if (fieldButtons.has(field.id)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'smirel-field-star';
      button.dataset.fieldId = field.id;
      button.style.setProperty('--field-color', field.star?.tint || '#d8efff');
      button.setAttribute('aria-label', `Open ${field.title} field`);
      button.innerHTML = fieldLabel(field);
      button.addEventListener('pointerenter', () => openConstellation(field.id, false));
      button.addEventListener('pointerleave', scheduleClose);
      button.addEventListener('focusin', () => openConstellation(field.id, false));
      button.addEventListener('focusout', scheduleClose);
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        cancelScheduledClose();
        if (typeof controller.openField === 'function') {
          controller.openField(field.id);
        } else {
          window.dispatchEvent(new CustomEvent('smirel:field-request', { detail: { fieldId: field.id } }));
        }
      });
      document.body.appendChild(button);
      fieldButtons.set(field.id, button);
    }

    function createCompanionButton(field, object, index) {
      if (companionButtons.has(object.id)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'smirel-companion-star';
      button.dataset.companionId = object.id;
      button.dataset.parentField = field.id;
      button.style.setProperty('--companion-color', object.star?.tint || field.star?.tint || '#d8efff');
      button.style.setProperty('--companion-delay', `${Math.min(index * 38, 220)}ms`);
      button.setAttribute('aria-label', object.interactive === false ? object.title : `Open ${object.title}`);
      button.innerHTML = `
        <span class="smirel-companion-label">
          <strong>${object.navTitle || object.title}</strong>
          <small>${companionMeta(object)}</small>
        </span>
      `;

      if (object.interactive === false) {
        button.classList.add('is-static');
        button.tabIndex = -1;
      } else {
        button.addEventListener('pointerenter', cancelScheduledClose);
        button.addEventListener('pointerleave', scheduleClose);
        button.addEventListener('focusin', cancelScheduledClose);
        button.addEventListener('focusout', scheduleClose);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          cancelScheduledClose();

          if (object.kind === 'contact' && object.action?.href) {
            if (object.action.external) {
              window.open(object.action.href, '_blank', 'noopener,noreferrer');
            } else {
              window.location.href = object.action.href;
            }
            return;
          }

          if (!persistentFieldId) closeConstellation(true);
          controller.openObject?.(object.id);
        });
      }

      document.body.appendChild(button);
      companionButtons.set(object.id, button);
    }

    function edgeKey(fieldId, edge, index) {
      return `${fieldId}:${edge[0]}:${edge[1]}:${index}`;
    }

    function createEdges(field) {
      const edges = field.constellation?.edges || [];
      edges.forEach((edge, index) => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('smirel-constellation-edge');
        line.setAttribute('pathLength', '1');
        line.dataset.parentField = field.id;
        line.dataset.fromStar = edge[0];
        line.dataset.toStar = edge[1];
        line.style.setProperty('--edge-delay', `${Math.min(index * 42, 260)}ms`);
        svg.appendChild(line);
        edgeElements.set(edgeKey(field.id, edge, index), line);
      });
    }

    function buildOverlayObjects() {
      for (const field of fields) {
        if (!spatialAnchors.has(field.id)) continue;
        createFieldButton(field);
        const nodes = field.constellation?.nodes || [];
        nodes.forEach((id, index) => {
          const object = objectById.get(id);
          if (object && spatialAnchors.has(id)) createCompanionButton(field, object, index);
        });
        createEdges(field);
      }
    }

    function cancelScheduledClose() {
      if (!closeTimer) return;
      clearTimeout(closeTimer);
      closeTimer = 0;
    }

    function scheduleClose() {
      if (persistentFieldId) return;
      cancelScheduledClose();
      closeTimer = setTimeout(() => {
        closeTimer = 0;
        closeConstellation(false);
      }, 180);
    }

    function setFieldPreviewClass(fieldId, open) {
      fieldButtons.get(fieldId)?.classList.toggle('is-preview', open);
    }

    function openConstellation(fieldId, persistent = false) {
      const field = objectById.get(fieldId);
      if (!field?.constellation) return false;
      if (document.body.classList.contains('star-flight-active')) return false;
      cancelScheduledClose();

      if (openFieldId && openFieldId !== fieldId) closeConstellation(true, false);
      openFieldId = fieldId;
      if (persistent) persistentFieldId = fieldId;
      setFieldPreviewClass(fieldId, true);

      const nodeIds = new Set(field.constellation.nodes || []);
      for (const [id, button] of companionButtons) {
        const shouldOpen = nodeIds.has(id);
        resetCompanionPresentation(button);
        button.classList.toggle('is-open', shouldOpen);
      }

      for (const [key, line] of edgeElements) {
        resetEdgePresentation(line);
        line.classList.toggle('is-open', key.startsWith(`${fieldId}:`));
      }
      return true;
    }

    function closeConstellation(force = false, clearPersistent = true) {
      if (persistentFieldId && !force) return false;
      cancelScheduledClose();
      if (openFieldId) setFieldPreviewClass(openFieldId, false);
      for (const button of companionButtons.values()) {
        button.classList.remove('is-open');
        resetCompanionPresentation(button);
      }
      for (const line of edgeElements.values()) {
        line.classList.remove('is-open');
        resetEdgePresentation(line);
      }
      projected.clear();
      openFieldId = null;
      if (force && clearPersistent) persistentFieldId = null;
      return true;
    }

    function setPersistentField(fieldId, persistent) {
      if (!persistent) {
        if (persistentFieldId === fieldId) persistentFieldId = null;
        if (openFieldId === fieldId) closeConstellation(true, false);
        return true;
      }
      persistentFieldId = fieldId;
      return openConstellation(fieldId, true);
    }

    function projectAnchor(id) {
      const anchor = spatialAnchors.get(id);
      if (!anchor) return null;
      scratch.projected.copy(anchor.position).project(camera);
      const visible = scratch.projected.z >= -1 && scratch.projected.z <= 1
        && Math.abs(scratch.projected.x) <= 1.20
        && Math.abs(scratch.projected.y) <= 1.20;
      if (!visible) {
        projected.delete(id);
        return null;
      }
      const point = {
        x: (scratch.projected.x * 0.5 + 0.5) * window.innerWidth,
        y: (-scratch.projected.y * 0.5 + 0.5) * window.innerHeight,
      };
      projected.set(id, point);
      return point;
    }

    function updateFieldButtons() {
      const suppress = document.body.classList.contains('star-flight-active')
        || document.body.classList.contains('star-field-open')
        || document.body.classList.contains('star-field-transition');

      for (const field of fields) {
        const button = fieldButtons.get(field.id);
        if (!button) continue;
        if (suppress) {
          button.style.opacity = '0';
          button.style.pointerEvents = 'none';
          continue;
        }
        const point = projectAnchor(field.id);
        if (!point) {
          button.style.opacity = '0';
          button.style.pointerEvents = 'none';
          continue;
        }
        button.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
      }
    }

    function updateCompanionsAndEdges() {
      if (!openFieldId) {
        for (const button of companionButtons.values()) resetCompanionPresentation(button);
        for (const line of edgeElements.values()) resetEdgePresentation(line);
        projected.clear();
        return;
      }

      const field = objectById.get(openFieldId);
      if (!field?.constellation) return;

      const mapHidden = document.body.classList.contains('star-flight-active');
      const nodeIds = field.constellation.nodes || [];
      const activeNodes = new Set(nodeIds);

      for (const [id, button] of companionButtons) {
        if (!activeNodes.has(id)) resetCompanionPresentation(button);
      }

      projectAnchor(field.id);
      for (const id of nodeIds) {
        const point = projectAnchor(id);
        const button = companionButtons.get(id);
        if (!button) continue;
        if (!point || mapHidden) {
          button.style.opacity = '0';
          button.style.pointerEvents = 'none';
          continue;
        }
        button.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
        if (button.classList.contains('is-open')) {
          button.style.opacity = '';
          button.style.pointerEvents = '';
        }
      }

      const edges = field.constellation.edges || [];
      const activeEdgeKeys = new Set();
      edges.forEach((edge, index) => {
        const key = edgeKey(field.id, edge, index);
        activeEdgeKeys.add(key);
        const line = edgeElements.get(key);
        if (!line) return;
        const from = projected.get(edge[0]) || projectAnchor(edge[0]);
        const to = projected.get(edge[1]) || projectAnchor(edge[1]);
        if (!from || !to || mapHidden) {
          line.style.opacity = '0';
          return;
        }
        line.setAttribute('x1', from.x.toFixed(2));
        line.setAttribute('y1', from.y.toFixed(2));
        line.setAttribute('x2', to.x.toFixed(2));
        line.setAttribute('y2', to.y.toFixed(2));
        line.style.opacity = '';
      });

      for (const [key, line] of edgeElements) {
        if (!activeEdgeKeys.has(key)) resetEdgePresentation(line);
      }
    }

    window.addEventListener('resize', () => {
      svg.setAttribute('viewBox', `0 0 ${Math.max(window.innerWidth, 1)} ${Math.max(window.innerHeight, 1)}`);
    }, { passive: true });

    controller.resolveSpatialAnchors = resolveSpatialAnchors;
    controller.getSpatialAnchor = (objectId) => spatialAnchors.get(objectId) || null;
    controller.constellation = {
      open: openConstellation,
      close: closeConstellation,
      setPersistentField,
      get openFieldId() { return openFieldId; },
      get persistentFieldId() { return persistentFieldId; },
    };

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      resolveSpatialAnchors();
      updateFieldButtons();

      if (persistentFieldId && !document.body.classList.contains('star-flight-active')) {
        if (openFieldId !== persistentFieldId) openConstellation(persistentFieldId, true);
      }
      updateCompanionsAndEdges();
      return ownsCamera;
    };

    return controller;
  };

  constellationInstall.__smirelConstellations = true;
  window[INSTALL_KEY] = constellationInstall;
})();