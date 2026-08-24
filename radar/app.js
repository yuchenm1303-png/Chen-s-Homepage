const leads = [
  {
    id: 1,
    source: "小红书",
    title: "想找人做一个预约类微信小程序，有偿",
    excerpt: "工作室需要预约、时间段选择和后台查看订单的小程序，预算可以沟通。",
    category: "微信小程序",
    score: 96,
    intent: 99,
    clarity: 94,
    fit: 95,
    age: "2 分钟前",
    budget: "预算待聊",
    status: "new",
    signals: ["有偿", "明确需求", "近期项目"],
    reason: "明确出现“有偿”，核心功能、使用场景和后台需求都已经给出，属于可以直接进入需求确认的项目。",
    nextStep: "优先确认预约规则、后台权限、是否需要支付，以及首版期望上线时间，再给出 MVP 报价。"
  },
  {
    id: 2,
    source: "小红书",
    title: "公司准备做一个英文官网，求靠谱开发",
    excerpt: "主要用于海外客户展示产品，希望手机端适配，后续可能还要接询盘表单。",
    category: "企业官网",
    score: 93,
    intent: 94,
    clarity: 88,
    fit: 96,
    age: "7 分钟前",
    budget: "未公开",
    status: "new",
    signals: ["公司项目", "找开发", "官网"],
    reason: "企业主体、英文官网、移动端适配和询盘表单都指向明确交付需求，与你的网页开发能力高度匹配。",
    nextStep: "先问产品数量、是否已有品牌素材与英文文案，再把展示站和询盘能力拆成两个报价层级。"
  },
  {
    id: 3,
    source: "小红书",
    title: "有会 Python 数据处理的吗？急",
    excerpt: "一批 Excel 数据需要清洗、合并和自动生成结果表，最好今天能沟通。",
    category: "Python / 数据",
    score: 87,
    intent: 92,
    clarity: 95,
    fit: 75,
    age: "14 分钟前",
    budget: "可沟通",
    status: "saved",
    signals: ["急", "明确交付", "可远程"],
    reason: "任务范围清晰且有明显时效压力，成交意图较强；主要不确定点是数据规模和异常规则。",
    nextStep: "先让对方提供脱敏样表和目标结果表，确认规则后按一次性交付或可复用脚本两档报价。"
  },
  {
    id: 4,
    source: "小红书",
    title: "想学习前端，有没有推荐的课程",
    excerpt: "零基础准备学 HTML、CSS 和 JavaScript，大家有什么课程推荐吗？",
    category: "非项目",
    score: 9,
    intent: 6,
    clarity: 18,
    fit: 4,
    age: "21 分钟前",
    budget: "—",
    status: "ignored",
    signals: ["学习咨询"],
    reason: "内容是学习咨询，没有付费开发、交付对象、预算或项目时限，不属于可跟进潜客。",
    nextStep: "无需跟进，继续作为低意向样本保留用于过滤规则演示。"
  },
  {
    id: 5,
    source: "小红书",
    title: "想做一个类似这个页面的独立站",
    excerpt: "有参考网站，希望先做展示和询盘，后面再考虑支付。想了解大概价格和周期。",
    category: "独立站",
    score: 91,
    intent: 90,
    clarity: 86,
    fit: 96,
    age: "28 分钟前",
    budget: "询价中",
    status: "contacted",
    signals: ["询价", "有参考", "交付意向"],
    reason: "已经有参考站，并主动询问价格和周期，说明需求已进入供应商比较阶段，能力匹配度很高。",
    nextStep: "先拿参考站拆页面数量与功能，再给展示询盘版和后续电商扩展版两阶段方案。"
  }
];

const labels = {
  new: "新发现",
  saved: "已收藏",
  contacted: "已联系",
  ignored: "已忽略"
};

let currentFilter = "high";
let activeLeadId = null;

const $ = (id) => document.getElementById(id);
const leadList = $("leadList");
const resultCount = $("resultCount");
const highCount = $("highCount");
const heroHighCount = $("heroHighCount");
const newCount = $("newCount");
const savedCount = $("savedCount");
const contactedCount = $("contactedCount");
const searchInput = $("searchInput");
const scanButton = $("scanButton");
const scanButtonText = $("scanButtonText");
const scanStatus = $("scanStatus");
const scanPulse = $("scanPulse");
const lastScan = $("lastScan");
const toast = $("toast");
const leadModal = $("leadModal");
const leadModalClose = $("leadModalClose");
const leadModalTitle = $("leadModalTitle");
const leadModalKicker = $("leadModalKicker");
const leadModalBody = $("leadModalBody");

function restoreStatuses() {
  try {
    const saved = JSON.parse(localStorage.getItem("leadRadarDemoStatuses") || "{}");
    leads.forEach((lead) => {
      if (saved[lead.id] && labels[saved[lead.id]]) lead.status = saved[lead.id];
    });
  } catch {}
}

function persistStatuses() {
  const payload = Object.fromEntries(leads.map((lead) => [lead.id, lead.status]));
  localStorage.setItem("leadRadarDemoStatuses", JSON.stringify(payload));
}

function restoreLastScan() {
  const timestamp = Number(localStorage.getItem("leadRadarDemoLastScan") || 0);
  if (!timestamp || !lastScan) return;

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) lastScan.textContent = "刚刚 · 演示扫描";
  else if (diffMinutes < 60) lastScan.textContent = `${diffMinutes} 分钟前 · 演示扫描`;
  else lastScan.textContent = "今天 · 演示扫描";
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function priorityLabel(lead) {
  if (lead.score >= 92) return "优先联系";
  if (lead.score >= 80) return "值得跟进";
  return "低优先";
}

function updateCounts() {
  const high = leads.filter((lead) => lead.score >= 80 && lead.status !== "ignored").length;
  highCount.textContent = String(high);
  heroHighCount.textContent = String(high);
  newCount.textContent = String(leads.filter((lead) => lead.status === "new").length);
  savedCount.textContent = String(leads.filter((lead) => lead.status === "saved").length);
  contactedCount.textContent = String(leads.filter((lead) => lead.status === "contacted").length);
}

function matchesFilter(lead) {
  if (currentFilter === "all") return true;
  if (currentFilter === "high") return lead.score >= 80 && lead.status !== "ignored";
  if (currentFilter === "new") return lead.status === "new";
  if (currentFilter === "saved") return lead.status === "saved";
  if (currentFilter === "contacted") return lead.status === "contacted";
  if (currentFilter === "ignored") return lead.status === "ignored";
  return true;
}

function actionClass(lead, status, primary = false) {
  const classes = ["login-button", "cards", "radar-action"];
  if (primary) classes.push("is-primary");
  if (lead.status === status) classes.push("is-current");
  return classes.join(" ");
}

function setLeadStatus(lead, status) {
  if (!lead || !labels[status]) return;
  lead.status = status;
  persistStatuses();
  render();
  showToast(`已标记：${labels[lead.status]}`);

  if (activeLeadId === lead.id && leadModal && !leadModal.hidden) {
    renderLeadModal(lead);
  }
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = leads
    .filter((lead) => {
      const haystack = `${lead.title} ${lead.excerpt} ${lead.category} ${lead.source} ${lead.budget} ${lead.signals.join(" ")}`.toLowerCase();
      return (!query || haystack.includes(query)) && matchesFilter(lead);
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);

  resultCount.textContent = String(visible.length);

  leadList.innerHTML = visible.length ? visible.map((lead) => `
    <article class="lead-card cards fade">
      <div class="lead-rank">
        <span class="lead-score-label">AI SCORE</span>
        <div class="lead-score-value"><strong>${lead.score}</strong><small>/100</small></div>
        <div class="score-track" aria-hidden="true"><i style="width:${lead.score}%"></i></div>
      </div>

      <div class="lead-main">
        <div class="lead-topline">
          <span class="release-badge">${lead.source}</span>
          <span>${lead.age}</span>
          <span class="release-badge">${labels[lead.status]}</span>
          <button class="release-badge filter-chip" type="button" data-view-id="${lead.id}" aria-label="查看 ${lead.title} 的 AI 分析">查看分析 ↗</button>
        </div>
        <h3>${lead.title}</h3>
        <p>${lead.excerpt}</p>
        <div class="lead-context">
          <span>${lead.category}</span>
          <span>${lead.budget}</span>
          <span>${priorityLabel(lead)}</span>
        </div>
        <div class="signal-row">
          ${lead.signals.map((signal) => `<span class="release-badge">${signal}</span>`).join("")}
        </div>
      </div>

      <div class="lead-actions">
        <button class="${actionClass(lead, "contacted", true)}" type="button" data-id="${lead.id}" data-status="contacted" aria-pressed="${lead.status === "contacted"}">已联系</button>
        <button class="${actionClass(lead, "saved")}" type="button" data-id="${lead.id}" data-status="saved" aria-pressed="${lead.status === "saved"}">收藏</button>
        <button class="${actionClass(lead, "ignored")}" type="button" data-id="${lead.id}" data-status="ignored" aria-pressed="${lead.status === "ignored"}">忽略</button>
      </div>
    </article>`).join("") : '<div class="empty-state">没有符合当前筛选条件的项目。换个关键词或筛选条件试试。</div>';

  leadList.querySelectorAll("button[data-status]").forEach((button) => {
    button.addEventListener("click", () => {
      const lead = leads.find((item) => item.id === Number(button.dataset.id));
      setLeadStatus(lead, button.dataset.status);
    });
  });

  leadList.querySelectorAll("button[data-view-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const lead = leads.find((item) => item.id === Number(button.dataset.viewId));
      if (lead) openLeadModal(lead);
    });
  });

  updateCounts();
}

function renderLeadModal(lead) {
  if (!leadModalBody || !leadModalTitle || !leadModalKicker) return;

  leadModalKicker.textContent = `${lead.source} · ${lead.age} · ${lead.category}`;
  leadModalTitle.textContent = lead.title;
  leadModalBody.innerHTML = `
    <div class="release-head">
      <span class="release-badge">AI SCORE · ${lead.score} / 100</span>
      <span class="release-badge">${priorityLabel(lead)}</span>
    </div>

    <p>${lead.excerpt}</p>

    <div class="release-meta">
      <div class="meta-item"><span>付费意向</span><strong>${lead.intent} / 100</strong></div>
      <div class="meta-item"><span>需求清晰度</span><strong>${lead.clarity} / 100</strong></div>
      <div class="meta-item"><span>能力匹配</span><strong>${lead.fit} / 100</strong></div>
    </div>

    <div class="spec-row"><span>预算信号</span><strong>${lead.budget}</strong></div>
    <div class="spec-row"><span>当前状态</span><strong>${labels[lead.status]}</strong></div>
    <div class="spec-row"><span>AI 判断</span><strong>${lead.reason}</strong></div>
    <div class="spec-row"><span>建议动作</span><strong>${lead.nextStep}</strong></div>

    <div class="signal-row">
      ${lead.signals.map((signal) => `<span class="release-badge">${signal}</span>`).join("")}
    </div>

    <div class="lead-actions">
      <button class="${actionClass(lead, "contacted", true)}" type="button" data-modal-status="contacted">标记已联系</button>
      <button class="${actionClass(lead, "saved")}" type="button" data-modal-status="saved">收藏机会</button>
      <button class="${actionClass(lead, "ignored")}" type="button" data-modal-status="ignored">忽略机会</button>
    </div>
  `;

  leadModalBody.querySelectorAll("button[data-modal-status]").forEach((button) => {
    button.addEventListener("click", () => setLeadStatus(lead, button.dataset.modalStatus));
  });
}

function openLeadModal(lead) {
  if (!leadModal) return;
  activeLeadId = lead.id;
  renderLeadModal(lead);
  leadModal.hidden = false;
  document.body.style.overflow = "hidden";
  window.setTimeout(() => leadModalClose?.focus(), 0);
}

function closeLeadModal() {
  if (!leadModal || leadModal.hidden) return;
  leadModal.hidden = true;
  activeLeadId = null;
  document.body.style.overflow = "";
}

document.querySelectorAll(".radar-filters .filter-chip[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".radar-filters .filter-chip[data-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter || "all";
    render();
  });
});

searchInput.addEventListener("input", render);

leadModalClose?.addEventListener("click", closeLeadModal);
leadModal?.querySelector("[data-close-lead-modal]")?.addEventListener("click", closeLeadModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLeadModal();
});

scanButton.addEventListener("click", () => {
  if (scanButton.disabled) return;

  scanButton.disabled = true;
  scanButtonText.textContent = "扫描中…";
  scanPulse.classList.add("is-scanning");

  scanStatus.textContent = "正在发现公开信号";
  lastScan.textContent = "Step 1 / 3 · 发现";

  window.setTimeout(() => {
    scanStatus.textContent = "正在计算 AI Score";
    lastScan.textContent = "Step 2 / 3 · 评分";
  }, 320);

  window.setTimeout(() => {
    scanStatus.textContent = "正在排序高意向机会";
    lastScan.textContent = "Step 3 / 3 · 排序";
  }, 680);

  window.setTimeout(() => {
    const finishedAt = Date.now();
    localStorage.setItem("leadRadarDemoLastScan", String(finishedAt));
    lastScan.textContent = "刚刚 · 演示扫描";
    scanStatus.textContent = "持续监控中";
    scanButtonText.textContent = "立即扫描";
    scanButton.disabled = false;
    scanPulse.classList.remove("is-scanning");
    showToast("扫描完成 · 4 个高意向机会已进入排序");
  }, 1050);
});

restoreStatuses();
restoreLastScan();
render();
