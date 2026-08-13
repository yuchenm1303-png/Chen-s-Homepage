(() => {
  const dot = document.getElementById("cursorDot");
  const follow = document.getElementById("cursorFollow");
  if (!dot || !follow || !window.PointerEvent) return;

  const root = document.documentElement;
  const styleId = "listing-studio-low-latency-cursor-style";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      html.cursor-low-latency .cursor-dot,
      html.cursor-low-latency .cursor-follow {
        transform: var(--ls-cursor-transform, translate3d(-100px, -100px, 0)) !important;
      }
    `;
    document.head.appendChild(style);
  }

  const move = (event) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;

    const coalesced = typeof event.getCoalescedEvents === "function"
      ? event.getCoalescedEvents()
      : null;
    const point = coalesced?.length ? coalesced[coalesced.length - 1] : event;
    const transform = `translate3d(${point.clientX}px, ${point.clientY}px, 0)`;

    dot.style.setProperty("--ls-cursor-transform", transform);
    follow.style.setProperty("--ls-cursor-transform", transform);
    root.classList.add("cursor-low-latency");
  };

  const releaseToTouchCursor = () => {
    root.classList.remove("cursor-low-latency");
  };

  window.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("touchstart", releaseToTouchCursor, { passive: true, capture: true });
  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") releaseToTouchCursor();
  }, { passive: true, capture: true });
  window.addEventListener("blur", releaseToTouchCursor);
})();
