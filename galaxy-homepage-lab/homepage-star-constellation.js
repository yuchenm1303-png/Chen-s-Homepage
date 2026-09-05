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

    const constellationParents = catalog.filter((item) => item.constellation?.nodes?.length);
    if (!constellationParents.length) return controller;

    const objectById = new Map(catalog.map((item) => [item.id, item]));
    const hiddenAnchorIds = catalog.filter((item) => item.hiddenFromIndex).map((item) => item.id);
    const anchorPositions = new Map();
    const projectedPositions = new Map();
    const companionButtons = new Map();
    const edgeElements = new Map();
    const parentButtons = new Map();

    let anchorsResolved = false;
    let openParentId = null;
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
      /* Main content stars are navigation, not easter eggs: their labels are always legible. */
      .smirel-star-anchor__label {
        opacity: .62 !important;
        transform: translateX(0) !important;
      }
      .smirel-star-anchor:hover .smirel-star-anchor__label,
      .smirel-star-anchor:focus-visible .smirel-star-anchor__label {
        opacity: .96 !important;
      }
      ${hiddenAnchorIds.map((id) => `.smirel-star-anchor[data-star-id="${id}"]`).join(',\n      ')} {
        display: none !important;
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
        vector-effect: non-scaling-stroke;
        stroke: rgba(190, 222, 255, .31);
        stroke-width: .8;
        stroke-linecap: round;
        fill: none;
        opacity: 0;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        filter: drop-shadow(0 0 4px rgba(170, 216, 255, .14));
        transition:
          opacity .18s ease,
          stroke-dashoffset .46s cubic-bezier(.22,.61,.36,1);
        transition-delay: var(--edge-delay, 0ms);
      }
      .smirel-constellation-edge.is-open {
        opacity: 1;
        stroke-dashoffset: 0;
      }

      .smirel-companion-star {
        --companion-color: #d8efff;
        --companion-delay: 0ms;
        position: fixed;
        left: 0;
        top: 0;
        z-index: 9;
        width: 38px;
        height: 38px;
        margin: -19px 0 0 -19px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: rgba(245,249,255,.94);
        opacity: 0;
        pointer-events: none;
        cursor: pointer;
        transform-origin: 50% 50%;
        transition: opacity .22s ease var(--companion-delay);
      }
      .smirel-companion-star::before {
        content: '';
        position: absolute;
        inset: 11px;
        border: 1px solid color-mix(in srgb, var(--companion-color) 40%, transparent);
        border-radius: 50%;
        transform: scale(.62);
        box-shadow: 0 0 12px color-mix(in srgb, var(--companion-color) 15%, transparent);
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
      .smirel-companion-star.is-open::before {
        transform: scale(1);
      }
      .smirel-companion-star:hover::before,
      .smirel-companion-star:focus-visible::before {
        border-color: color-mix(in srgb, var(--companion-color) 82%, white 18%);
        box-shadow: 0 0 21px color-mix(in srgb, var(--companion-color) 28%, transparent);
      }
      .smirel-companion-label {
        position: absolute;
        left: 34px;
        top: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: max-content;
        text-align: left;
        white-space: nowrap;
        text-shadow: 0 1px 10px #000, 0 0 18px #000;
        opacity: .74;
        transform: translateX(-4px);
        transition: opacity .2s ease, transform .2s ease;
      }
      .smirel-companion-star.is-open .smirel-companion-label {
        transform: translateX(0);
      }
      .smirel-companion-star:hover .smirel-companion-label,
      .smirel-companion-star:focus-visible .smirel-companion-label {
        opacity: 1;
      }
      .smirel-companion-label strong {
        color: rgba(248,251,255,.92);
        font: 620 9px/1.05 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .105em;
        text-transform: uppercase;
      }
      .smirel-companion-label small {
        color: rgba(255,255,255,.42);
        font: 560 7.5px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .11em;
        text-transform: uppercase;
      }

      body.star-flight-active .smirel-constellation-map,
      body.star-flight-active .smirel-companion-star {
        opacity: 0 !important;
        pointer-events: none !important;
      }

      @media (max-width: 760px) {
        .smirel-star-anchor__label { opacity: .72 !important; }
        .smirel-companion-label strong { font-size: 8px; }
        .smirel-companion-label small { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
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
    svg.setAttribute('viewBox', `0 0 ${Math.max(innerWidth, 1)} ${Math.max(innerHeight, 1)}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    document.body.appendChild(svg);

    function pointInsideExpandedRect(x, y, rect, margin) {
      if (!rect) return false;
      return x >= rect.left - margin && x <= rect.right + margin
        && y >= rect.top - margin && y <= rect.bottom + margin;
    }

    /*
     * Mirror the star-flight anchor resolver exactly. This intentionally uses the
     * existing bright-field geometry rather than drawing fake DOM stars, so every
     * constellation node is tied to the same physical star that openObject() flies to.
     */
    function resolveAnchorPositions() {
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
        anchorPositions.set(object.id, new THREE.Vector3().fromBufferAttribute(positions, bestIndex));
        usedAnchorIndices.add(bestIndex);
        chosenProjected.push({ x: bestProjectedX, y: bestProjectedY });
      }

      anchorsResolved = true;
    }

    function companionMeta(object) {
      const category = object.meta?.[0] || (object.kind === 'note' ? 'Note' : 'Project');
      return object.date ? `${category} · ${object.date}` : category;
    }

    function createCompanionButton(parent, object, index) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'smirel-companion-star';
      button.dataset.companionId = object.id;
      button.dataset.parentStar = parent.id;
      button.style.setProperty('--companion-color', object.star?.tint || parent.star?.tint || '#d8efff');
      button.style.setProperty('--companion-delay', `${Math.min(index * 42, 190)}ms`);
      button.setAttribute('aria-label', `Open ${object.title}`);
      button.innerHTML = `
        <span class="smirel-companion-label">
          <strong>${object.title}</strong>
          <small>${companionMeta(object)}</small>
        </span>
      `;
      button.addEventListener('pointerenter', cancelScheduledClose);
      button.addEventListener('pointerleave', scheduleClose);
      button.addEventListener('focusin', cancelScheduledClose);
      button.addEventListener('focusout', scheduleClose);
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeConstellation(true);
        controller.openObject?.(object.id);
      });
      document.body.appendChild(button);
      companionButtons.set(object.id, button);
    }

    function edgeKey(parentId, edge, index) {
      return `${parentId}:${edge[0]}:${edge[1]}:${index}`;
    }

    function createEdges(parent) {
      const edges = parent.constellation?.edges || [];
      edges.forEach((edge, index) => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('smirel-constellation-edge');
        line.setAttribute('pathLength', '1');
        line.dataset.parentStar = parent.id;
        line.dataset.fromStar = edge[0];
        line.dataset.toStar = edge[1];
        line.style.setProperty('--edge-delay', `${Math.min(index * 45, 230)}ms`);
        svg.appendChild(line);
        edgeElements.set(edgeKey(parent.id, edge, index), line);
      });
    }

    function cancelScheduledClose() {
      if (!closeTimer) return;
      clearTimeout(closeTimer);
      closeTimer = 0;
    }

    function scheduleClose() {
      cancelScheduledClose();
      closeTimer = setTimeout(() => {
        closeTimer = 0;
        closeConstellation(false);
      }, 170);
    }

    function openConstellation(parentId) {
      if (document.body.classList.contains('star-flight-active')) return;
      cancelScheduledClose();
      openParentId = parentId;

      const parent = objectById.get(parentId);
      if (!parent?.constellation) return;
      parentButtons.get(parentId)?.setAttribute('aria-expanded', 'true');

      for (const childId of parent.constellation.nodes) {
        companionButtons.get(childId)?.classList.add('is-open');
      }
      for (const line of edgeElements.values()) {
        line.classList.toggle('is-open', line.dataset.parentStar === parentId);
      }
    }

    function closeConstellation(immediate) {
      cancelScheduledClose();
      const previous = openParentId;
      openParentId = null;
      if (previous) parentButtons.get(previous)?.setAttribute('aria-expanded', 'false');

      for (const button of companionButtons.values()) {
        button.classList.remove('is-open');
        if (immediate) button.style.transitionDelay = '0ms';
      }
      for (const line of edgeElements.values()) {
        line.classList.remove('is-open');
        if (immediate) line.style.transitionDelay = '0ms';
      }

      if (immediate) {
        requestAnimationFrame(() => {
          for (const button of companionButtons.values()) button.style.transitionDelay = '';
          for (const line of edgeElements.values()) line.style.transitionDelay = '';
        });
      }
    }

    for (const parent of constellationParents) {
      const parentButton = document.querySelector(`.smirel-star-anchor[data-star-id="${parent.id}"]`);
      if (!parentButton) continue;
      parentButtons.set(parent.id, parentButton);
      parentButton.setAttribute('aria-expanded', 'false');
      parentButton.addEventListener('pointerenter', () => openConstellation(parent.id));
      parentButton.addEventListener('pointerleave', scheduleClose);
      parentButton.addEventListener('focusin', () => openConstellation(parent.id));
      parentButton.addEventListener('focusout', scheduleClose);

      parent.constellation.nodes.forEach((childId, index) => {
        const child = objectById.get(childId);
        if (child && !companionButtons.has(childId)) createCompanionButton(parent, child, index);
      });
      createEdges(parent);
    }

    function projectToScreen(id) {
      const position = anchorPositions.get(id);
      if (!position) return null;
      scratch.projected.copy(position).project(camera);
      const visible = scratch.projected.z >= -1 && scratch.projected.z <= 1
        && Math.abs(scratch.projected.x) <= 1.08
        && Math.abs(scratch.projected.y) <= 1.08;
      if (!visible) return null;
      const point = {
        x: (scratch.projected.x * 0.5 + 0.5) * Math.max(window.innerWidth, 1),
        y: (-scratch.projected.y * 0.5 + 0.5) * Math.max(window.innerHeight, 1),
      };
      projectedPositions.set(id, point);
      return point;
    }

    function updateConstellationGeometry() {
      resolveAnchorPositions();
      if (!anchorsResolved) return;

      svg.setAttribute('viewBox', `0 0 ${Math.max(innerWidth, 1)} ${Math.max(innerHeight, 1)}`);
      projectedPositions.clear();

      for (const [id, button] of companionButtons) {
        const point = projectToScreen(id);
        if (!point) {
          button.style.visibility = 'hidden';
          continue;
        }
        button.style.visibility = 'visible';
        button.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
      }

      for (const line of edgeElements.values()) {
        const from = projectedPositions.get(line.dataset.fromStar) || projectToScreen(line.dataset.fromStar);
        const to = projectedPositions.get(line.dataset.toStar) || projectToScreen(line.dataset.toStar);
        if (!from || !to) {
          line.style.visibility = 'hidden';
          continue;
        }
        line.style.visibility = 'visible';
        line.setAttribute('x1', from.x.toFixed(2));
        line.setAttribute('y1', from.y.toFixed(2));
        line.setAttribute('x2', to.x.toFixed(2));
        line.setAttribute('y2', to.y.toFixed(2));
      }

      if (openParentId) {
        const parentButton = parentButtons.get(openParentId);
        const mainVisible = parentButton && parseFloat(parentButton.style.opacity || '0') > 0.1;
        if (!mainVisible) closeConstellation(false);
      }
    }

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      if (document.body.classList.contains('star-flight-active')) {
        if (openParentId) closeConstellation(true);
      } else {
        updateConstellationGeometry();
      }
      return ownsCamera;
    };

    window.addEventListener('resize', () => {
      anchorsResolved = false;
      anchorPositions.clear();
      projectedPositions.clear();
    }, { passive: true });

    return controller;
  };

  constellationInstall.__smirelConstellations = true;
  window[INSTALL_KEY] = constellationInstall;
})();
