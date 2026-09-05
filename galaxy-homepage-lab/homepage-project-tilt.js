(() => {
  'use strict';

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!finePointer.matches || reducedMotion.matches) return;

  const MAX_TILT_DEG = 2.3;
  const cards = document.querySelectorAll('.home-project-card');

  for (const card of cards) {
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const applyTilt = () => {
      frame = 0;
      const rect = card.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const normalizedX = Math.max(-1, Math.min(1, ((pointerX - rect.left) / rect.width - 0.5) * 2));
      const normalizedY = Math.max(-1, Math.min(1, ((pointerY - rect.top) / rect.height - 0.5) * 2));

      card.classList.add('is-tilting');
      card.style.setProperty('--project-tilt-y', `${normalizedX * MAX_TILT_DEG}deg`);
      card.style.setProperty('--project-tilt-x', `${-normalizedY * MAX_TILT_DEG}deg`);
    };

    const handlePointerMove = (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(applyTilt);
    };

    const resetTilt = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      card.classList.remove('is-tilting');
      card.style.setProperty('--project-tilt-x', '0deg');
      card.style.setProperty('--project-tilt-y', '0deg');
    };

    card.addEventListener('pointermove', handlePointerMove, { passive: true });
    card.addEventListener('pointerleave', resetTilt, { passive: true });
    card.addEventListener('pointercancel', resetTilt, { passive: true });
  }
})();
