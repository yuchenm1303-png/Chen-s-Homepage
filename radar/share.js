const API_BASE = "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/lead-radar-api";
const $ = (id) => document.getElementById(id);
const shareText = $("shareText"), parseButton = $("parseButton"), form = $("shareForm"), shareStatus = $("shareStatus"), shareResult = $("shareResult"), submitButton = $("shareSubmit"), toast = $("toast");

function showToast(message) { toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200); }
function clean(value, limit = 1600) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit); }
function safeUrl(value) { try { const u = new URL(value); if (!["http:", "https:"].includes(u.protocol)) return ""; if (u.hostname.includes("xiaohongshu.com")) return `${u.origin}${u.pathname}`; u.hash = ""; return u.href; } catch { return ""; } }
function localNow() { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }
function parseShare(raw) {
  const text = String(raw || "").trim(); if (!text) return null;
  const urls = text.match(/https?:\/\/[^\s]+/g) || [];
  const url = safeUrl(urls.find((x) => x.includes("xiaohongshu.com")) || urls[0] || "");
  const withoutUrl = clean(text.replace(/https?:\/\/[^\s]+/g, " ").replace(/复制后打开【?小红书】?.*$/i, " ").replace(/打开小红书.*$/i, " "), 1800);
  const parts = withoutUrl.split(/[\n。！？]/).map((x) => clean(x, 260)).filter((x) => x.length >= 2);
  let title = parts.find((x) => !/^[0-9]+\s*[A-Za-z]?\s*$/.test(x)) || withoutUrl;
  title = title.replace(/^\d+\s*[、.【\[]?/, "").replace(/[【\[].*?小红书.*?[】\]]/g, "").trim().slice(0, 240);
  const excerpt = clean(parts.filter((x) => x !== title).join("。") || withoutUrl, 1600);
  return { source: "小红书", title: title || "小红书公开需求", excerpt, url };
}
function applyParsed(item) {
  $("shareSource").value = item.source;
  $("shareTitle").value = item.title;
  $("shareExcerpt").value = item.excerpt;
  $("shareUrl").value = item.url;
  $("sharePublishedAt").value = localNow();
  form.hidden = false;
  shareStatus.textContent = "已解析 · 待复核";
  shareResult.textContent = item.url ? "已识别公开链接。请确认标题、摘要和实际发布时间后再提交。" : "没有识别到公开链接；仍可作为手动公开内容复核后提交。";
}

parseButton.addEventListener("click", async () => {
  let raw = shareText.value;
  if (!raw && navigator.clipboard?.readText) {
    try { raw = await navigator.clipboard.readText(); shareText.value = raw; } catch {}
  }
  const item = parseShare(raw);
  if (!item) return showToast("请先粘贴小红书分享文本或公开链接");
  applyParsed(item);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = clean($("shareTitle").value, 240); if (!title) return showToast("需求标题不能为空");
  const publishedRaw = $("sharePublishedAt").value; const published = publishedRaw ? new Date(publishedRaw) : new Date();
  const item = {
    source: clean($("shareSource").value, 40) || "小红书",
    title,
    excerpt: clean($("shareExcerpt").value, 1600),
    url: safeUrl($("shareUrl").value) || null,
    published_at: Number.isFinite(published.getTime()) ? published.toISOString() : new Date().toISOString(),
    budget: clean($("shareBudget").value, 100) || null
  };
  submitButton.disabled = true; shareStatus.textContent = "正在分析"; shareResult.textContent = "正在执行过滤、评分和去重…";
  try {
    const response = await fetch(`${API_BASE}/api/v1/ingest/manual`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [item] }) });
    const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || `API ${response.status}`);
    if (data.stored) shareResult.textContent = `完成：已入库 ${data.stored} 条。`;
    else if (data.duplicates) shareResult.textContent = "这条需求数据库里已经存在，没有重复入库。";
    else shareResult.textContent = "未入库：更像学习/讨论内容，或当前购买意向信号不足。";
    shareStatus.textContent = "处理完成"; showToast(shareResult.textContent);
  } catch (error) {
    shareStatus.textContent = "API 异常"; shareResult.textContent = `提交失败：${error.message || "网络错误"}`; showToast(shareResult.textContent);
  } finally { submitButton.disabled = false; }
});
