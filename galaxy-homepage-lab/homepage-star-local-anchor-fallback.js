(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelLocalAnchorFallback) return;

  const fallbackInstall = function installLocalAnchorFallback(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, camera, brightField } = context || {};
    const geometry = brightField?.geometry;
    const positions = geometry?.getAttribute?.('position');
    const brightness = geometry?.getAttribute?.('starBrightness');
    const colors = geometry?.getAttribute?.('starColor');
    if (!THREE || !camera || !positions || !brightness || !colors) return controller;

    const catalog = Array.isArray(controller.catalog)
      ? controller.catalog
      : (window.__SMIREL_STELLAR_CATALOG__ || []);
    const objectById = new Map(catalog.map((item) => [item.id, item]));

    // Only nodes that never use the real-star flight/detail path are eligible.
    // Projects and articles must keep the base resolver's exact anchor identity.
    const localOnlyNodes = catalog.filter((item) => (
      item.parentField
      && (item.kind === 'contact' || item.interactive === false)
    ));
    if (!localOnlyNodes.length) return controller;

    const baseGetSpatialAnchor = typeof controller.getSpatialAnchor === 'function'
      ? controller.getSpatialAnchor.bind(controller)
      : null;
    const baseResolveSpatialAnchors = typeof controller.resolveSpatialAnchors === 'function'
      ? controller.resolveSpatialAnchors.bind(controller)
      : null;
    const baseUpdate = controller.update.bind(controller);

    const fallbackAnchors = new Map();
    const fallbackMarkers = new Map();
    let closeTimer = 0;

    const scratch = {
      local: new THREE.Vector3(),
      world: new THREE.Vector3(),
      projected: new THREE.Vector3(),
      candidateColor: new THREE.Color(),
      targetColor: new THREE.Color(),
    };

    function getAnchor(id) {
      return baseGetSpatialAnchor?.(id) || fallbackAnchors.get(id) || null;
    }

    function worldPosition(anchor, target = scratch.world) {
      if (!anchor?.position) return null;
      target.copy(anchor.position);
      const points = brightField?.points;
      if (points?.matrixWorld) {
        points.updateMatrixWorld?.(true);
        target.applyMatrix4(points.matrixWorld);
      }
      return target;
    }

    function projectAnchor(anchor) {
      const world = worldPosition(anchor, scratch.world);
      if (!world) return null;
      scratch.projected.copy(world).project(camera);
      if (scratch.projected.z < -1 || scratch.projected.z > 1) return null;
      return {
        ndcX: scratch.projected.x,
        ndcY: scratch.projected.y,
        x: (scratch.projected.x * 0.5 + 0.5) * window.innerWidth,
        y: (-scratch.projected.y * 0.5 + 0.5) * window.innerHeight,
      };
    }

    function usedIndices() {
      const used = new Set();
      for (const item of catalog) {
        const anchor = getAnchor(item.id);
        if (Number.isInteger(anchor?.index)) used.add(anchor.index);
      }
      return used;
    }

    function siblingProjected(item) {
      const points = [];
      for (const candidate of catalog) {
        const sameField = candidate.id === item.parentField
          || candidate.parentField === item.parentField;
        if (!sameField || candidate.id === item.id) continue;
        const point = projectAnchor(getAnchor(candidate.id));
        if (point) points.push(point);
      }
      return points;
    }

    function chooseFallbackAnchor(item, used) {
      const target = item.star?.target || [0, 0];
      const depthRange = item.star?.depth || [13, 40];
      const requestedBrightness = item.star?.minBrightness ?? 1.0;
      const brightnessPasses = [
        requestedBrightness,
        Math.max(0.62, requestedBrightness - 0.28),
        0.48,
      ];
      const siblings = siblingProjected(item);
      scratch.targetColor.set(item.star?.tint || '#d8efff');

      let bestIndex = -1;
      let bestScore = -Infinity;

      for (const minBrightness of brightnessPasses) {
        for (let index = 0; index < positions.count; index += 1) {
          if (used.has(index)) continue;
          const b = brightness.getX(index);
          if (b < minBrightness) continue;

          scratch.local.fromBufferAttribute(positions, index);
          const depth = -scratch.local.z;
          if (depth < depthRange[0] || depth > depthRange[1]) continue;

          scratch.world.copy(scratch.local);
          const pointsObject = brightField?.points;
          if (pointsObject?.matrixWorld) {
            pointsObject.updateMatrixWorld?.(true);
            scratch.world.applyMatrix4(pointsObject.matrixWorld);
          }
          scratch.projected.copy(scratch.world).project(camera);
          if (scratch.projected.z < -1 || scratch.projected.z > 1) continue;
          if (Math.abs(scratch.projected.x) > 0.98 || Math.abs(scratch.projected.y) > 0.94) continue;

          // Local-field nodes are never visible together with the homepage panels,
          // so do not reject their real stars because those panels happen to cover
          // the same screen region while the global galaxy is idle.
          let tooClose = false;
          for (const sibling of siblings) {
            const dx = scratch.projected.x - sibling.ndcX;
            const dy = scratch.projected.y - sibling.ndcY;
            if (dx * dx + dy * dy < 0.0064) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) continue;

          scratch.candidateColor.setRGB(
            colors.getX(index),
            colors.getY(index),
            colors.getZ(index),
          );
          const colorDistance = Math.sqrt(
            (scratch.candidateColor.r - scratch.targetColor.r) ** 2
            + (scratch.candidateColor.g - scratch.targetColor.g) ** 2
            + (scratch.candidateColor.b - scratch.targetColor.b) ** 2
          );
          const dx = scratch.projected.x - target[0];
          const dy = scratch.projected.y - target[1];
          const positionPenalty = Math.sqrt(dx * dx + dy * dy);
          const depthCentre = (depthRange[0] + depthRange[1]) * 0.5;
          const depthPenalty = Math.abs(depth - depthCentre)
            / Math.max(depthRange[1] - depthRange[0], 1);
          const score = b * 0.32
            - positionPenalty * 4.2
            - colorDistance * 0.50
            - depthPenalty * 0.15;

          if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
          }
        }
        if (bestIndex >= 0) break;
      }

      if (bestIndex < 0) return null;
      return {
        object: item,
        index: bestIndex,
        position: new THREE.Vector3().fromBufferAttribute(positions, bestIndex),
        fallback: true,
      };
    }

    function markerMeta(item) {
      if (item.kind === 'contact') return item.action?.label || 'Contact';
      return item.meta?.[0] || 'Profile';
    }

    function cancelClose() {
      if (!closeTimer) return;
      clearTimeout(closeTimer);
      closeTimer = 0;
    }

    function scheduleClose() {
      cancelClose();
      closeTimer = setTimeout(() => {
        closeTimer = 0;
        controller.constellation?.close?.(false);
      }, 180);
    }

    function ensureMarker(item) {
      const existing = document.querySelector(
        `.smirel-companion-star[data-companion-id="${item.id}"]`,
      );
      if (existing) {
        fallbackMarkers.set(item.id, existing);
        return existing;
      }

      const field = objectById.get(item.parentField);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'smirel-companion-star smirel-local-anchor-fallback';
      button.dataset.companionId = item.id;
      button.dataset.parentField = item.parentField;
      button.style.setProperty(
        '--companion-color',
        item.star?.tint || field?.star?.tint || '#d8efff',
      );
      button.setAttribute(
        'aria-label',
        item.interactive === false ? item.title : `Open ${item.title}`,
      );
      button.innerHTML = `
        <span class="smirel-companion-label">
          <strong>${item.navTitle || item.title}</strong>
          <small>${markerMeta(item)}</small>
        </span>
      `;

      if (item.interactive === false) {
        button.classList.add('is-static');
        button.tabIndex = -1;
      } else {
        button.addEventListener('pointerenter', () => {
          cancelClose();
          controller.constellation?.open?.(item.parentField, false);
        });
        button.addEventListener('pointerleave', scheduleClose);
        button.addEventListener('focusin', () => {
          cancelClose();
          controller.constellation?.open?.(item.parentField, false);
        });
        button.addEventListener('focusout', scheduleClose);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          cancelClose();
          if (item.kind === 'contact' && item.action?.href) {
            if (item.action.external) {
              window.open(item.action.href, '_blank', 'noopener,noreferrer');
            } else {
              window.location.href = item.action.href;
            }
          }
        });
      }

      document.body.appendChild(button);
      fallbackMarkers.set(item.id, button);
      return button;
    }

    function resolveFallbackAnchors() {
      baseResolveSpatialAnchors?.();
      const used = usedIndices();

      for (const item of localOnlyNodes) {
        if (baseGetSpatialAnchor?.(item.id) || fallbackAnchors.has(item.id)) continue;
        const anchor = chooseFallbackAnchor(item, used);
        if (!anchor) continue;
        fallbackAnchors.set(item.id, anchor);
        used.add(anchor.index);
        ensureMarker(item);
      }
    }

    function updateMarkers() {
      const activeFieldId = controller.constellation?.openFieldId || null;
      const suppress = document.body.classList.contains('star-flight-active')
        || document.body.classList.contains('star-detail-open');

      for (const [id, marker] of fallbackMarkers) {
        const item = objectById.get(id);
        const open = !suppress && activeFieldId === item?.parentField;
        marker.classList.toggle('is-open', open);
        if (!open) continue;

        const point = projectAnchor(fallbackAnchors.get(id));
        if (!point) {
          marker.style.opacity = '0';
          marker.style.pointerEvents = 'none';
          continue;
        }
        marker.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
        marker.style.opacity = '';
        marker.style.pointerEvents = '';
      }
    }

    function updateFallbackEdges() {
      const fieldsWithFallback = new Set(
        [...fallbackAnchors.values()].map((anchor) => anchor.object.parentField),
      );
      for (const fieldId of fieldsWithFallback) {
        const selector = `.smirel-constellation-edge[data-parent-field="${fieldId}"]`;
        for (const line of document.querySelectorAll(selector)) {
          const fromAnchor = getAnchor(line.dataset.fromStar);
          const toAnchor = getAnchor(line.dataset.toStar);
          const from = projectAnchor(fromAnchor);
          const to = projectAnchor(toAnchor);
          if (!from || !to) continue;

          line.setAttribute('x1', from.x.toFixed(2));
          line.setAttribute('y1', from.y.toFixed(2));
          line.setAttribute('x2', to.x.toFixed(2));
          line.setAttribute('y2', to.y.toFixed(2));
          if (line.classList.contains('is-open')) line.style.opacity = '';
        }
      }
    }

    controller.getSpatialAnchor = getAnchor;
    controller.resolveSpatialAnchors = () => {
      resolveFallbackAnchors();
    };

    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      resolveFallbackAnchors();
      updateMarkers();
      updateFallbackEdges();
      return ownsCamera;
    };

    return controller;
  };

  fallbackInstall.__smirelLocalAnchorFallback = true;
  window[INSTALL_KEY] = fallbackInstall;
})();