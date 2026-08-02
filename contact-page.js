(() => {
  'use strict';

  const contactItems = [
    {
      label: 'GitHub',
      value: 'github.com/yuchenm1303-png',
      copyValue: 'https://github.com/yuchenm1303-png',
      href: 'https://github.com/yuchenm1303-png',
      external: true,
      zhAction: '访问',
      enAction: 'Open'
    },
    {
      label: 'Phone',
      value: '15223910235',
      copyValue: '15223910235',
      href: 'tel:+8615223910235',
      zhAction: '拨打',
      enAction: 'Call'
    },
    {
      label: 'Email',
      value: 'yuchenm1303@gmail.com',
      copyValue: 'yuchenm1303@gmail.com',
      href: 'mailto:yuchenm1303@gmail.com',
      zhAction: '发邮件',
      enAction: 'Email'
    },
    {
      label: 'QQ',
      value: '552078638',
      copyValue: '552078638',
      href: 'tencent://message/?uin=552078638&Site=Chen%27s%20Homepage&Menu=yes',
      zhAction: '打开QQ',
      enAction: 'Open QQ'
    }
  ];

  function renderContactRow(item, lang) {
    const directAction = lang === 'zh' ? item.zhAction : item.enAction;
    const copyLabel = lang === 'zh' ? '复制' : 'Copy';
    const copiedLabel = lang === 'zh' ? '已复制' : 'Copied';
    const externalAttributes = item.external ? ' target="_blank" rel="noreferrer"' : '';

    return `
      <tr>
        <td>
          <span class="file-icon" aria-hidden="true">▤</span>
          <a class="pixel-link contact-row-link" href="${item.href}"${externalAttributes}>${item.label}</a>
        </td>
        <td><span class="contact-account">${item.value}</span></td>
        <td>
          <span class="contact-row-actions">
            <a class="contact-inline-action" href="${item.href}"${externalAttributes}>${directAction}</a>
            <button
              class="contact-inline-action contact-copy-action"
              type="button"
              data-contact-copy="${item.copyValue}"
              data-copy-label="${copyLabel}"
              data-copied-label="${copiedLabel}"
            >${copyLabel}</button>
          </span>
        </td>
      </tr>`;
  }

  function renderContactPage(lang) {
    const isZh = lang === 'zh';
    const count = isZh ? '4 个条目 · 0 个目录' : '4 entries · 0 directories';

    return `
      <section class="contact-index-app">
        <h2 class="section-title">Index of /contact</h2>
        <div class="contact-index-path">C:\\YUCHEN\\CONTACT\\ <span class="cursor-block"></span></div>
        <table class="file-table contact-file-table">
          <thead>
            <tr><th>Name</th><th>Account</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${contactItems.map((item) => renderContactRow(item, lang)).join('')}
          </tbody>
        </table>
        <p class="note">${count}</p>
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