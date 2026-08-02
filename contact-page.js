(() => {
  'use strict';

  const contactItems = [
    {
      glyph: 'GH',
      label: 'GitHub',
      value: 'github.com/yuchenm1303-png',
      copyValue: 'https://github.com/yuchenm1303-png',
      href: 'https://github.com/yuchenm1303-png',
      zhNote: '项目源码、提交记录与公开作品',
      enNote: 'Source code, commit history and public work',
      zhAction: '访问',
      enAction: 'Open',
      external: true
    },
    {
      glyph: 'TEL',
      label: 'Phone',
      value: '152 2391 0235',
      copyValue: '15223910235',
      href: 'tel:+8615223910235',
      zhNote: '可直接拨打，也可以复制号码',
      enNote: 'Call directly or copy the number',
      zhAction: '拨打',
      enAction: 'Call'
    },
    {
      glyph: '@',
      label: 'Email',
      value: 'yuchenm1303@gmail.com',
      copyValue: 'yuchenm1303@gmail.com',
      href: 'mailto:yuchenm1303@gmail.com',
      zhNote: '适合项目合作、技术交流与正式联系',
      enNote: 'Best for project, technical and formal enquiries',
      zhAction: '发邮件',
      enAction: 'Email'
    },
    {
      glyph: 'QQ',
      label: 'QQ',
      value: '552078638',
      copyValue: '552078638',
      href: 'tencent://message/?uin=552078638&Site=Chen%27s%20Homepage&Menu=yes',
      zhNote: '支持已安装 QQ 的设备直接唤起会话',
      enNote: 'Opens QQ directly when the app is available',
      zhAction: '打开QQ',
      enAction: 'Open QQ'
    }
  ];

  function renderContactCard(item, lang) {
    const note = lang === 'zh' ? item.zhNote : item.enNote;
    const action = lang === 'zh' ? item.zhAction : item.enAction;
    const copyLabel = lang === 'zh' ? '复制' : 'Copy';
    const copiedLabel = lang === 'zh' ? '已复制' : 'Copied';
    const externalAttributes = item.external ? ' target="_blank" rel="noreferrer"' : '';

    return `
      <article class="contact-channel">
        <div class="contact-channel-topline">
          <span class="contact-channel-glyph" aria-hidden="true">${item.glyph}</span>
          <div class="contact-channel-heading">
            <span class="contact-channel-label">${item.label}</span>
            <strong class="contact-channel-value">${item.value}</strong>
          </div>
        </div>
        <p class="contact-channel-note">${note}</p>
        <div class="contact-channel-actions">
          <a class="contact-retro-action" href="${item.href}"${externalAttributes}>${action}</a>
          <button
            class="contact-retro-action"
            type="button"
            data-contact-copy="${item.copyValue}"
            data-copy-label="${copyLabel}"
            data-copied-label="${copiedLabel}"
          >${copyLabel}</button>
        </div>
      </article>`;
  }

  function renderContactPage(lang) {
    const isZh = lang === 'zh';
    const intro = isZh
      ? '欢迎通过以下方式联系我。项目合作、技术交流或其他事项，优先推荐使用邮箱。'
      : 'You are welcome to contact me through any channel below. Email is preferred for projects and technical enquiries.';
    const status = isZh ? '联系方式已就绪' : 'CONTACT CHANNELS READY';
    const reply = isZh ? '看到消息后会尽快回复' : 'I will reply as soon as possible';

    return `
      <section class="contact-page">
        <div class="contact-page-heading">
          <div>
            <h2 class="section-title">// ${isZh ? '联系方式' : 'CONTACT'}</h2>
            <p class="contact-page-intro">${intro}</p>
          </div>
          <span class="contact-page-badge">OPEN FOR CONTACT</span>
        </div>

        <div class="contact-channel-grid">
          ${contactItems.map((item) => renderContactCard(item, lang)).join('')}
        </div>

        <div class="contact-ready-bar">
          <span class="contact-ready-dot" aria-hidden="true"></span>
          <strong>${status}</strong>
          <span>${reply}</span>
        </div>
      </section>`;
  }

  content.zh.sections.contact = renderContactPage('zh');
  content.en.sections.contact = renderContactPage('en');

  function fallbackCopy(value) {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('copy failed');
  }

  async function copyValue(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    fallbackCopy(value);
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-contact-copy]');
    if (!button) return;

    const idleLabel = button.dataset.copyLabel || button.textContent;
    try {
      await copyValue(button.dataset.contactCopy || '');
      button.textContent = button.dataset.copiedLabel || idleLabel;
      button.classList.add('is-copied');
    } catch (_) {
      button.textContent = idleLabel;
      return;
    }

    clearTimeout(button.__contactCopyTimer);
    button.__contactCopyTimer = setTimeout(() => {
      button.textContent = idleLabel;
      button.classList.remove('is-copied');
    }, 1400);
  });
})();
