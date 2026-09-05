(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelFixedAnchors) return;

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

    // Any catalog object with star.fixedIndex is authored. The index is the identity;
    // do not run a second resolver for it and do not substitute a nearby bright star.
    for (const object of catalog) {
      const index = object.star?.fixedIndex;
      if (!Number.isInteger(index) || index < 0 || index >= positions.count) continue;
      fixedAnchors.set(object.id, {
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
      if (object.kind === 'contact') return object.action?.label || 'Contact';
      const category = object.meta?.[0] || (object.kind === 'note' ? 'Article' : 'Project');
      return object.date ? `${category} · ${object.date}` : category;
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
      if (!object || object.kind === 'field' || !object.parentField) return null;

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
        button.setAttribute(
          'aria-label',
          object.interactive === false ? object.title : `Open ${object.title}`,
        );
        button.innerHTML = `
          <span class="smirel-companion-label">
            <strong>${object.navTitle || object.title}</strong>
            <small>${markerMeta(object)}</small>
          </span>
        `;

        if (object.interactive === false) {
          button.classList.add('is-static');
          button.tabIndex = -1;
        } else {
          button.addEventListener('pointerenter', cancelClose);
          button.addEventListener('pointerleave', scheduleClose);
          button.addEventListener('focusin', cancelClose);
          button.addEventListener('focusout', scheduleClose);
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            cancelClose();

            if (object.kind === 'contact' && object.action?.href) {
              if (object.action.external) {
                window.open(object.action.href, '_blank', 'noopener,noreferrer');
              } else {
                window.location.href = object.action.href;
              }
              return;
            }

            controller.openObject?.(object.id);
          });
        }
        document.body.appendChild(button);
      }

      fixedMarkers.set(id, button);
      return button;
    }

    for (const [id, anchor] of fixedAnchors) {
      if (anchor.object.kind !== 'field') ensureMarker(id);
    }

    function updateFieldPrimaries() {
      const suppress = document.body.classList.contains('star-flight-active')
        || document.body.classList.contains('star-field-open')
        || document.body.classList.contains('star-field-transition');

      for (const [id, anchor] of fixedAnchors) {
        if (anchor.object.kind !== 'field') continue;
        const button = document.querySelector(`.smirel-field-star[data-field-id="${id}"]`);
        if (!button) continue;
        const point = project(anchor);
        if (!point || suppress) continue;
        button.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
      }
    }

    function updateMarkers() {
      const activeFieldId = controller.constellation?.openFieldId || null;
      const suppress = document.body.classList.contains('star-flight-active')
        || document.body.classList.contains('star-detail-open');

      for (const [id, anchor] of fixedAnchors) {
        const object = anchor.object;
        if (object.kind === 'field') continue;
        const marker = fixedMarkers.get(id) || ensureMarker(id);
        if (!marker) continue;

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
        marker.style.pointerEvents = object.interactive === false ? 'none' : '';
      }
    }

    function updateEdges() {
      const authoredFields = new Set();
      for (const anchor of fixedAnchors.values()) {
        const fieldId = anchor.object.kind === 'field'
          ? anchor.object.id
          : anchor.object.parentField;
        if (fieldId) authoredFields.add(fieldId);
      }

      for (const fieldId of authoredFields) {
        const selector = `.smirel-constellation-edge[data-parent-field="${fieldId}"]`;
        for (const line of document.querySelectorAll(selector)) {
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
    }

    controller.getSpatialAnchor = getAnchor;
    controller.fixedAnchorRegistry = Object.freeze(Object.fromEntries(
      [...fixedAnchors].map(([id, anchor]) => [id, anchor.index]),
    ));

    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      updateFieldPrimaries();
      updateMarkers();
      updateEdges();
      return ownsCamera;
    };

    return controller;
  };

  fixedInstall.__smirelFixedAnchors = true;
  window[INSTALL_KEY] = fixedInstall;
})();
