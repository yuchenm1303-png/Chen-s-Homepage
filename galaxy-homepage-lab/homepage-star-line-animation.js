(() => {
  'use strict';

  const DRAW_MS = 620;
  const DRAW_STAGGER_MS = 54;
  const RESET_DELAY_MS = 220;
  const MAX_GEOMETRY_FRAMES = 12;

  const runIdByField = new Map();
  const animationByLine = new WeakMap();
  const resetTimerByField = new Map();

  function linesForField(fieldId) {
    if (!fieldId) return [];
    const escaped = CSS.escape(fieldId);
    return Array.from(document.querySelectorAll(
      `.smirel-constellation-edge[data-parent-field="${escaped}"]`,
    ));
  }

  function nextRun(fieldId) {
    const runId = (runIdByField.get(fieldId) || 0) + 1;
    runIdByField.set(fieldId, runId);
    const timer = resetTimerByField.get(fieldId);
    if (timer) {
      clearTimeout(timer);
      resetTimerByField.delete(fieldId);
    }
    return runId;
  }

  function cancelLineAnimation(line) {
    const animation = animationByLine.get(line);
    if (animation) {
      animation.cancel();
      animationByLine.delete(line);
    }
  }

  function clearLineOverrides(line) {
    line.style.removeProperty('transition');
    line.style.removeProperty('stroke-dashoffset');
    line.style.removeProperty('opacity');
  }

  function edgeHasGeometry(line) {
    const x1 = Number(line.getAttribute('x1'));
    const y1 = Number(line.getAttribute('y1'));
    const x2 = Number(line.getAttribute('x2'));
    const y2 = Number(line.getAttribute('y2'));
    if (![x1, y1, x2, y2].every(Number.isFinite)) return false;
    return Math.hypot(x2 - x1, y2 - y1) > 1.5;
  }

  function fieldIsActive(fieldId) {
    const primary = document.querySelector(
      `.smirel-field-star[data-field-id="${CSS.escape(fieldId)}"]`,
    );
    if (primary?.classList.contains('is-preview')) return true;

    const body = document.body;
    if (!body) return false;
    const localFieldActive = body.classList.contains('star-field-open')
      || body.classList.contains('star-field-transition');
    return localFieldActive && body.dataset.starField === fieldId;
  }

  function seedLine(line) {
    cancelLineAnimation(line);
    line.style.transition = 'none';
    line.style.strokeDashoffset = '1';
    line.style.opacity = '0.12';
  }

  function resetLine(line) {
    cancelLineAnimation(line);
    line.style.transition = 'none';
    line.style.strokeDashoffset = '1';
    line.style.opacity = '0';
    // Once the closed state has been committed, let the constellation stylesheet
    // own the idle line again. This guarantees the next hover starts from 1.
    requestAnimationFrame(() => {
      if (line.classList.contains('is-open')) return;
      clearLineOverrides(line);
    });
  }

  function resetField(fieldId) {
    if (!fieldId) return;
    nextRun(fieldId);
    for (const line of linesForField(fieldId)) resetLine(line);
  }

  function animateProjectedLine(line, fieldId, runId, index, frame = 0) {
    if (runIdByField.get(fieldId) !== runId) return;
    if (!fieldIsActive(fieldId) || !line.classList.contains('is-open')) return;

    if (!edgeHasGeometry(line)) {
      if (frame < MAX_GEOMETRY_FRAMES) {
        requestAnimationFrame(() => animateProjectedLine(line, fieldId, runId, index, frame + 1));
      }
      return;
    }

    seedLine(line);
    // Flush the seed after the real x/y endpoints exist. The Web Animation then
    // always has a real line to draw, even on the second, third, or tenth hover.
    void line.getTotalLength();
    void getComputedStyle(line).strokeDashoffset;

    requestAnimationFrame(() => {
      if (runIdByField.get(fieldId) !== runId) return;
      if (!fieldIsActive(fieldId) || !line.classList.contains('is-open')) return;

      const animation = line.animate([
        { strokeDashoffset: '1', opacity: 0.12 },
        { strokeDashoffset: '0', opacity: 1 },
      ], {
        duration: DRAW_MS,
        delay: Math.min(index * DRAW_STAGGER_MS, 320),
        easing: 'cubic-bezier(.22,.61,.36,1)',
        fill: 'both',
      });
      animationByLine.set(line, animation);

      animation.onfinish = () => {
        if (animationByLine.get(line) !== animation) return;
        animationByLine.delete(line);
        // The base .is-open rule has the same final state, so releasing the WAAPI
        // animation here does not jump. It simply leaves the line ready to reset.
        animation.cancel();
        clearLineOverrides(line);
      };
      animation.oncancel = () => {
        if (animationByLine.get(line) === animation) animationByLine.delete(line);
      };
    });
  }

  function drawField(fieldId) {
    if (!fieldId) return;
    const runId = nextRun(fieldId);

    // Switching primary stars must not leave a previous constellation visually
    // armed. Only the active field gets a draw run.
    for (const line of document.querySelectorAll('.smirel-constellation-edge')) {
      if (line.dataset.parentField !== fieldId) resetLine(line);
    }

    // The constellation controller updates x1/y1/x2/y2 in its render tick after
    // the hover handler. Wait a frame, then each edge independently waits for its
    // projected geometry before beginning its staggered draw.
    requestAnimationFrame(() => {
      const lines = linesForField(fieldId);
      lines.forEach((line, index) => animateProjectedLine(line, fieldId, runId, index));
    });
  }

  function scheduleFieldReset(fieldId) {
    if (!fieldId) return;
    const previous = resetTimerByField.get(fieldId);
    if (previous) clearTimeout(previous);

    const timer = setTimeout(() => {
      resetTimerByField.delete(fieldId);
      if (fieldIsActive(fieldId)) return;
      resetField(fieldId);
    }, RESET_DELAY_MS);
    resetTimerByField.set(fieldId, timer);
  }

  function fieldIdFromInteractiveTarget(target) {
    const primary = target.closest?.('.smirel-field-star[data-field-id]');
    if (primary) return primary.dataset.fieldId || null;
    const companion = target.closest?.('.smirel-companion-star[data-parent-field]');
    return companion?.dataset.parentField || null;
  }

  document.addEventListener('pointerover', (event) => {
    const primary = event.target.closest?.('.smirel-field-star[data-field-id]');
    if (!primary) return;
    if (event.relatedTarget && primary.contains(event.relatedTarget)) return;
    drawField(primary.dataset.fieldId);
  }, { passive: true });

  document.addEventListener('focusin', (event) => {
    const primary = event.target.closest?.('.smirel-field-star[data-field-id]');
    if (primary) drawField(primary.dataset.fieldId);
  });

  document.addEventListener('pointerout', (event) => {
    const fieldId = fieldIdFromInteractiveTarget(event.target);
    if (!fieldId) return;
    const nextFieldId = fieldIdFromInteractiveTarget(event.relatedTarget);
    if (nextFieldId === fieldId) return;
    scheduleFieldReset(fieldId);
  }, { passive: true });

  document.addEventListener('focusout', (event) => {
    const fieldId = fieldIdFromInteractiveTarget(event.target);
    if (fieldId) scheduleFieldReset(fieldId);
  });

  window.addEventListener('smirel:field-change', (event) => {
    const phase = event.detail?.phase;
    const fieldId = event.detail?.field?.id || document.body?.dataset.starField || null;
    if (!fieldId) return;

    if (phase === 'entering') {
      // The preview constellation becomes the persistent local-field map. Give
      // that transition one deliberate draw, then leave it fully expanded.
      drawField(fieldId);
    } else if (phase === 'galaxy') {
      resetField(fieldId);
    }
  });
})();
