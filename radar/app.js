const leads = [
  {id:1,source:"小红书",title:"想找人做一个预约类微信小程序，有偿",excerpt:"工作室需要预约、时间段选择和后台查看订单的小程序，预算可以沟通。",category:"微信小程序",score:96,age:"2 分钟前",budget:"预算待聊",status:"new",signals:["有偿","明确需求","近期项目"]},
  {id:2,source:"小红书",title:"公司准备做一个英文官网，求靠谱开发",excerpt:"主要用于海外客户展示产品，希望手机端适配，后续可能还要接询盘表单。",category:"企业官网",score:93,age:"7 分钟前",budget:"未公开",status:"new",signals:["公司项目","找开发","官网"]},
  {id:3,source:"小红书",title:"有会 Python 数据处理的吗？急",excerpt:"一批 Excel 数据需要清洗、合并和自动生成结果表，最好今天能沟通。",category:"Python / 数据",score:87,age:"14 分钟前",budget:"可沟通",status:"saved",signals:["急","明确交付","可远程"]},
  {id:4,source:"小红书",title:"想学习前端，有没有推荐的课程",excerpt:"零基础准备学 HTML、CSS 和 JavaScript，大家有什么课程推荐吗？",category:"非项目",score:9,age:"21 分钟前",budget:"—",status:"ignored",signals:["学习咨询"]},
  {id:5,source:"小红书",title:"想做一个类似这个页面的独立站",excerpt:"有参考网站，希望先做展示和询盘，后面再考虑支付。想了解大概价格和周期。",category:"独立站",score:91,age:"28 分钟前",budget:"询价中",status:"contacted",signals:["询价","有参考","交付意向"]}
];

const labels = {new:"新发现",saved:"已收藏",contacted:"已联系",ignored:"已忽略"};
let currentFilter = "high";

const $ = (id) => document.getElementById(id);
const leadList = $("leadList");
const resultCount = $("resultCount");
const highCount = $("highCount");
const newCount = $("newCount");
const contactedCount = $("contactedCount");
const searchInput = $("searchInput");
const scanButton = $("scanButton");
const lastScan = $("lastScan");

function updateCounts() {
  highCount.textContent = String(leads.filter((lead) => lead.score >= 80).length);
  newCount.textContent = String(leads.filter((lead) => lead.status === "new").length);
  contactedCount.textContent = String(leads.filter((lead) => lead.status === "contacted").length);
}

function matchesFilter(lead) {
  if (currentFilter === "all") return true;
  if (currentFilter === "high") return lead.score >= 80;
  if (currentFilter === "new") return lead.status === "new";
  if (currentFilter === "contacted") return lead.status === "contacted";
  return true;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = leads.filter((lead) => {
    const haystack = `${lead.title} ${lead.excerpt} ${lead.category}`.toLowerCase();
    return (!query || haystack.includes(query)) && matchesFilter(lead);
  });

  resultCount.textContent = `${visible.length} 条`;
  leadList.innerHTML = visible.length ? visible.map((lead) => `
    <article class="lead-card">
      <div class="lead-score"><strong>${lead.score}</strong><span>AI SCORE</span></div>
      <div class="lead-main">
        <div class="lead-meta">
          <span class="source-pill">${lead.source}</span><span>${lead.age}</span><span>${lead.category}</span><span class="status-pill">${labels[lead.status]}</span>
        </div>
        <h3>${lead.title}</h3>
        <p>${lead.excerpt}</p>
        <div class="signal-row">${lead.signals.map((signal) => `<span>${signal}</span>`).join("")}<span>${lead.budget}</span></div>
      </div>
      <div class="lead-actions">
        <button class="primary" type="button" data-id="${lead.id}" data-status="contacted">标记已联系</button>
        <button type="button" data-id="${lead.id}" data-status="saved">收藏</button>
        <button type="button" data-id="${lead.id}" data-status="ignored">忽略</button>
      </div>
    </article>`).join("") : '<div class="empty-state">没有符合当前筛选条件的项目。</div>';

  leadList.querySelectorAll("button[data-status]").forEach((button) => {
    button.addEventListener("click", () => {
      const lead = leads.find((item) => item.id === Number(button.dataset.id));
      if (!lead) return;
      lead.status = button.dataset.status;
      render();
    });
  });
  updateCounts();
}

document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter || "all";
    render();
  });
});

searchInput.addEventListener("input", render);
scanButton.addEventListener("click", () => {
  scanButton.disabled = true;
  scanButton.textContent = "扫描中…";
  lastScan.textContent = "正在扫描";
  window.setTimeout(() => {
    lastScan.textContent = "刚刚 · 演示扫描";
    scanButton.textContent = "立即扫描";
    scanButton.disabled = false;
  }, 900);
});

render();
