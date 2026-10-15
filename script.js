'use strict';
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#mobile-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const opened = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!opened));
    toggle.setAttribute('aria-label', opened ? '메뉴 열기' : '메뉴 닫기');
    nav.hidden = opened;
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '메뉴 열기');
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !nav.hidden) {
      nav.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

// Account navigation is visible, but credentials are not collected until an authentication backend exists.
const accountDialog = document.getElementById('account-dialog');
if (accountDialog) {
  const title = accountDialog.querySelector('#account-title');
  document.querySelectorAll('[data-account]').forEach(control => control.addEventListener('click', () => {
    title.textContent = control.dataset.account === 'signup' ? '회원가입' : '로그인';
    accountDialog.showModal();
  }));
  accountDialog.querySelector('.account-close').addEventListener('click', () => accountDialog.close());
  accountDialog.addEventListener('click', e => { if (e.target === accountDialog) accountDialog.close(); });
}
