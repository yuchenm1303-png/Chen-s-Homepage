(() => {
  'use strict';

  const FLAG = '__smirelDetailStarMotionPolicyV1';
  const nativeAnimate = Element.prototype.animate;
  if (typeof nativeAnimate !== 'function' || nativeAnimate[FLAG]) return;

  const ENTRY_SOURCE_MS = 640;
  const REJOIN_SOURCE_MS = 280;
  const ENTRY_MS = 900;
  const REJOIN_MS = 420;
  const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

  function adjustedOptions(target, options) {
    if (!target?.classList?.contains('smirel-detail-star-canvas-layer')) return options;
    if (!options || typeof options !== 'object') return options;

    const duration = Number(options.duration);
    if (duration !== ENTRY_SOURCE_MS && duration !== REJOIN_SOURCE_MS) return options;

    return {
      ...options,
      duration: duration === ENTRY_SOURCE_MS ? ENTRY_MS : REJOIN_MS,
      easing: EASING,
    };
  }

  function animateWithSmirelMotionPolicy(keyframes, options) {
    return nativeAnimate.call(this, keyframes, adjustedOptions(this, options));
  }

  animateWithSmirelMotionPolicy[FLAG] = true;
  animateWithSmirelMotionPolicy.__smirelEntryMs = ENTRY_MS;
  animateWithSmirelMotionPolicy.__smirelRejoinMs = REJOIN_MS;
  animateWithSmirelMotionPolicy.__smirelEasing = EASING;
  Element.prototype.animate = animateWithSmirelMotionPolicy;
})();
