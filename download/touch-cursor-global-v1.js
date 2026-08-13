(() => {
  const dot = document.getElementById("cursorDot");
  const follow = document.getElementById("cursorFollow");
  if (!dot || !follow) return;

  let targetX = window.innerWidth * 0.5;
  let targetY = window.innerHeight * 0.5;
  let followX = targetX;
  let followY = targetY;
  let touching = false;
  let hideTimer = 0;
  let raf = 0;

  const forceTouchCursorStyle = (node) => {
    node.style.setProperty("display", "block", "important");
    node.style.setProperty("pointer-events", "none", "important");
    node.style.setProperty("position", "fixed", "important");
    node.style.setProperty("z-index", "99999", "important");
    node.style.setProperty("will-change", "transform, opacity", "important");
  };

  forceTouchCursorStyle(dot);
  forceTouchCursorStyle(follow);

  const show = () => {
    window.clearTimeout(hideTimer);
    dot.classList.add("cursor-visible");
    follow.classList.add("cursor-visible");
    dot.style.setProperty("opacity", "1", "important");
    follow.style.setProperty("opacity", "1", "important");
  };

  const hideLater = () => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (touching) return;
      dot.style.setProperty("opacity", "0", "important");
      follow.style.setProperty("opacity", "0", "important");
      dot.classList.remove("cursor-visible");
      follow.classList.remove("cursor-visible");
    }, 360);
  };

  const setTarget = (touch, snap = false) => {
    if (!touch) return;
    targetX = touch.clientX;
    targetY = touch.clientY;
    dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    if (snap) {
      followX = targetX;
      followY = targetY;
      follow.style.transform = `translate3d(${followX}px, ${followY}px, 0)`;
    }
  };

  const animate = () => {
    if (touching) {
      followX += (targetX - followX) * 0.35;
      followY += (targetY - followY) * 0.35;
      follow.style.transform = `translate3d(${followX}px, ${followY}px, 0)`;
    }
    raf = window.requestAnimationFrame(animate);
  };

  const onTouchStart = (event) => {
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (!touch) return;
    touching = true;
    setTarget(touch, true);
    show();
    follow.classList.add("pressed");
  };

  const onTouchMove = (event) => {
    if (!touching) return;
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (!touch) return;
    setTarget(touch, false);
    show();
  };

  const onTouchEnd = (event) => {
    const touch = event.changedTouches?.[0];
    if (touch) setTarget(touch, false);
    touching = false;
    follow.classList.remove("pressed");
    hideLater();
  };

  document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
  document.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
  document.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
  document.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });

  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    targetX = event.clientX;
    targetY = event.clientY;
    show();
  }, { passive: true, capture: true });

  window.addEventListener("pagehide", () => {
    if (raf) window.cancelAnimationFrame(raf);
  }, { once: true });

  raf = window.requestAnimationFrame(animate);
})();
