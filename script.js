const content = {
  zh: {
    shortcutProjects: "我的项目",
    shortcutContact: "联系我",
    navAbout: "关于",
    navProjects: "项目",
    navBlog: "博客",
    navContact: "联系",
    online: "在线",
    updated: "最后更新：2026.08",
    made: "恭喜你找到我",
    closedMessage: "个人主页窗口已关闭。",
    reopen: "重新打开",
    sections: {
      about: `
        <section>
          <div class="profile-grid">
            <div class="avatar-frame">
              <img src="assets/avatar.svg" alt="Jack 的像素头像" />
            </div>
            <div>
              <h1 class="profile-name">Jack</h1>
              <p class="profile-meta">He/Him · 22 岁</p>
              <ul class="role-list copy">
                <li>电气工程及其自动化 · 大三</li>
                <li>独立开发者 / 科研实践者</li>
              </ul>
            </div>
          </div>
          <hr class="divider" />
          <div class="copy">
            <p>欢迎来到我的空间。</p>
            <p>我来自成都，正在学习电气工程及其自动化。</p>
            <p>这里会保存我的经历。</p>
            <p>晚安。</p>
          </div>
          <div class="terminal-box">C:\\CHEN&gt; SYSTEM READY · POWER &amp; CODE<span class="cursor-block"></span></div>
        </section>
      `,
      projects: `
        <section>
          <h2 class="section-title">// 代表项目</h2>
          <ul class="project-list">
            ${projectTemplate("AI", "AI Agent / Android App", "进行中", "手机端视觉智能体、无障碍交互与界面自动化。", "Kotlin · LLM · Vision · Agent")}
            ${projectTemplate("GaN", "GaN HEMT Simulation", "科研", "基于 Sentaurus 的增强型 GaN HEMT 器件建模、重离子与温度效应分析。", "TCAD · Semiconductor · Physics")}
            ${projectTemplate("MAT", "Cradle–Pendulum Dynamics", "建模", "摇篮—摆架—工作台耦合系统的有限元装配、模态分析与非线性动力学。", "MATLAB · FEM · Newmark")}
            ${projectTemplate("POC", "Global Ocean e-ratio Research", "论文中", "全球海洋 POC 输出效率数据库、Longhurst 省区和机制链分类研究。", "Python · Remote Sensing · Statistics")}
          </ul>
        </section>
      `,
      blog: `
        <section>
          <h2 class="section-title">Index of /blog</h2>
          ${blogTable([
            ["从零搭建个人主页", "2026-08-01", "12 KB"],
            ["工程仿真中的数值稳定性", "2026-07-25", "24 KB"],
            ["AI Agent 视觉交互设计", "2026-07-12", "18 KB"],
            ["GaN HEMT 温度与重离子扫描记录", "2026-07-10", "31 KB"]
          ])}
          <p class="note">4 个文件 · 0 个目录</p>
        </section>
      `,
      contact: `
        <section>
          <h2 class="section-title">// 联系方式</h2>
          <ul class="contact-list">
            ${contactTemplate("GH", "GitHub", "github.com/yuchenm1303-png", "https://github.com/yuchenm1303-png")}
            ${contactTemplate("@", "Email", "your-email@example.com", "mailto:your-email@example.com")}
            ${contactTemplate("CV", "Resume", "resume.pdf", "#")}
          </ul>
          <p class="note">邮箱和简历链接目前是占位内容，之后直接在 <strong>script.js</strong> 中替换即可。</p>
        </section>
      `
    }
  },
  en: {
    shortcutProjects: "My Projects",
    shortcutContact: "Contact",
    navAbout: "About",
    navProjects: "Projects",
    navBlog: "Blog",
    navContact: "Contact",
    online: "ONLINE",
    updated: "Last updated: 2026.08",
    made: "Made with curiosity",
    closedMessage: "The homepage window is closed.",
    reopen: "Reopen",
    sections: {
      about: `
        <section>
          <div class="profile-grid">
            <div class="avatar-frame">
              <img src="assets/avatar.svg" alt="Pixel portrait of Jack" />
            </div>
            <div>
              <h1 class="profile-name">Jack</h1>
              <p class="profile-meta">He/Him · 22</p>
              <ul class="role-list copy">
                <li>Electrical Engineering Student</li>
                <li>Independent Developer / Research Practitioner</li>
              </ul>
            </div>
          </div>
          <hr class="divider" />
          <div class="copy">
            <p>Welcome to my personal homepage.</p>
            <p>I study Electrical Engineering &amp; Automation and keep building AI applications, engineering simulations and research data workflows.</p>
            <p>This site is a long-term digital room for real projects, study notes and ideas — not merely an online résumé.</p>
          </div>
          <div class="terminal-box">C:\\CHEN&gt; SYSTEM READY · POWER &amp; CODE<span class="cursor-block"></span></div>
        </section>
      `,
      projects: `
        <section>
          <h2 class="section-title">// FEATURED PROJECTS</h2>
          <ul class="project-list">
            ${projectTemplate("AI", "AI Agent / Android App", "ACTIVE", "A phone-side visual agent for accessibility-driven UI interaction and automation.", "Kotlin · LLM · Vision · Agent")}
            ${projectTemplate("GaN", "GaN HEMT Simulation", "RESEARCH", "Sentaurus modelling of enhancement-mode GaN HEMTs under heavy-ion and temperature effects.", "TCAD · Semiconductor · Physics")}
            ${projectTemplate("MAT", "Cradle–Pendulum Dynamics", "MODELLING", "Finite-element assembly, modal analysis and nonlinear dynamics of a coupled cradle system.", "MATLAB · FEM · Newmark")}
            ${projectTemplate("POC", "Global Ocean e-ratio Research", "PAPER", "A global POC export-efficiency database with Longhurst provinces and mechanism-chain classification.", "Python · Remote Sensing · Statistics")}
          </ul>
        </section>
      `,
      blog: `
        <section>
          <h2 class="section-title">Index of /blog</h2>
          ${blogTable([
            ["Building a Homepage From Zero", "2026-08-01", "12 KB"],
            ["Numerical Stability in Engineering Simulation", "2026-07-25", "24 KB"],
            ["Visual Interaction Design for AI Agents", "2026-07-12", "18 KB"],
            ["GaN HEMT Temperature and Heavy-Ion Sweep", "2026-07-10", "31 KB"]
          ])}
          <p class="note">4 files · 0 directories</p>
        </section>
      `,
      contact: `
        <section>
          <h2 class="section-title">// CONTACT</h2>
          <ul class="contact-list">
            ${contactTemplate("GH", "GitHub", "github.com/yuchenm1303-png", "https://github.com/yuchenm1303-png")}
            ${contactTemplate("@", "Email", "your-email@example.com", "mailto:your-email@example.com")}
            ${contactTemplate("CV", "Resume", "resume.pdf", "#")}
          </ul>
          <p class="note">Email and résumé are placeholders. Replace them directly in <strong>script.js</strong>.</p>
        </section>
      `
    }
  }
};

function projectTemplate(glyph, title, status, description, tags) {
  return `
    <li class="project-item">
      <span class="project-glyph">${glyph}</span>
      <div>
        <h3 class="project-title">${title}<span class="project-status">[${status}]</span></h3>
        <p class="project-desc">${description}</p>
        <p class="project-tags">${tags}</p>
        <a class="pixel-link" href="#" onclick="return false;">View Project →</a>
      </div>
    </li>
  `;
}

function blogTable(rows) {
  return `
    <table class="file-table">
      <thead><tr><th>Name</th><th>Date</th><th>Size</th></tr></thead>
      <tbody>
        ${rows.map(([name, date, size]) => `
          <tr>
            <td><span class="file-icon">▤</span><a class="pixel-link" href="#" onclick="return false;">${name}</a></td>
            <td>${date}</td>
            <td>${size}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function contactTemplate(glyph, label, value, href) {
  return `
    <li class="contact-item">
      <span class="contact-glyph">${glyph}</span>
      <div>
        <div class="contact-label">${label}</div>
        <a class="pixel-link" href="${href}" ${href.startsWith("http") ? 'target="_blank" rel="noreferrer"' : ""}>${value}</a>
      </div>
    </li>
  `;
}

const state = {
  lang: "zh",
  section: "about",
  maximized: false,
  minimized: false
};

const windowElement = document.getElementById("profileWindow");
const windowBody = document.getElementById("windowBody");
const contentElement = document.getElementById("content");
const closedDialog = document.getElementById("closedDialog");
const langSwitch = document.getElementById("langSwitch");
const menuItems = [...document.querySelectorAll(".menu-item")];

function render() {
  const dictionary = content[state.lang];
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  langSwitch.textContent = state.lang === "zh" ? "EN" : "CN";

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (dictionary[key]) element.textContent = dictionary[key];
  });

  contentElement.classList.remove("screen-refresh");
  void contentElement.offsetWidth;
  contentElement.innerHTML = dictionary.sections[state.section];
  contentElement.scrollTop = 0;
  contentElement.classList.add("screen-refresh");

  menuItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === state.section);
  });
}

menuItems.forEach((button) => {
  button.addEventListener("click", () => {
    state.section = button.dataset.section;
    render();
  });
});

document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("dblclick", () => {
    state.section = button.dataset.open;
    windowElement.hidden = false;
    closedDialog.hidden = true;
    state.minimized = false;
    windowElement.classList.remove("minimized");
    render();
  });

  button.addEventListener("click", () => {
    state.section = button.dataset.open;
    render();
  });
});

langSwitch.addEventListener("click", () => {
  state.lang = state.lang === "zh" ? "en" : "zh";
  render();
});

document.getElementById("minimizeButton").addEventListener("click", () => {
  state.minimized = !state.minimized;
  windowElement.classList.toggle("minimized", state.minimized);
});

document.getElementById("maximizeButton").addEventListener("click", () => {
  state.maximized = !state.maximized;
  windowElement.classList.toggle("maximized", state.maximized);
});

document.getElementById("closeButton").addEventListener("click", () => {
  windowElement.hidden = true;
  closedDialog.hidden = false;
});

document.getElementById("reopenButton").addEventListener("click", () => {
  closedDialog.hidden = true;
  windowElement.hidden = false;
  render();
});

function createStars() {
  const stars = document.getElementById("stars");
  for (let i = 0; i < 34; i += 1) {
    const star = document.createElement("span");
    star.className = `star${i % 6 === 0 ? " large" : ""}`;
    star.style.left = `${(i * 37 + 11) % 100}%`;
    star.style.top = `${(i * 61 + 7) % 94}%`;
    star.style.setProperty("--delay", `${(i % 9) * 0.55}s`);
    star.style.setProperty("--duration", `${3.2 + (i % 5) * 0.8}s`);
    stars.appendChild(star);
  }
}

function updateClock() {
  document.getElementById("clock").textContent = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

createStars();
render();
updateClock();
setInterval(updateClock, 15000);
