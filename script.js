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
    made: "由好奇心驱动",
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
                <li>工程仿真 / 科研分析 / 界面设计</li>
              </ul>
            </div>
          </div>
          <hr class="divider" />
          <div class="copy">
            <p>欢迎来到我的个人主页。</p>
            <p>这里集中记录工程仿真、科研分析、图形界面和网站开发项目。</p>
          </div>
          <div class="terminal-box">C:\\CHEN&gt; ENGINEERING · RESEARCH · DESIGN<span class="cursor-block"></span></div>
        </section>
      `,
      projects: `<section><h2 class="section-title">// 代表项目</h2><p class="note">项目内容加载中。</p></section>`,
      blog: `<section><h2 class="section-title">Index of /blog</h2><p class="note">文章目录加载中。</p></section>`,
      contact: `<section><h2 class="section-title">Index of /contact</h2><p class="note">联系方式加载中。</p></section>`
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
                <li>Engineering Simulation / Research / Interface Design</li>
              </ul>
            </div>
          </div>
          <hr class="divider" />
          <div class="copy">
            <p>Welcome to my personal homepage.</p>
            <p>This space records my work in engineering simulation, research analysis, interface design and web development.</p>
          </div>
          <div class="terminal-box">C:\\CHEN&gt; ENGINEERING · RESEARCH · DESIGN<span class="cursor-block"></span></div>
        </section>
      `,
      projects: `<section><h2 class="section-title">// FEATURED PROJECTS</h2><p class="note">Loading projects.</p></section>`,
      blog: `<section><h2 class="section-title">Index of /blog</h2><p class="note">Loading articles.</p></section>`,
      contact: `<section><h2 class="section-title">Index of /contact</h2><p class="note">Loading contact details.</p></section>`
    }
  }
};

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
  const openSection = () => {
    state.section = button.dataset.open;
    windowElement.hidden = false;
    closedDialog.hidden = true;
    state.minimized = false;
    windowElement.classList.remove("minimized");
    render();
  };

  button.addEventListener("click", openSection);
  button.addEventListener("dblclick", openSection);
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
  if (!stars || stars.childElementCount) return;

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
