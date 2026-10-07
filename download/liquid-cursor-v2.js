import { glassOffset } from './liquid-glass-math.mjs?v=20261007-3';
// Live backdrop lens: original Loom interaction springs, browser-rendered background.
(()=>{
const FREE_ROI_SIZE = 420;
const SNAP_ROI_PADDING = 160;
const MAX_ROI_SIZE = 1200;
const BASE_WIDTH = 80;
const BASE_HEIGHT = 54;
const FREE_OFFSET_Y = -32;
const SNAP_DISTANCE = 12;
const RELEASE_DISTANCE = 17;
const SNAP_PADDING = 10;
const FREE_ROI_PADDING = 64;
const ROI_DEADZONE = 35;
const WALLPAPER_URL = new URL("./wallpaper-rain-anime-v1.png", document.baseURI).href;
const SNAP_SELECTOR = '.brand, .portal-title h1, #versionNumber, button:not(:disabled):not(.utility-card), input:not(:disabled), .portal-nav a, .utility-card h3, .modal-body a, .modal-body button:not(:disabled), summary';
const MAGNETIC_SELECTOR = '.brand, .portal-nav a, .login-button:not(:disabled), .download-button:not(:disabled), .account-link-button, .switch-account-button, .logout-button, .modal-close';
function stepSpring(spring, dt, stiffness, damping) {
    const acceleration = (spring.target - spring.value) * stiffness;
    spring.velocity += acceleration * dt;
    spring.velocity *= Math.exp(-damping * dt);
    spring.value += spring.velocity * dt;
}
function rectDistance(rect, x, y) {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    return Math.hypot(dx, dy);
}
function intersects(rect, left, top, width, height) {
    return rect.right >= left && rect.left <= left + width && rect.bottom >= top && rect.top <= top + height;
}

function createBackdropLens(lens){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.style.position='absolute';svg.dataset.loomLiquidCursor='true';let nodes='';
 nodes='<feImage result="map0" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="map0" scale="128" xChannelSelector="R" yChannelSelector="G"/>';
 svg.innerHTML='<defs><filter id="download-live-glass" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">'+nodes+'</filter></defs>';document.body.appendChild(svg);
 const images=[...svg.querySelectorAll('feImage')],map=document.createElement('canvas'),ctx=map.getContext('2d');let key='',last=0;const cache=new Map();const displacement=svg.querySelector('feDisplacementMap');
 const supported=/Chrome|Chromium|Edg\//.test(navigator.userAgent)&&CSS.supports('backdrop-filter','url(#download-live-glass)');lens.dataset.renderer=supported?'backdrop-refraction':'backdrop-blur';lens.style.backdropFilter=supported?'url(#download-live-glass)':'blur(2px) saturate(115%)';lens.style.webkitBackdropFilter=lens.style.backdropFilter;
 return {draw(x,y,w,h,p,visible,snap){w=Math.max(20,w);h=Math.max(20,h);const mw=Math.min(600,Math.max(40,Math.round(w/16)*16)),mh=Math.min(300,Math.max(28,Math.round(h/8)*8)),sp=Math.round(snap*16)/16,pr=Math.round(Math.max(0,p)*16)/16,next=[mw,mh,Math.round(sp*4)/4].join(':'),now=performance.now();
 if(supported&&next!==key&&(now-last>=80||!key)){key=next;last=now;map.width=mw;map.height=mh;
 const cached=cache.get(next);if(cached){images[0].setAttribute('href',cached);}else for(let c=0;c<1;c++){const pixels=ctx.createImageData(mw,mh);for(let py=0;py<mh;py++)for(let px=0;px<mw;px++){const v=glassOffset((px+.5)*w/mw,(py+.5)*h/mh,w,h,Math.round(sp*4)/4,0,0),i=(py*mw+px)*4;pixels.data[i]=Math.round(255*(.5+Math.max(-63,Math.min(63,v.x))/128));pixels.data[i+1]=Math.round(255*(.5+Math.max(-63,Math.min(63,v.y))/128));pixels.data[i+2]=128;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);const url=map.toDataURL();cache.set(next,url);if(cache.size>32)cache.delete(cache.keys().next().value);images[c].setAttribute('href',url);}}
 displacement.setAttribute('scale',String(128*(1+Math.max(0,p)*.15)));
 lens.style.width=w+'px';lens.style.height=h+'px';lens.style.transform='translate3d('+(x-w/2)+'px,'+(y-h/2)+'px,0)';lens.style.opacity=visible?'1':'0';}};
}
function mountLiquidCursor() {
    const root = document.body;
    const canvas = document.createElement('div');
    const dot = document.createElement('div');
    canvas.className = 'loom-liquid-cursor-canvas';
    dot.className = 'loom-liquid-cursor-dot';
    for (const element of [canvas, dot]) {
        element.dataset.loomLiquidCursor = 'true';
        element.setAttribute('aria-hidden', 'true');
        root.appendChild(element);
    }
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reducedMotion)
        return;
    const renderer = createBackdropLens(canvas);
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let pointerInside = false;
    let pressed = false;
    const pressure = { value: 0, velocity: 0, target: 0 };
    let activeTarget = null;
    let raf = 0;
    let lastTime = performance.now();
    let lastCapture = 0;
    let lastRoiLeft = Number.NaN;
    let lastRoiTop = Number.NaN;
    let roiLeft = Number.NaN;
    let roiTop = Number.NaN;
    let roiLockedTarget = null;
    let snappedRoiWidth = FREE_ROI_SIZE;
    let snappedRoiHeight = FREE_ROI_SIZE;
    let rasterDirty = true;
    let textureReady = false;
    let snapDirty = true;
    let running = false;
    const x = { value: pointerX, velocity: 0, target: pointerX };
    const y = { value: pointerY + FREE_OFFSET_Y, velocity: 0, target: pointerY + FREE_OFFSET_Y };
    const width = { value: BASE_WIDTH, velocity: 0, target: BASE_WIDTH };
    const height = { value: BASE_HEIGHT, velocity: 0, target: BASE_HEIGHT };
    const snap = { value: 0, velocity: 0, target: 0 };
    const magneticStates = new Map();
    let magneticTargets = [];
    const refreshMagneticTargets = () => {
        const next = Array.from(root.querySelectorAll(MAGNETIC_SELECTOR));
        const nextSet = new Set(next);
        for (const [element] of magneticStates) {
            if (!nextSet.has(element)) {
                element.style.removeProperty("translate");
                magneticStates.delete(element);
            }
        }
        magneticTargets = next;
        for (const element of magneticTargets) {
            if (!magneticStates.has(element)) {
                magneticStates.set(element, {
                    x: { value: 0, velocity: 0, target: 0 },
                    y: { value: 0, velocity: 0, target: 0 },
                    appliedX: 0,
                    appliedY: 0,
                });
            }
        }
    };
    const updateMagneticTargets = (dt) => {
        let settled = true;
        for (const element of magneticTargets) {
            const state = magneticStates.get(element);
            if (!state || !element.isConnected)
                continue;
            const rect = element.getBoundingClientRect();
            const baseLeft = rect.left - state.appliedX;
            const baseTop = rect.top - state.appliedY;
            const baseRight = baseLeft + rect.width;
            const baseBottom = baseTop + rect.height;
            const hoverArea = element.classList.contains("brand") ? 22 : 18;
            const inside = pointerInside &&
                pointerX >= baseLeft - hoverArea &&
                pointerX <= baseRight + hoverArea &&
                pointerY >= baseTop - hoverArea &&
                pointerY <= baseBottom + hoverArea;
            if (inside) {
                const centerX = baseLeft + rect.width / 2;
                const centerY = baseTop + rect.height / 2;
                const normalizedX = Math.max(-1, Math.min(1, (pointerX - centerX) / Math.max(rect.width / 2, 1)));
                const normalizedY = Math.max(-1, Math.min(1, (pointerY - centerY) / Math.max(rect.height / 2, 1)));
                const distance = element.classList.contains("brand") ? 8 : (activeTarget === element ? 7 : 10);
                state.x.target = normalizedX * distance;
                state.y.target = normalizedY * distance;
            }
            else {
                state.x.target = 0;
                state.y.target = 0;
            }
            // Slightly under-damped on purpose: the target follows the pointer and
            // gives one restrained elastic swing when it is released.
            stepSpring(state.x, dt, 250, 21);
            stepSpring(state.y, dt, 250, 21);
            const nextX = Math.round(state.x.value * 2) / 2;
            const nextY = Math.round(state.y.value * 2) / 2;
            if (Math.abs(nextX - state.appliedX) >= 0.49 || Math.abs(nextY - state.appliedY) >= 0.49) {
                state.appliedX = nextX;
                state.appliedY = nextY;
                if (Math.abs(nextX) < 0.125 && Math.abs(nextY) < 0.125 && state.x.target === 0 && state.y.target === 0) {
                    element.style.removeProperty("translate");
                    state.appliedX = 0;
                    state.appliedY = 0;
                }
                else {
                    element.style.setProperty("translate", `${nextX}px ${nextY}px`);
                }
                rasterDirty = true;
                snapDirty = true;
            }
            if (Math.abs(state.x.target - state.x.value) >= 0.08 ||
                Math.abs(state.y.target - state.y.value) >= 0.08 ||
                Math.abs(state.x.velocity) >= 0.08 ||
                Math.abs(state.y.velocity) >= 0.08) {
                settled = false;
            }
        }
        return settled;
    };
    refreshMagneticTargets();
    const findSnapTarget = () => {
        if (activeTarget?.isConnected && !activeTarget.closest("[hidden], [inert]") && (!(root.querySelector(".modal-layer:not([hidden])")) || activeTarget.closest(".modal-layer"))) {
            if (rectDistance(activeTarget.getBoundingClientRect(), pointerX, pointerY) <= RELEASE_DISTANCE)
                return activeTarget;
        }
        activeTarget = null;
        let closest = SNAP_DISTANCE + 0.001;
        for (const candidate of Array.from(root.querySelectorAll(SNAP_SELECTOR))) {
            if (candidate.dataset.loomLiquidCursor === "true")
                continue;
            const style = getComputedStyle(candidate);
            if (candidate.closest("[hidden], [inert]") || (root.querySelector(".modal-layer:not([hidden])") && !candidate.closest(".modal-layer")))
                continue;
            if (style.pointerEvents === "none" || style.visibility === "hidden" || style.display === "none")
                continue;
            const rect = candidate.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0)
                continue;
            const distance = rectDistance(rect, pointerX, pointerY);
            if (distance <= closest) {
                closest = distance;
                activeTarget = candidate;
            }
        }
        return activeTarget;
    };
    const updateTargets = () => {
        if (!snapDirty && !activeTarget)
            return;
        snapDirty = false;
        const previousTarget = activeTarget;
        const target = findSnapTarget();
        if (target !== previousTarget) {
            rasterDirty = true;
            roiLockedTarget = null;
            if (target) {
                const rect = target.getBoundingClientRect();
                const finalLensWidth = Math.min(Math.max(38, window.innerWidth - 20), Math.max(38, rect.width + SNAP_PADDING * 2));
                const finalLensHeight = Math.min(Math.max(34, window.innerHeight - 20), Math.max(34, rect.height + SNAP_PADDING * 2));
                snappedRoiWidth = Math.min(MAX_ROI_SIZE, Math.max(FREE_ROI_SIZE, Math.ceil((finalLensWidth + SNAP_ROI_PADDING * 2) / 16) * 16));
                snappedRoiHeight = Math.min(MAX_ROI_SIZE, Math.max(FREE_ROI_SIZE, Math.ceil((finalLensHeight + SNAP_ROI_PADDING * 2) / 16) * 16));
            }
        }
        if (target) {
            const rect = target.getBoundingClientRect();
            x.target = rect.left + rect.width / 2;
            y.target = rect.top + rect.height / 2;
            width.target = Math.min(Math.max(38, window.innerWidth - 20), Math.max(38, rect.width + SNAP_PADDING * 2));
            height.target = Math.min(Math.max(34, window.innerHeight - 20), Math.max(34, rect.height + SNAP_PADDING * 2));
            snap.target = 1;
        }
        else {
            x.target = pointerX;
            y.target = pointerY + FREE_OFFSET_Y;
            width.target = BASE_WIDTH;
            height.target = BASE_HEIGHT;
            snap.target = 0;
        }
    };
    const ensureFrame = () => {
        if (running)
            return;
        running = true;
        lastTime = performance.now();
        raf = window.requestAnimationFrame(frame);
    };
    const frame = (now) => {
        const dt = Math.min(0.032, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        const magneticSettled = updateMagneticTargets(dt);
        updateTargets();
        const snapping = Boolean(activeTarget) || snap.target > 0.001;
        stepSpring(x, dt, snapping ? 300 : 500, snapping ? 25 : 60);
        stepSpring(y, dt, snapping ? 300 : 500, snapping ? 25 : 60);
        stepSpring(width, dt, snapping ? 235 : 310, snapping ? 19 : 32);
        stepSpring(height, dt, snapping ? 235 : 310, snapping ? 19 : 32);
        stepSpring(snap, dt, 220, 18);
        // Firm compression on contact, then one softer elastic release.
        stepSpring(pressure, dt, pressed ? 620 : 400, pressed ? 38 : 23);
        const deformation = Math.max(-0.22, Math.min(1.08, pressure.value));
        renderer.draw(x.value, y.value, width.value * (1 + 0.025 * deformation), height.value * (1 - 0.085 * deformation), deformation, pointerInside, snap.value);
        const settled = Math.abs(x.target - x.value) < 0.08 &&
            Math.abs(y.target - y.value) < 0.08 &&
            Math.abs(width.target - width.value) < 0.08 &&
            Math.abs(height.target - height.value) < 0.08 &&
            Math.abs(snap.target - snap.value) < 0.002 &&
            Math.abs(x.velocity) < 0.08 &&
            Math.abs(y.velocity) < 0.08 &&
            Math.abs(width.velocity) < 0.08 &&
            Math.abs(height.velocity) < 0.08 &&
            Math.abs(pressure.target - pressure.value) < 0.001 &&
            Math.abs(pressure.velocity) < 0.01 &&
            magneticSettled;
        if (settled) {
            running = false;
            return;
        }
        raf = window.requestAnimationFrame(frame);
    };
    const wake = () => ensureFrame();
    const handlePointerMove = (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        pointerInside = true;
        snapDirty = true;
        wake();
    };
    const handlePointerDown = (event) => {
        if (event.button !== 0)
            return;
        pressed = true;
        pressure.target = 1;
        // A brief tap still has a visible contact phase before its release.
        pressure.velocity = Math.max(pressure.velocity, 5);
        rasterDirty = true;
        snapDirty = true;
        wake();
    };
    const handlePointerUp = () => {
        if (!pressed)
            return;
        pressed = false;
        pressure.target = 0;
        pressure.value = Math.max(pressure.value, 0.22);
        pressure.velocity = Math.min(pressure.velocity, -3.5);
        rasterDirty = true;
        snapDirty = true;
        wake();
    };
    const handlePointerLeave = () => {
        pointerInside = false;
        pressed = false;
        pressure.target = 0;
        activeTarget = null;
        snap.target = 0;
        snapDirty = true;
        wake();
    };
    const handlePointerEnter = () => { pointerInside = true; snapDirty = true; wake(); };
    const handleScroll = () => { rasterDirty = true; snapDirty = true; wake(); };
    // Editing changes input.value without mutating DOM text or attributes.
    const handleInput = () => { rasterDirty = true; wake(); };
    const handleResize = () => {
        roiLeft = Number.NaN;
        roiTop = Number.NaN;
        roiLockedTarget = null;
        rasterDirty = true;
        snapDirty = true;
        wake();
    };
    const observer = new MutationObserver(() => {
        refreshMagneticTargets();
        rasterDirty = true;
        snapDirty = true;
        wake();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["type", "value", "placeholder", "hidden", "disabled", "open"] });
    const resizeObserver = new ResizeObserver(() => { rasterDirty = true; snapDirty = true; wake(); });
    resizeObserver.observe(root);
    document.fonts?.ready.then(() => { rasterDirty = true; wake(); }).catch(() => { });
    root.addEventListener("pointermove", handlePointerMove);
    root.addEventListener("pointerdown", handlePointerDown);
    root.addEventListener("pointerup", handlePointerUp);
    root.addEventListener("pointercancel", handlePointerUp);
    root.addEventListener("pointerleave", handlePointerLeave);
    root.addEventListener("pointerenter", handlePointerEnter);
    root.addEventListener("input", handleInput, true);
    root.addEventListener("change", handleInput, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    window.addEventListener("blur", handlePointerLeave);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    document.documentElement.classList.add("loom-liquid-cursor-active");
    ensureFrame();
    return () => {
        window.cancelAnimationFrame(raf);
        observer.disconnect();
        resizeObserver.disconnect();
        root.removeEventListener("pointermove", handlePointerMove);
        root.removeEventListener("pointerdown", handlePointerDown);
        root.removeEventListener("pointerup", handlePointerUp);
        root.removeEventListener("pointercancel", handlePointerUp);
        root.removeEventListener("pointerleave", handlePointerLeave);
        root.removeEventListener("pointerenter", handlePointerEnter);
        root.removeEventListener("input", handleInput, true);
        root.removeEventListener("change", handleInput, true);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("blur", handlePointerLeave);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        document.documentElement.classList.remove("loom-liquid-cursor-active");
        for (const element of magneticTargets)
            element.style.removeProperty("translate");
        magneticStates.clear();
    };
}
mountLiquidCursor();

})();
