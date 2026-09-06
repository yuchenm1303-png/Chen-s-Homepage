import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SOURCE_RELEASE, STAR_COUNT, FOV, productionBrightField as field, verifyProductionGenerator } from './starfield.js';

const ROLE_DEFS = Object.freeze([
  { id: 'blog', label: 'BLOG 主星', short: 'B' },
  { id: 'building-homepage', label: '从零搭建个人主页', short: '01' },
  { id: 'opengl-liquid-glass', label: 'OpenGL 液态玻璃', short: '02' },
  { id: 'computer-use-design', label: 'Computer Use / GUI', short: '03' },
  { id: 'gan-hemt-stability', label: 'GaN HEMT 数值稳定性', short: '04' },
  { id: 'ai-ledger-real-streaming', label: '真实流式回复', short: '05' },
  { id: 'app-performance-optimization', label: 'APP 性能优化', short: '06' },
  { id: 'compose-parent-bubble-rendering', label: 'Compose 父级绘制', short: '07' },
  { id: 'ai-listing-research', label: 'AI 自动上架', short: '08' },
]);
const ROLE_BY_ID = new Map(ROLE_DEFS.map((r, i) => [r.id, { ...r, index: i }]));
const CURRENT_PRODUCTION = Object.freeze({
  blog: 1363,
  'building-homepage': 14646,
  'opengl-liquid-glass': 6737,
  'computer-use-design': 3645,
  'gan-hemt-stability': 14687,
  'ai-ledger-real-streaming': 4657,
  'app-performance-optimization': 10767,
  'compose-parent-bubble-rendering': 3646,
  'ai-listing-research': 8,
});
const PREVIEW_EDGES = Object.freeze([
  ['blog', 'compose-parent-bubble-rendering'],
  ['compose-parent-bubble-rendering', 'opengl-liquid-glass'],
  ['opengl-liquid-glass', 'building-homepage'],
  ['blog', 'ai-listing-research'],
  ['ai-listing-research', 'app-performance-optimization'],
  ['app-performance-optimization', 'ai-ledger-real-streaming'],
  ['ai-ledger-real-streaming', 'gan-hemt-stability'],
  ['gan-hemt-stability', 'computer-use-design'],
]);
const STORAGE_KEY = `smirel-star-picker-v1:${SOURCE_RELEASE}`;

const $ = (id) => document.getElementById(id);
const canvas = $('pickerCanvas');
const rolesRoot = $('roles');
const markerLayer = $('markerLayer');
const hoverTip = $('hoverTip');
const toastEl = $('toast');
const exportBox = $('exportBox');
const selfCheckEl = $('selfCheck');
const activeRoleNameEl = $('activeRoleName');
const assignedCountEl = $('assignedCount');
const cameraStatusEl = $('cameraStatus');
const modeHintEl = $('modeHint');
const reservedLayer = $('reservedLayer');
$('sourceRelease').textContent = SOURCE_RELEASE.slice(0, 10);

if (!verifyProductionGenerator(field)) {
  selfCheckEl.textContent = '星场校验失败';
  selfCheckEl.classList.add('bad');
  throw new Error('Production star field mismatch; refusing to export indices.');
}
selfCheckEl.textContent = '星场校验通过';
selfCheckEl.classList.add('good');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x030507, 1);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030507);
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 220);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.screenSpacePanning = true;
controls.minDistance = 1.5;
controls.maxDistance = 120;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.75;
controls.panSpeed = 0.55;

const orbitHome = new THREE.Vector3(0, 0, 7.5);
const orbitTarget = new THREE.Vector3(-2, -1, -25);
function resetOrbit() {
  camera.fov = FOV;
  camera.position.copy(orbitHome);
  controls.target.copy(orbitTarget);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
  controls.update();
}
resetOrbit();

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function starPosition(index, out = new THREE.Vector3()) {
  const o = index * 3;
  return out.set(field.positions[o], field.positions[o + 1], field.positions[o + 2]);
}
function starInfo(index) {
  const o = index * 3;
  return {
    index,
    x: field.positions[o], y: field.positions[o + 1], z: field.positions[o + 2],
    depth: -field.positions[o + 2], brightness: field.brightness[index],
    opacity: field.opacity[index], scale: field.scale[index],
  };
}

// Render all real stars faintly; candidate stars are a brighter subset rebuilt by filters.
const backgroundColors = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  const o = i * 3;
  const energy = clamp(0.24 + field.brightness[i] * 0.16, 0.26, 0.72);
  backgroundColors[o] = field.colors[o] * energy;
  backgroundColors[o + 1] = field.colors[o + 1] * energy;
  backgroundColors[o + 2] = field.colors[o + 2] * energy;
}
const backgroundGeometry = new THREE.BufferGeometry();
backgroundGeometry.setAttribute('position', new THREE.BufferAttribute(field.positions, 3));
backgroundGeometry.setAttribute('color', new THREE.BufferAttribute(backgroundColors, 3));
const backgroundPoints = new THREE.Points(backgroundGeometry, new THREE.PointsMaterial({
  size: 1.35, sizeAttenuation: false, vertexColors: true, transparent: true,
  opacity: 0.48, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
}));
scene.add(backgroundPoints);

let candidateIndices = [];
const candidateGeometry = new THREE.BufferGeometry();
const candidatePoints = new THREE.Points(candidateGeometry, new THREE.PointsMaterial({
  size: 3.1, sizeAttenuation: false, vertexColors: true, transparent: true,
  opacity: 0.92, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
}));
scene.add(candidatePoints);

const selectedGeometry = new THREE.BufferGeometry();
const selectedPoints = new THREE.Points(selectedGeometry, new THREE.PointsMaterial({
  size: 11, sizeAttenuation: false, color: 0xffe6b5, transparent: true,
  opacity: 1, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
}));
selectedPoints.renderOrder = 20;
scene.add(selectedPoints);

const lineGeometry = new THREE.BufferGeometry();
const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({
  color: 0x91abc5, transparent: true, opacity: 0.46, depthTest: false, depthWrite: false,
}));
lines.renderOrder = 15;
scene.add(lines);

const selections = new Map();
const markerEls = new Map();
const roleRows = new Map();
let activeRoleId = 'blog';
let lastSelectedRoleId = null;
let cameraMode = 'orbit';
let homeTarget = { x: 0, y: 0 };
let homeCurrent = { x: 0, y: 0 };
let cssWidth = 1;
let cssHeight = 1;
let dragStart = null;
let dragging = false;
let toastTimer = 0;
let lastHoverAt = 0;

function makeRoleRow(role) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'role-row';
  el.dataset.roleId = role.id;
  el.innerHTML = `<span class="role-num">${role.short}</span><span class="role-copy"><strong>${role.label}</strong><small>点这一行，再点击三维星场中的星</small></span><span class="role-index">—<span class="role-safety"></span></span>`;
  el.addEventListener('click', () => setActiveRole(role.id));
  el.addEventListener('dblclick', () => removeRole(role.id));
  rolesRoot.appendChild(el);
  roleRows.set(role.id, el);
}
ROLE_DEFS.forEach(makeRoleRow);

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1700);
}
function setActiveRole(roleId) {
  if (!ROLE_BY_ID.has(roleId)) return;
  activeRoleId = roleId;
  activeRoleNameEl.textContent = ROLE_BY_ID.get(roleId).label;
  for (const [id, row] of roleRows) row.classList.toggle('active', id === roleId);
}
setActiveRole('blog');

function nextEmpty(afterId) {
  const start = ROLE_BY_ID.get(afterId)?.index ?? -1;
  for (let step = 1; step <= ROLE_DEFS.length; step++) {
    const role = ROLE_DEFS[(start + step) % ROLE_DEFS.length];
    if (!selections.has(role.id)) return role.id;
  }
  return afterId;
}
function usedBy(index, except = null) {
  for (const [roleId, value] of selections) if (roleId !== except && value === index) return roleId;
  return null;
}
function assignStar(roleId, index, autoAdvance = true) {
  const duplicate = usedBy(index, roleId);
  if (duplicate) return showToast(`这颗星已经属于「${ROLE_BY_ID.get(duplicate).label}」`);
  selections.set(roleId, index);
  lastSelectedRoleId = roleId;
  updateSelectionUi();
  persist();
  const info = starInfo(index);
  showToast(`${ROLE_BY_ID.get(roleId).label} ← #${index} · depth ${info.depth.toFixed(1)} · b ${info.brightness.toFixed(2)}`);
  if (autoAdvance) setActiveRole(nextEmpty(roleId));
}
function removeRole(roleId) {
  if (!selections.delete(roleId)) return;
  updateSelectionUi(); persist(); setActiveRole(roleId);
}
function clearAll() {
  selections.clear(); lastSelectedRoleId = null; updateSelectionUi(); persist(); setActiveRole('blog'); showToast('已清空全部选星');
}
function loadProduction() {
  selections.clear();
  for (const role of ROLE_DEFS) selections.set(role.id, CURRENT_PRODUCTION[role.id]);
  lastSelectedRoleId = 'blog'; updateSelectionUi(); persist(); setActiveRole('blog'); showToast('已载入当前正式主页星位');
}

function shapeAxis(value) {
  const dead = 0.045;
  const a = Math.abs(value);
  if (a <= dead) return 0;
  const n = Math.min(1, (a - dead) / (1 - dead));
  return Math.sign(value) * n * n * (3 - 2 * n);
}
const envelopeCamera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 64);
const envelopeLook = new THREE.Vector3();
const envelopePoint = new THREE.Vector3();
const pointerSamples = [-1, -0.5, 0, 0.5, 1];
const aspectSamples = [16 / 10, 16 / 9, 1.83, 2.0];
function envelope(index) {
  const p = starPosition(index, new THREE.Vector3());
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, visible = 0;
  for (const aspect of aspectSamples) {
    envelopeCamera.aspect = aspect;
    envelopeCamera.updateProjectionMatrix();
    for (const rawY of pointerSamples) for (const rawX of pointerSamples) {
      const x = shapeAxis(rawX), y = shapeAxis(rawY);
      envelopeCamera.position.set(x * 0.34, y * 0.20, 0);
      envelopeLook.set(x * 1.05, y * 0.62, -12);
      envelopeCamera.lookAt(envelopeLook);
      envelopeCamera.updateMatrixWorld(true);
      envelopePoint.copy(p).project(envelopeCamera);
      if (envelopePoint.z < -1 || envelopePoint.z > 1) continue;
      visible++;
      minX = Math.min(minX, envelopePoint.x); maxX = Math.max(maxX, envelopePoint.x);
      minY = Math.min(minY, envelopePoint.y); maxY = Math.max(maxY, envelopePoint.y);
    }
  }
  const margin = Math.min(1 - Math.max(Math.abs(minX), Math.abs(maxX)), 1 - Math.max(Math.abs(minY), Math.abs(maxY)));
  return { visible, margin };
}
function safety(index) {
  const e = envelope(index);
  if (e.visible < 100 || e.margin < 0) return ['会出屏', 'bad'];
  if (e.margin < 0.06) return ['贴边', 'warn'];
  return [`安全 ${(e.margin * 100).toFixed(0)}%`, 'good'];
}

function ensureMarker(role) {
  if (markerEls.has(role.id)) return markerEls.get(role.id);
  const el = document.createElement('div');
  el.className = 'selection-marker';
  markerLayer.appendChild(el);
  markerEls.set(role.id, el);
  return el;
}
function updateSelectionUi() {
  const selectedPositions = [];
  for (const role of ROLE_DEFS) {
    const row = roleRows.get(role.id);
    const index = selections.get(role.id);
    const indexEl = row.querySelector('.role-index');
    const safetyEl = row.querySelector('.role-safety');
    row.classList.toggle('assigned', Number.isInteger(index));
    if (Number.isInteger(index)) {
      const [text, cls] = safety(index);
      indexEl.firstChild.textContent = `#${index}`;
      safetyEl.textContent = text; safetyEl.className = `role-safety ${cls}`;
      selectedPositions.push(starPosition(index, new THREE.Vector3()));
      const marker = ensureMarker(role); marker.innerHTML = `${role.short}<span>#${index}</span>`; marker.hidden = false;
    } else {
      indexEl.firstChild.textContent = '—'; safetyEl.textContent = ''; safetyEl.className = 'role-safety';
      const marker = markerEls.get(role.id); if (marker) marker.hidden = true;
    }
  }
  selectedGeometry.setFromPoints(selectedPositions);
  const linePositions = [];
  if ($('showLinks').checked) for (const [a, b] of PREVIEW_EDGES) {
    if (!selections.has(a) || !selections.has(b)) continue;
    const pa = starPosition(selections.get(a), new THREE.Vector3());
    const pb = starPosition(selections.get(b), new THREE.Vector3());
    linePositions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
  }
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  assignedCountEl.textContent = `${selections.size} / ${ROLE_DEFS.length}`;
  updateExport();
}
function updateExport() {
  const out = ['SMIREL_STAR_PICKER_RESULT', `source=${SOURCE_RELEASE}`, 'seed=0xA57A2D31', '', 'const FIXED_INDICES = Object.freeze({'];
  for (const role of ROLE_DEFS) {
    const key = role.id === 'blog' ? 'blog' : `'${role.id}'`;
    out.push(`  ${key}: ${selections.has(role.id) ? selections.get(role.id) : 'TODO'},`);
  }
  out.push('});', '');
  for (const role of ROLE_DEFS) if (selections.has(role.id)) {
    const info = starInfo(selections.get(role.id));
    const [safe] = safety(info.index);
    out.push(`${role.label}: #${info.index} world=(${info.x.toFixed(3)}, ${info.y.toFixed(3)}, ${info.z.toFixed(3)}) depth=${info.depth.toFixed(2)} brightness=${info.brightness.toFixed(2)} ${safe}`);
  }
  exportBox.value = out.join('\n');
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(selections))); } catch {}
  updateHash(false);
}
function restore() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  let fromHash = false;
  for (const role of ROLE_DEFS) {
    const raw = params.get(role.id);
    if (raw !== null && /^\d+$/.test(raw)) {
      const index = Number(raw);
      if (index >= 0 && index < STAR_COUNT && !usedBy(index, role.id)) { selections.set(role.id, index); fromHash = true; }
    }
  }
  if (fromHash) return;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const role of ROLE_DEFS) {
      const index = saved[role.id];
      if (Number.isInteger(index) && index >= 0 && index < STAR_COUNT && !usedBy(index, role.id)) selections.set(role.id, index);
    }
  } catch {}
}
function updateHash(push) {
  const params = new URLSearchParams();
  for (const role of ROLE_DEFS) if (selections.has(role.id)) params.set(role.id, String(selections.get(role.id)));
  const hash = params.toString();
  history[push ? 'pushState' : 'replaceState'](null, '', `${location.pathname}${location.search}${hash ? `#${hash}` : ''}`);
}

function rebuildCandidates() {
  let minB = Number($('minBrightness').value), minD = Number($('minDepth').value), maxD = Number($('maxDepth').value);
  if (minD > maxD) [minD, maxD] = [maxD, minD];
  const positions = [], colors = [], indices = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const depth = -field.positions[i * 3];
    if (field.brightness[i] < minB || depth < minD || depth > maxD) continue;
    indices.push(i);
    const o = i * 3;
    positions.push(field.positions[o], field.positions[o + 1], field.positions[o + 2]);
    const boost = clamp(0.70 + field.brightness[i] * 0.17, 0.78, 1.25);
    colors.push(field.colors[o] * boost, field.colors[o + 1] * boost, field.colors[o + 2] * boost);
  }
  candidateIndices = indices;
  candidateGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  candidateGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  backgroundPoints.material.opacity = $('dimFiltered').checked ? 0.20 : 0.48;
}

function resize() {
  cssWidth = Math.max(1, innerWidth); cssHeight = Math.max(1, innerHeight);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr); renderer.setSize(cssWidth, cssHeight, false);
  camera.aspect = cssWidth / cssHeight; camera.updateProjectionMatrix();
}
const vp = new THREE.Matrix4();
function pickNearest(clientX, clientY) {
  const radius = Number($('pickRadius').value);
  vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const e = vp.elements;
  let best = -1, bestD2 = radius * radius;
  for (const index of candidateIndices) {
    const o = index * 3, x = field.positions[o], y = field.positions[o + 1], z = field.positions[o + 2];
    const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (cw <= 0) continue;
    const nx = (e[0] * x + e[4] * y + e[8] * z + e[12]) / cw;
    const ny = (e[1] * x + e[5] * y + e[9] * z + e[13]) / cw;
    const nz = (e[2] * x + e[6] * y + e[10] * z + e[14]) / cw;
    if (nz < -1 || nz > 1 || Math.abs(nx) > 1.05 || Math.abs(ny) > 1.05) continue;
    const sx = (nx * 0.5 + 0.5) * cssWidth, sy = (-ny * 0.5 + 0.5) * cssHeight;
    const d2 = (sx - clientX) ** 2 + (sy - clientY) ** 2;
    if (d2 < bestD2) { bestD2 = d2; best = index; }
  }
  return best;
}

function setCameraMode(mode) {
  cameraMode = mode;
  document.querySelectorAll('[data-camera-mode]').forEach((b) => b.classList.toggle('active', b.dataset.cameraMode === mode));
  if (mode === 'orbit') { controls.enabled = true; modeHintEl.textContent = 'Orbit'; resetOrbit(); }
  else { controls.enabled = false; modeHintEl.textContent = 'Homepage'; homeTarget = { x: 0, y: 0 }; homeCurrent = { x: 0, y: 0 }; camera.position.set(0, 0, 0); camera.lookAt(0, 0, -12); }
}
function updateHome(dt) {
  homeCurrent.x = THREE.MathUtils.damp(homeCurrent.x, homeTarget.x, 2.7, dt);
  homeCurrent.y = THREE.MathUtils.damp(homeCurrent.y, homeTarget.y, 2.7, dt);
  camera.position.set(homeCurrent.x * 0.34, homeCurrent.y * 0.20, 0);
  camera.lookAt(homeCurrent.x * 1.05, homeCurrent.y * 0.62, -12);
}
function focusRole(roleId) {
  const index = selections.get(roleId);
  if (!Number.isInteger(index)) return showToast('这个角色还没有选星');
  if (cameraMode !== 'orbit') setCameraMode('orbit');
  const p = starPosition(index, new THREE.Vector3());
  controls.target.copy(p); camera.position.copy(p).add(new THREE.Vector3(0, 0, 9)); camera.lookAt(p); controls.update();
}

const projected = new THREE.Vector3();
function updateMarkers() {
  for (const role of ROLE_DEFS) {
    const marker = markerEls.get(role.id), index = selections.get(role.id);
    if (!marker || marker.hidden || !Number.isInteger(index)) continue;
    starPosition(index, projected).project(camera);
    const visible = projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1.15 && Math.abs(projected.y) <= 1.15;
    marker.style.display = visible ? 'flex' : 'none';
    if (visible) { marker.style.left = `${(projected.x * .5 + .5) * cssWidth}px`; marker.style.top = `${(-projected.y * .5 + .5) * cssHeight}px`; }
  }
}
function updateCameraStatus() {
  const t = cameraMode === 'orbit' ? controls.target : new THREE.Vector3(homeCurrent.x * 1.05, homeCurrent.y * 0.62, -12);
  cameraStatusEl.textContent = `camera (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}) target (${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)})`;
}

canvas.addEventListener('pointerdown', (e) => { if (e.button === 0) { dragStart = { x: e.clientX, y: e.clientY }; dragging = false; } });
canvas.addEventListener('pointermove', (e) => {
  if (dragStart && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 4) dragging = true;
  if (cameraMode === 'home') {
    homeTarget.x = shapeAxis(e.clientX / Math.max(innerWidth, 1) * 2 - 1);
    homeTarget.y = shapeAxis(-(e.clientY / Math.max(innerHeight, 1) * 2 - 1));
  }
  if (!dragging && performance.now() - lastHoverAt > 65) {
    lastHoverAt = performance.now();
    const index = pickNearest(e.clientX, e.clientY);
    if (index < 0) hoverTip.style.display = 'none';
    else { const info = starInfo(index); hoverTip.textContent = `#${index} depth ${info.depth.toFixed(1)} brightness ${info.brightness.toFixed(2)}`; hoverTip.style.display = 'block'; hoverTip.style.left = `${e.clientX + 14}px`; hoverTip.style.top = `${e.clientY + 14}px`; }
  }
}, { passive: true });
canvas.addEventListener('pointerup', (e) => {
  if (e.button !== 0 || !dragStart) return;
  const moved = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y); dragStart = null;
  const wasDrag = dragging || moved > 4; dragging = false; if (wasDrag) return;
  const index = pickNearest(e.clientX, e.clientY);
  if (index < 0) return showToast('这里没有满足当前筛选的星');
  assignStar(activeRoleId, index, true);
});
canvas.addEventListener('pointerleave', () => { hoverTip.style.display = 'none'; if (cameraMode === 'home') homeTarget = { x: 0, y: 0 }; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.querySelectorAll('[data-camera-mode]').forEach((b) => b.addEventListener('click', () => setCameraMode(b.dataset.cameraMode)));
$('resetView').addEventListener('click', () => cameraMode === 'orbit' ? resetOrbit() : (homeTarget = homeCurrent = { x: 0, y: 0 }));
$('focusActive').addEventListener('click', () => focusRole(selections.has(activeRoleId) ? activeRoleId : lastSelectedRoleId));
$('loadProduction').addEventListener('click', loadProduction);
$('clearAll').addEventListener('click', clearAll);
$('showLinks').addEventListener('change', updateSelectionUi);
$('showReserved').addEventListener('change', (e) => reservedLayer.classList.toggle('show', e.target.checked));
['minBrightness', 'minDepth', 'maxDepth'].forEach((id) => $(id).addEventListener('input', () => { updateRangeOutputs(); rebuildCandidates(); }));
$('pickRadius').addEventListener('input', updateRangeOutputs);
$('dimFiltered').addEventListener('change', rebuildCandidates);
function updateRangeOutputs() {
  $('minBrightnessOut').textContent = Number($('minBrightness').value).toFixed(2);
  $('minDepthOut').textContent = $('minDepth').value;
  $('maxDepthOut').textContent = $('maxDepth').value;
  $('pickRadiusOut').textContent = `${$('pickRadius').value}px`;
}

async function copyText(text, success) {
  try { await navigator.clipboard.writeText(text); }
  catch { exportBox.focus(); exportBox.select(); document.execCommand('copy'); }
  showToast(success);
}
$('copyResult').addEventListener('click', () => copyText(exportBox.value, '选星结果已复制，直接粘贴给我即可'));
$('copyLink').addEventListener('click', () => { updateHash(true); copyText(location.href, '分享链接已复制'); });
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === '1') setCameraMode('orbit');
  if (e.key === '2') setCameraMode('home');
  if (e.key.toLowerCase() === 'r') $('resetView').click();
  if (e.key.toLowerCase() === 'f') $('focusActive').click();
  if (e.key === 'Delete' || e.key === 'Backspace') removeRole(activeRoleId);
});

restore();
updateRangeOutputs();
rebuildCandidates();
updateSelectionUi();
resize();
window.addEventListener('resize', resize, { passive: true });

let previous = performance.now();
function frame(now) {
  const dt = Math.min(.05, Math.max(.001, (now - previous) / 1000)); previous = now;
  if (cameraMode === 'orbit') controls.update(); else updateHome(dt);
  updateMarkers(); updateCameraStatus(); renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
