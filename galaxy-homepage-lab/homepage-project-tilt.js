(() => {
  'use strict';

  // Source-faithful BA Hero motion model from the recovered production bundle.
  // The original uses raw pointer distance from the transformed card centre,
  // divided by 15, with no normalized max-angle clamp.
  const TILT_DIVISOR = 15;
  const PROFILE_STORAGE_KEY = 'smirel.homeProfilePosition.v1';
  const DRAG_THRESHOLD_PX = 4;
  const EDGE_MARGIN_PX = 8;
  const INTERACTIVE_TARGET = 'a, button, input, textarea, select, option, label';
  const cards = document.querySelectorAll('.home-project-card, .liquid-glass-card');

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function boundedProfilePosition(card, left, top) {
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);
    const minLeft = Math.min(EDGE_MARGIN_PX, maxLeft);
    const minTop = Math.min(EDGE_MARGIN_PX, maxTop);
    const boundedMaxLeft = Math.max(minLeft, maxLeft - EDGE_MARGIN_PX);
    const boundedMaxTop = Math.max(minTop, maxTop - EDGE_MARGIN_PX);

    return {
      left: clamp(left, minLeft, boundedMaxLeft),
      top: clamp(top, minTop, boundedMaxTop),
    };
  }

  function readStoredProfilePosition() {
    try {
      const value = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) || 'null');
      if (!value || !Number.isFinite(value.left) || !Number.isFinite(value.top)) return null;
      return value;
    } catch (_) {
      return null;
    }
  }

  function storeProfilePosition(card) {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
        left: card.offsetLeft,
        top: card.offsetTop,
      }));
    } catch (_) {}
  }

  for (const card of cards) {
    const isProfileCard = card.classList.contains('home-profile-card');
    let rotateX = 0;
    let rotateY = 0;
    let gradientAngle = 135;
    let dragState = null;
    let profilePositionIsExplicit = false;

    const apply = () => {
      card.style.transform = `perspective(1000px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
      card.style.setProperty('--ba-tilt-gradient-angle', `${gradientAngle}deg`);
    };

    const resetTilt = () => {
      rotateX = 0;
      rotateY = 0;
      gradientAngle = 135;
      apply();
    };

    const setProfilePosition = (left, top, { persist = false } = {}) => {
      if (!isProfileCard) return;
      const bounded = boundedProfilePosition(card, left, top);
      card.style.left = `${bounded.left}px`;
      card.style.top = `${bounded.top}px`;
      profilePositionIsExplicit = true;
      if (persist) storeProfilePosition(card);
    };

    const handleMouseMove = (event) => {
      if (dragState?.active) return;
      window.requestAnimationFrame(() => {
        if (dragState?.active) return;
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        rotateY = (event.clientX - centerX) / TILT_DIVISOR;
        rotateX = -(event.clientY - centerY) / TILT_DIVISOR;

        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        gradientAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

        apply();
      });
    };

    const handleMouseLeave = () => {
      if (dragState?.active) return;
      resetTilt();
    };

    const finishDrag = (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const wasActive = dragState.active;
      if (card.hasPointerCapture?.(event.pointerId)) card.releasePointerCapture(event.pointerId);
      dragState = null;
      card.classList.remove('is-dragging');
      resetTilt();
      if (wasActive) storeProfilePosition(card);
    };

    if (isProfileCard) {
      const saved = readStoredProfilePosition();
      if (saved) setProfilePosition(saved.left, saved.top);

      card.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        if (event.target instanceof Element && event.target.closest(INTERACTIVE_TARGET)) return;

        dragState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startLeft: card.offsetLeft,
          startTop: card.offsetTop,
          active: false,
        };
        card.setPointerCapture?.(event.pointerId);
      });

      card.addEventListener('pointermove', (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;

        if (!dragState.active) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
          dragState.active = true;
          card.classList.add('is-dragging');
          resetTilt();
        }

        event.preventDefault();
        setProfilePosition(dragState.startLeft + dx, dragState.startTop + dy);
      }, { passive: false });

      card.addEventListener('pointerup', finishDrag);
      card.addEventListener('pointercancel', finishDrag);

      window.addEventListener('resize', () => {
        if (!profilePositionIsExplicit) return;
        setProfilePosition(card.offsetLeft, card.offsetTop, { persist: true });
      }, { passive: true });
    }

    apply();
    card.addEventListener('mousemove', handleMouseMove, { passive: true });
    card.addEventListener('mouseleave', handleMouseLeave, { passive: true });
  }
})();
