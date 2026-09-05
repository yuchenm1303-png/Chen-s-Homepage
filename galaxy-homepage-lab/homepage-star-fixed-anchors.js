(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelFixedAnchors) return;

  // brightField is generated from the fixed 0xA57A2D31 seed with 14,800 stars.
  // These indices are authored identities, not runtime search hints. Once a content
  // node is assigned here it stays attached to exactly the same real star until the
  // underlying bright-field generator itself is intentionally versioned.
  const FIXED_ANCHORS = Object.freeze({
    'contact-github': 105,
    'contact-email': 2930,
    'contact-phone': 196,
    'contact-qq': 14080,
  });

  const fixedInstall = function installFixedAnchors(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, camera, brightField } = context || {};
    const positions = brightField?.geometry?.getAttribute?.('position');
    if (!THREE || !camera || !positions) return controller;

    const catalog = Array.isArray(controller.catalog)
      ? controller.catalog
      : (window.__SMIREL_STELLAR_CATALOG__ || []);
    const objectById = new Map(catalog.map((item) => [item.id, item]));
    const baseGetSpatialAnchor = typeof controller.getSpatialAnchor === 'function'
      ? controller.getSpatialAnchor.bind(controller)
      : null;
    const baseUpdate = controller.update.bind(controller);
    const fixedAnchors = new Map();
    const fixedMarkers = new Map();
    let closeTimer = 0;

    const scratch = {
      world: new THREE.Vector3(),
      projected: new THREE.Vector3(),
    };

    for (const [id, index] of Object.entries(FIXED_ANCHORS)) {
      const object = objectById.get(id);
      if (!object || !Number.isInteger(index) || index < 0 || index >= positions.count) continue;
      fixedAnchors.set(id, {
        object,
        index,
        position: new THREE.Vector3().fromBufferAttribute(positions, index),
        fixed: true,
      });
    }

    function getAnchor(id) {
      return fixedAnchors.get(id) || baseGetSpatialAnchor?.(id) || null;
    }

    function project(anchor) {
      if (!anchor?.position) return null;
      scratch.world.copy(anchor.position);
      const points = brightField?.points;
      if (points?.matrixWorld) {
        points.updateMatrixWorld?.(true);
        scratch.world.applyMatrix4(points.matrixWorld);
      }
      scratch.projected.copy(scratch.world).project(camera);
      if (scratch.projected.z < -1 || scratch.projected.z > 1
          || Math.abs(scratch.projected.x) > 1.20
          || Math.abs(scratch.projected.y) > 1.20) return null;
      return {
        x: (scratch.projected.x * 0.5 + 0.5) * window.innerWidth,
        y: (-scratch.projected.y * 0.5 + 0.5) * window.innerHeight,
      };
    }

    function markerMeta(object) {
      return object.action?.label || object.meta?.[0] || 'Contact';
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

    function ensureMarker(id) {
      const object = objectById.get(id);
      if (!object) return null;

      let button = document.querySelector(`.smirel-companion-star[data-companion-id="${id}"]`);
      if (!button) {
        const field = objectById.get(object.parentField);
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'smirel-companion-star smirel-fixed-anchor-marker';
        button.dataset.companionId = id;
        button.dataset.parentField = object.parentField;
        button.style.setProperty(
          '--companion-color',
          object.star?.tint || field?.star?.tint || '#d8efff',
        );
        button.setAttribute('aria-label', `Open ${object.title}`);
        button.innerHTML = `
          <span class="smirel-companion-label">
            <strong>${object.navTitle || object.title}</strong>
            <small>${markerMeta(object)}</small>
          </span>
        `;

        button.addEventListener('pointerenter', () => {
          cancelClose();
          controller.constellation?.open?.(object.parentField, false);
        });
        button.addEventListener('pointerleave', scheduleClose);
        button.addEventListener('focusin', () => {
          cancelClose();
          controller.constellation?.open?.(object.parentField, false);
        });
        button.addEventListener('focusout', scheduleClose);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          cancelClose();
          if (!object.action?.href) return;
          if (object.action.external) {
            window.open(object.action.href, '_blank', 'noopener,noreferrer');
          } else {
            window.location.href = object.action.href;
          }
        });
        document.body.appendChild(button);
      }

      fixedMarkers.set(id, button);
      return button;
    }

    for (const id of fixedAnchors.keys()) ensureMarker(id);

    function updateMarkers() {
      const activeFieldId = controller.constellation?.openFieldId || null;
      const suppress = document.body.classList.contains('star-flight-active')
        || document.body.classList.contains('star-detail-open');

      for (const [id, anchor] of fixedAnchors) {
        const object = objectById.get(id);
        const marker = fixedMarkers.get(id) || ensureMarker(id);
        if (!object || !marker) continue;

        const open = !suppress && activeFieldId === object.parentField;
        marker.classList.toggle('is-open', open);
        if (!open) continue;

        const point = project(anchor);
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

    function updateEdges() {
      for (const line of document.querySelectorAll('.smirel-constellation-edge[data-parent-field="contact"]')) {
        const from = project(getAnchor(line.dataset.fromStar));
        const to = project(getAnchor(line.dataset.toStar));
        if (!from || !to) {
          line.style.opacity = '0';
          continue;
        }
        line.setAttribute('x1', from.x.toFixed(2));
        line.setAttribute('y1', from.y.toFixed(2));
        line.setAttribute('x2', to.x.toFixed(2));
        line.setAttribute('y2', to.y.toFixed(2));
        if (line.classList.contains('is-open')) line.style.opacity = '';
      }
    }

    controller.getSpatialAnchor = getAnchor;
    controller.fixedAnchorRegistry = FIXED_ANCHORS;
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      updateMarkers();
      updateEdges();
      return ownsCamera;
    };

    return controller;
  };

  fixedInstall.__smirelFixedAnchors = true;
  window[INSTALL_KEY] = fixedInstall;
})();