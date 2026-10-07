const API_BASE = "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/lead-radar-api";
const listEl = document.getElementById('candidateList');
const countEl = document.getElementById('candidateCount');
const submitButton = document.getElementById('submitButton');
const toggleAll = document.getElementById('toggleAll');
const resultMessage = document.getElementById('resultMessage');
const serviceStatus = document.getElementById('serviceStatus');
const toast = document.getElementById('toast');
let candidates = [];

function showToast(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200); }
function safeUrl(value) { try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function decodePayload(hash) {
  const token = String(hash || '').replace(/^#/, '');
  if (!token) return null;
  const padded = token.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - token.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
function localDateTime(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function field(labelText, tag, value, maxLength, type) {
  const label = document.createElement('label'); const span = document.createElement('span'); span.textContent = labelText;
  const control = document.createElement(tag); if (type) control.type = type; control.value = value || ''; if (maxLength) control.maxLength = maxLength;
  label.append(span, control); return { label, control };
}
function itemCard(item, index) {
  const article = document.createElement('article'); article.className = 'cards radar-import-item';
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = true; checkbox.className = 'radar-import-check'; checkbox.dataset.index = String(index);
  const fields = document.createElement('div'); fields.className = 'radar-import-fields';
  const titleLabel = field('标题', 'input', item.title || '', 240); titleLabel.control.dataset.field = 'title';
  const excerptLabel = field('摘要', 'textarea', item.excerpt || '', 1600); excerptLabel.control.dataset.field = 'excerpt';
  const grid = document.createElement('div'); grid.className = 'radar-import-grid';
  const sourceLabel = field('来源', 'input', item.source || '小红书', 40); sourceLabel.control.dataset.field = 'source';
  const timeLabel = field('发布时间', 'input', localDateTime(item.published_at), null, 'datetime-local'); timeLabel.control.dataset.field = 'published_at';
  const budgetLabel = field('预算', 'input', item.budget || '', 100); budgetLabel.control.dataset.field = 'budget';
  grid.append(sourceLabel.label, timeLabel.label, budgetLabel.label);
  const url = document.createElement('div'); url.className = 'radar-import-url'; url.textContent = safeUrl(item.url) || '没有识别到原帖链接';
  fields.append(titleLabel.label, excerptLabel.label, grid, url);
  article.append(checkbox, fields);
  return article;
}
function render() {
  countEl.textContent = String(candidates.length); listEl.replaceChildren();
  if (!candidates.length) { const empty = document.createElement('div'); empty.className = 'radar-import-empty'; empty.textContent = '没有收到 Browser Helper 候选。请返回小红书页面重新捕获。'; listEl.append(empty); submitButton.disabled = true; return; }
  candidates.forEach((item, index) => listEl.append(itemCard(item, index)));
}
function collectSelected() {
  return [...listEl.querySelectorAll('.radar-import-item')].flatMap((card, index) => {
    const checked = card.querySelector('.radar-import-check')?.checked;
    if (!checked) return [];
    const get = (name) => card.querySelector(`[data-field="${name}"]`)?.value.trim() || '';
    const title = get('title'); if (!title) return [];
    const publishedRaw = get('published_at');
    const published = publishedRaw ? new Date(publishedRaw) : new Date();
    const original = candidates[index] || {};
    return [{
      source: get('source') || original.source || '小红书', external_id: original.external_id || null,
      title, excerpt: get('excerpt'), url: safeUrl(original.url) || null,
      published_at: Number.isFinite(published.getTime()) ? published.toISOString() : new Date().toISOString(),
      budget: get('budget') || null
    }];
  });
}
async function submit() {
  const items = collectSelected(); if (!items.length) return showToast('至少选择一条并保留标题');
  submitButton.disabled = true; serviceStatus.textContent = '正在分析'; resultMessage.textContent = `正在处理 ${items.length} 条候选…`;
  try {
    const response = await fetch(`${API_BASE}/api/v1/ingest/manual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || `API ${response.status}`);
    const parts = [`入库 ${data.stored || 0}`]; if (data.duplicates) parts.push(`重复 ${data.duplicates}`); if (data.filtered) parts.push(`过滤 ${data.filtered}`); if (data.notified) parts.push(`提醒 ${data.notified}`);
    resultMessage.textContent = `完成：${parts.join(' · ')}`; serviceStatus.textContent = '已完成'; showToast(resultMessage.textContent);
  } catch (error) {
    resultMessage.textContent = `提交失败：${error.message || '网络错误'}`; serviceStatus.textContent = 'API 异常'; showToast(resultMessage.textContent);
  } finally { submitButton.disabled = false; }
}

try {
  const payload = decodePayload(location.hash); history.replaceState(null, '', location.pathname);
  candidates = Array.isArray(payload?.items) ? payload.items.slice(0, 30).map((item) => ({ ...item, url: safeUrl(item.url) })) : [];
} catch { candidates = []; }
render();
submitButton.addEventListener('click', submit);
toggleAll.addEventListener('click', () => { const checks = [...listEl.querySelectorAll('.radar-import-check')]; const shouldCheck = checks.some((box) => !box.checked); checks.forEach((box) => { box.checked = shouldCheck; }); });
