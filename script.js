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

/* Shared curriculum dropdown behavior. Buttons never navigate by themselves. */
document.querySelectorAll('[data-course-dropdown]').forEach(group => {
  const trigger=group.querySelector('.course-dropdown-trigger');
  const setOpen=open => {
    group.classList.toggle('is-open',open);
    trigger.setAttribute('aria-expanded',String(open));
  };
  trigger.addEventListener('click',()=>setOpen(!group.classList.contains('is-open')));
  group.addEventListener('mouseenter',()=>{if(window.matchMedia('(hover: hover) and (pointer: fine)').matches)setOpen(true);});
  group.addEventListener('mouseleave',()=>setOpen(false));
  group.addEventListener('focusin',()=>setOpen(true));
  group.addEventListener('focusout',e=>{if(!group.contains(e.relatedTarget))setOpen(false);});
  document.addEventListener('click',e=>{if(!group.contains(e.target))setOpen(false);});
  group.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);trigger.focus();}});
});
document.querySelectorAll('[data-mobile-course-group]').forEach(group=>{
  const trigger=group.querySelector('.mobile-course-trigger');
  const panel=group.querySelector('.mobile-course-links');
  const setOpen=open=>{panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));};
  setOpen(false);
  trigger.addEventListener('click',()=>setOpen(panel.hidden));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
});
