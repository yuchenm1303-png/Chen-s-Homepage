(() => {
  'use strict';

  // Source-faithful BA Hero motion model from the recovered production bundle.
  // The original uses raw pointer distance from the transformed card centre,
  // divided by 15, with no normalized max-angle clamp.
  const TILT_DIVISOR = 15;
  const cards = document.querySelectorAll('.home-project-card, .liquid-glass-card');

  for (const card of cards) {
    let rotateX = 0;
    let rotateY = 0;
    let gradientAngle = 135;

    const apply = () => {
      card.style.transform = `perspective(1000px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
      card.style.setProperty('--ba-tilt-gradient-angle', `${gradientAngle}deg`);
    };

    const handleMouseMove = (event) => {
      window.requestAnimationFrame(() => {
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
      rotateX = 0;
      rotateY = 0;
      gradientAngle = 135;
      apply();
    };

    apply();
    card.addEventListener('mousemove', handleMouseMove, { passive: true });
    card.addEventListener('mouseleave', handleMouseLeave, { passive: true });
  }
})();
