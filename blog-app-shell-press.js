(() => {
  'use strict';

  /* Direct port of AI Ledger Glass.kt Shell press timing, deformation and optics. */
  const HOSTS = '.article-glass-card, .article-control-bar, #articleToc';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (v) => { const x = clamp(v, 0, 1); return x * x * (3 - 2 * x); };
  const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;

  function bezier(x1, y1, x2, y2) {
    const xAt = (t) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
    const yAt = (t) => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
    const dx = (t) => 3 * (1 - t) ** 2 * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    return (p) => {
      const target = clamp(p, 0, 1);
      let t = target;
      for (let i = 0; i < 7; i += 1) {
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t = clamp(t - (xAt(t) - target) / d, 0, 1);
      }
      let lo = 0; let hi = 1;
      for (let i = 0; i < 10; i += 1) {
        const x = xAt(t);
        if (Math.abs(x - target) < 1e-6) break;
        if (x < target) lo = t; else hi = t;
        t = (lo + hi) * 0.5;
      }
      return yAt(t);
    };
  }

  const ease = Object.freeze({
    preload: bezier(0.20, 0.00, 0.18, 1.00),
    sink: bezier(0.14, 0.00, 0.10, 1.00),
    release: bezier(0.18, 0.00, 0.16, 1.00),
    pulse: bezier(0.16, 0.00, 0.12, 1.00),
    fast: bezier(0.40, 0.00, 0.20, 1.00),
  });

  class Track {
    constructor(change) { this.value = 0; this.version = 0; this.change = change; }
    begin() { this.version += 1; return this.version; }
    set(value, version = this.version) {
      if (version !== this.version) return false;
      this.value = value; this.change(value); return true;
    }
    tween(target, duration, easing, version) {
      const start = this.value; const at = performance.now();
      return new Promise((resolve) => {
        const tick = (now) => {
          if (version !== this.version) return resolve(false);
          const p = clamp((now - at) / Math.max(1, duration), 0, 1);
          this.set(start + (target - start) * easing(p), version);
          if (p < 1) requestAnimationFrame(tick); else resolve(true);
        };
        requestAnimationFrame(tick);
      });
    }
    spring(target, damping, stiffness, version) {
      const a = this.value - target;
      if (Math.abs(a) < 0.0001) { this.set(target, version); return Promise.resolve(true); }
      const w0 = Math.sqrt(stiffness); const z = clamp(damping, 0.001, 0.999);
      const wd = w0 * Math.sqrt(1 - z * z); const b = z * w0 * a / wd;
      const at = performance.now(); const maxMs = stiffness <= 60 ? 2600 : 1800;
      return new Promise((resolve) => {
        const tick = (now) => {
          if (version !== this.version) return resolve(false);
          const t = (now - at) / 1000; const decay = Math.exp(-z * w0 * t);
          const offset = decay * (a * Math.cos(wd * t) + b * Math.sin(wd * t));
          this.set(target + offset, version);
          if (Math.abs(offset) >= 0.0008 && now - at < maxMs) requestAnimationFrame(tick);
          else { this.set(target, version); resolve(true); }
        };
        requestAnimationFrame(tick);
      });
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = clamp(r, 0, Math.min(w, h) * 0.5); ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, radius); return; }
    ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius); ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius); ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
  }

  function stops(gradient, colors) {
    const last = Math.max(1, colors.length - 1);
    colors.forEach((color, index) => gradient.addColorStop(index / last, color));
    return gradient;
  }

  function fill(ctx, brush, blend, w, h) {
    ctx.save(); ctx.globalCompositeOperation = blend; ctx.fillStyle = brush; ctx.fillRect(0, 0, w, h); ctx.restore();
  }

  function stroke(ctx, brush, blend, lineWidth, inset, radius, w, h) {
    ctx.save(); ctx.globalCompositeOperation = blend; ctx.strokeStyle = brush; ctx.lineWidth = Math.max(0.2, lineWidth);
    roundRect(ctx, inset, inset, Math.max(1, w - inset * 2), Math.max(1, h - inset * 2), radius);
    ctx.stroke(); ctx.restore();
  }

  class ShellPressHost {
    constructor(element) {
      this.element = element;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'app-shell-press-optics'; this.canvas.setAttribute('aria-hidden', 'true');
      this.ctx = this.canvas.getContext('2d'); this.element.appendChild(this.canvas);
      this.element.classList.add('app-shell-press-host');
      this.press = 0; this.openGl = 0; this.center = { x: 0.50, y: 0.42 };
      this.seed = 0.50; this.direction = 1; this.band = 0; this.strength = 1;
      this.pointerId = null; this.frame = 0; this.disposed = false;
      this.pressTrack = new Track((v) => { this.press = v; this.invalidate(); });
      this.openTrack = new Track((v) => { this.openGl = v; this.invalidate(); });
      this.down = this.down.bind(this); this.move = this.move.bind(this);
      this.up = this.up.bind(this); this.cancel = this.cancel.bind(this);
      element.addEventListener('pointerdown', this.down); this.invalidate();
    }

    attachGlobal() {
      addEventListener('pointermove', this.move, true);
      addEventListener('pointerup', this.up, true);
      addEventListener('pointercancel', this.cancel, true);
    }
    detachGlobal() {
      removeEventListener('pointermove', this.move, true);
      removeEventListener('pointerup', this.up, true);
      removeEventListener('pointercancel', this.cancel, true);
    }
    updateCenter(event) {
      const r = this.element.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return;
      this.center.x = clamp((event.clientX - r.left) / r.width, 0, 1);
      this.center.y = clamp((event.clientY - r.top) / r.height, 0, 1); this.invalidate();
    }
    down(event) {
      if (reducedMotion.matches || this.pointerId !== null) return;
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      this.pointerId = event.pointerId; this.updateCenter(event);
      this.seed = Math.random(); this.direction = Math.random() >= 0.5 ? 1 : -1;
      this.band = Math.floor(Math.random() * 4); this.strength = 0.86 + Math.random() * 0.52;
      this.attachGlobal(); this.beginPress();
    }
    move(event) { if (event.pointerId === this.pointerId) this.updateCenter(event); }
    up(event) {
      if (event.pointerId !== this.pointerId) return;
      this.updateCenter(event); this.pointerId = null; this.detachGlobal(); this.releasePress(true);
    }
    cancel(event) {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = null; this.detachGlobal(); this.releasePress(false);
    }

    beginPress() {
      const p = this.pressTrack.begin(); if (this.pressTrack.value < 0.18) this.pressTrack.set(0.18, p);
      void (async () => {
        if (!await this.pressTrack.tween(0.42, 150, ease.pulse, p)) return;
        if (!await this.pressTrack.tween(0.62, 360, ease.sink, p)) return;
        if (!await this.pressTrack.tween(0.76, 620, ease.fast, p)) return;
        if (!await this.pressTrack.tween(0.62, 680, ease.fast, p)) return;
        await this.pressTrack.spring(0.70, 0.95, 50, p);
      })();
      const g = this.openTrack.begin();
      void (async () => {
        if (!await this.openTrack.tween(0.26, 230, ease.preload, g)) return;
        if (!await this.openTrack.tween(0.72, 520, ease.sink, g)) return;
        if (!await this.openTrack.tween(0.88, 620, ease.fast, g)) return;
        if (!await this.openTrack.tween(0.74, 680, ease.fast, g)) return;
        await this.openTrack.spring(0.80, 0.95, 50, g);
      })();
    }

    releasePress(normal) {
      const g = this.openTrack.begin();
      void (async () => {
        if (normal && this.openTrack.value < 0.24 && !await this.openTrack.tween(0.34, 120, ease.pulse, g)) return;
        await this.openTrack.tween(0, normal ? 560 : 380, ease.fast, g);
      })();
      const p = this.pressTrack.begin();
      void (async () => {
        if (!normal) { await this.pressTrack.tween(0, 430, ease.fast, p); return; }
        if (this.pressTrack.value < 0.46) {
          if (!await this.pressTrack.tween(0.52, 105, ease.pulse, p)) return;
          if (!await this.pressTrack.tween(-0.060, 150, ease.release, p)) return;
        } else if (!await this.pressTrack.tween(-0.065, 220, ease.release, p)) return;
        await this.pressTrack.spring(0, 0.66, 200, p);
      })();
    }

    snapshot() {
      const compression = smooth(Math.max(this.press, 0) / 0.72);
      const rebound = smooth(-this.press / 0.10);
      return {
        compression,
        rebound,
        optics: Math.max(Math.max(this.press, 0), clamp(this.openGl, 0, 1) * 0.62, rebound * 0.24),
      };
    }

    invalidate() {
      if (this.frame || this.disposed) return;
      this.frame = requestAnimationFrame(() => { this.frame = 0; this.render(); });
    }

    render() {
      if (this.disposed) return;
      const d = this.snapshot();
      this.element.style.setProperty('--app-shell-origin-x', `${this.center.x * 100}%`);
      this.element.style.setProperty('--app-shell-origin-y', `${this.center.y * 100}%`);
      this.element.style.setProperty('--app-shell-scale-x', (1 + d.compression * 0.014 - d.rebound * 0.004).toFixed(6));
      this.element.style.setProperty('--app-shell-scale-y', (1 - d.compression * 0.022 + d.rebound * 0.008).toFixed(6));
      this.element.style.setProperty('--app-shell-translate-y', `${(d.compression * 2.10 - d.rebound * 0.80).toFixed(4)}px`);
      this.drawOptics(d.optics);
    }

    drawOptics(optics) {
      if (!this.ctx) return;
      const rect = this.element.getBoundingClientRect(); const w = rect.width; const h = rect.height;
      if (w <= 1 || h <= 1) return;
      const dpr = Math.min(devicePixelRatio || 1, 2); const cw = Math.round(w * dpr); const ch = Math.round(h * dpr);
      if (this.canvas.width !== cw) this.canvas.width = cw; if (this.canvas.height !== ch) this.canvas.height = ch;
      const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const safe = clamp(optics, 0, 1.08); if (safe < 0.001) return;

      const radius = clamp(parseFloat(getComputedStyle(this.element).borderTopLeftRadius) || 0, 0, Math.min(w, h) * 0.5);
      const p = smooth(safe / 0.72);
      const breath = smooth(safe / 0.50) * (1 - 0.11 * smooth((safe - 0.58) / 0.28));
      const compression = p * p; const center = { x: this.center.x * w, y: this.center.y * h };
      const maxSide = Math.max(w, h); const inset = 0.56; const rimRadius = Math.max(0, radius - inset);
      const near = (distance) => clamp(1 - distance / 0.42, 0, 1) * p;
      const edgeStroke = 0.74 + 0.26 * p; const localStroke = 1.18 + 0.48 * p;
      const flow = smooth(safe / 0.62); const seedShift = (this.seed - 0.5) * 0.36;
      const sweepX = this.direction >= 0 ? -0.24 + seedShift + flow * 1.42 : 1.24 + seedShift - flow * 1.42;
      const startY = [0.02, 0.74, 0.10, 0.18][this.band % 4];
      const endY = [0.26, 0.98, 0.92, 0.58][this.band % 4];
      const bandAlpha = breath * clamp(this.strength, 0.70, 1.45); const prism = 1; const prismSoft = 0.55;

      ctx.save(); roundRect(ctx, 0, 0, w, h, radius); ctx.clip();
      fill(ctx, stops(ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, maxSide * 1.18), [rgba(255,255,255,.021*breath), rgba(216,255,255,.014*breath), rgba(0,0,0,0)]), 'screen', w, h);
      fill(ctx, stops(ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, maxSide * (.86 + .06 * p)), [rgba(239,255,255,.066*breath), rgba(184,247,255,.032*breath), rgba(130,232,255,.010*breath), rgba(0,0,0,0)]), 'screen', w, h);
      fill(ctx, stops(ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, maxSide * (1 + .035 * p)), [rgba(0,0,0,0), rgba(16,44,102,.006*p), rgba(3,11,26,.034*compression)]), 'multiply', w, h);
      fill(ctx, stops(ctx.createLinearGradient(0, h * .44, 0, h), [rgba(0,0,0,0), rgba(0,0,0,0), rgba(2,8,21,.044*compression)]), 'multiply', w, h);

      const ambient = stops(ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, maxSide * .74), [rgba(239,255,255,.052*breath), rgba(146,255,241,(.018+.020*prismSoft)*breath), rgba(255,139,232,.014*prismSoft*breath), rgba(0,0,0,0)]);
      stroke(ctx, ambient, 'screen', edgeStroke, inset, rimRadius, w, h);
      const flowing = stops(ctx.createLinearGradient(w*(sweepX-.26), h*startY, w*(sweepX+.22), h*endY), [rgba(0,0,0,0), rgba(255,106,219,.20*prism*bandAlpha), rgba(255,255,255,.34*bandAlpha), rgba(255,224,138,.18*prism*bandAlpha), rgba(98,255,240,(.14+.16*prism)*bandAlpha), rgba(146,166,255,.12*prism*bandAlpha), rgba(0,0,0,0)]);
      stroke(ctx, flowing, 'lighter', .82 + .20 * prism, inset, rimRadius, w, h);

      const halo = (power, white, cyan) => [rgba(255,255,255,white*power), rgba(255,125,226,.050*prism*power), rgba(255,226,138,.036*prism*power), rgba(128,255,242,cyan*power*(.65+prism*.35)), rgba(0,0,0,0)];
      stroke(ctx, stops(ctx.createRadialGradient(center.x, inset, 0, center.x, inset, maxSide*.38), halo(near(this.center.y), .23, .072)), 'screen', localStroke, inset, rimRadius, w, h);
      stroke(ctx, stops(ctx.createRadialGradient(center.x, h-inset, 0, center.x, h-inset, maxSide*.36), halo(near(1-this.center.y), .16, .054)), 'screen', localStroke, inset, rimRadius, w, h);
      stroke(ctx, stops(ctx.createRadialGradient(inset, center.y, 0, inset, center.y, maxSide*.34), halo(near(this.center.x), .18, .060)), 'screen', localStroke, inset, rimRadius, w, h);
      stroke(ctx, stops(ctx.createRadialGradient(w-inset, center.y, 0, w-inset, center.y, maxSide*.34), halo(near(1-this.center.x), .18, .060)), 'screen', localStroke, inset, rimRadius, w, h);
      ctx.restore();
    }

    dispose() {
      this.disposed = true; this.pressTrack.begin(); this.openTrack.begin(); cancelAnimationFrame(this.frame);
      this.detachGlobal(); this.element.removeEventListener('pointerdown', this.down);
      this.element.classList.remove('app-shell-press-host'); this.canvas.remove();
    }
  }

  class Manager {
    constructor(reader) {
      this.reader = reader; this.hosts = new Map(); this.frame = 0; this.schedule = this.schedule.bind(this);
      this.observer = new MutationObserver(this.schedule); this.observer.observe(reader, { childList: true, subtree: true });
      reader.addEventListener('blog:glass-hosts-changed', this.schedule); this.sync();
    }
    schedule() { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }
    sync() {
      const active = new Set([...this.reader.querySelectorAll(HOSTS)].filter((node) => node.isConnected));
      active.forEach((node) => { if (!this.hosts.has(node)) this.hosts.set(node, new ShellPressHost(node)); });
      for (const [node, host] of this.hosts) if (!active.has(node)) { host.dispose(); this.hosts.delete(node); }
    }
  }

  const install = (reader) => { if (reader && !reader.__appShellPressManager) reader.__appShellPressManager = new Manager(reader); };
  const reader = document.querySelector('.article-reader');
  if (reader) install(reader);
  else {
    const observer = new MutationObserver(() => {
      const next = document.querySelector('.article-reader'); if (!next) return;
      observer.disconnect(); install(next);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
