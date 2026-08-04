(() => {
  const toggle = document.getElementById('crtToggle');
  if (!toggle) return;

  const storageKey = 'chen-homepage-crt-lines';
  let enabled = true;

  try {
    enabled = localStorage.getItem(storageKey) !== 'off';
  } catch (_) {
    enabled = true;
  }

  function applyState() {
    document.body.classList.toggle('crt-lines-off', !enabled);
    toggle.classList.toggle('is-on', enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('title', enabled ? '关闭 CRT 条纹' : '开启 CRT 条纹');
  }

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    applyState();

    try {
      localStorage.setItem(storageKey, enabled ? 'on' : 'off');
    } catch (_) {
      // Storage is optional; the visual state still works for this session.
    }
  });

  applyState();
})();
