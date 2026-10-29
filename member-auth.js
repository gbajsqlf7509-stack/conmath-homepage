'use strict';
// Browser-safe publishable key only. Never place service_role or database passwords in client files.
(function () {
  const url = 'https://fyzgwhtqqomsftqbfvjb.supabase.co';
  const publishableKey = 'sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw';
  const client = window.supabase?.createClient(url, publishableKey);
  const dialog = document.getElementById('account-dialog');
  if (!dialog) return;
  if (!client) {
    document.querySelectorAll('[data-account]').forEach(button => button.addEventListener('click', () => {
      dialog.showModal();
      document.getElementById('account-status').textContent = '로그인 서비스를 불러오지 못했습니다. 새로고침하거나 잠시 후 다시 시도해주세요.';
    }));
    dialog.querySelector('.account-close')?.addEventListener('click', () => dialog.close());
    return;
  }
  const $ = id => document.getElementById(id);
  const form = $('account-form'), signup = $('signup-only'), academy = $('academy-fields'),
    status = $('account-status'), panel = $('member-panel'), switchButton = $('account-switch');
  let mode = 'login';
  function notice(message, error = false) {
    status.textContent = message || '';
    status.classList.toggle('is-error', error);
  }
  function setMode(next) {
    mode = next;
    notice('');
    panel.hidden = true;
    form.hidden = false;
    signup.hidden = mode !== 'signup';
    $('account-title').textContent = mode === 'signup' ? '회원가입' : '로그인';
    $('account-type').dispatchEvent(new Event('change'));
    form.elements.namedItem('password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    form.querySelector('.account-submit').textContent = mode === 'signup' ? '이메일로 회원가입' : '로그인';
    switchButton.textContent = mode === 'signup' ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입';
    switchButton.hidden = false;
  }
  $('account-type').addEventListener('change', () => {
    academy.hidden = $('account-type').value !== 'academy_owner';
  });
  switchButton.addEventListener('click', () => setMode(mode === 'signup' ? 'login' : 'signup'));
  dialog.querySelector('.account-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  document.querySelectorAll('[data-account]').forEach(button => button.addEventListener('click', async () => {
    setMode(button.dataset.account === 'signup' ? 'signup' : 'login');
    form.reset();
    $('account-type').dispatchEvent(new Event('change'));
    dialog.showModal();
    try {
      const { data, error } = await client.auth.getUser();
      if (error && error.message !== 'Auth session missing!') notice('계정 상태 확인 중 오류가 발생했습니다.', true);
      if (data?.user) await showMember(data.user);
    } catch {
      notice('로그인 상태를 확인하지 못했습니다. 다시 시도해주세요.', true);
    }
  }));
  async function showMember(user) {
    const { data: profile, error } = await client.from('member_profiles')
      .select('full_name, account_type, approval_status').eq('user_id', user.id).single();
    if (error || !profile) { notice('계정 정보를 불러오지 못했어요. 다시 로그인해주세요.', true); return; }
    form.hidden = true;
    panel.hidden = false;
    switchButton.hidden = true;
    $('account-title').textContent = '내 계정';
    const state = profile.account_type === 'admin' ? '관리자 계정'
      : profile.account_type === 'parent' ? '학부모 계정 · 이용 가능'
      : profile.approval_status === 'approved' ? '학원 원장 · 승인 완료'
      : profile.approval_status === 'rejected' ? '학원 원장 · 승인 반려'
      : '학원 원장 · 관리자 승인 대기';
    $('member-message').textContent = profile.full_name + '님, ' + state;
    const { data: admin, error: adminError } = await client.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (adminError) { notice('계정 권한을 확인하지 못했습니다.', true); return; }
    if (profile.account_type === 'admin' && !admin) { notice('관리자 권한이 확인되지 않았습니다.', true); return; }
    const route = (admin && profile.account_type === 'admin') ? 'admin-dashboard.html' : (
      profile.account_type === 'academy_owner' ? 'academy-dashboard.html' : 'parent-dashboard.html'
    );
    $('account-dashboard-link').href = route;
    $('account-dashboard-link').hidden = false;
    return route;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    notice('');
    const submit = form.querySelector('.account-submit');
    submit.disabled = true;
    const fields = new FormData(form);
    const email = String(fields.get('email') || '').trim();
    const password = String(fields.get('password') || '');
    try {
      if (mode === 'signup') {
        const type = String(fields.get('account_type'));
        if (!['parent','academy_owner'].includes(type)) throw new Error('올바른 회원 유형을 선택해주세요.');
        const fullName = String(fields.get('full_name') || '').trim();
        const phone = String(fields.get('phone') || '').trim();
        const academyName = String(fields.get('academy_name') || '').trim();
        const academyAddress = String(fields.get('academy_address') || '').trim();
        if (!fullName || !phone || (type === 'academy_owner' && (!academyName || !academyAddress)))
          throw new Error('필수 정보를 모두 입력해주세요.');
        const digits = phone.replace(/\D/g, '');
        if (!/^[0-9 +()\-]+$/.test(phone) || digits.length < 9 || digits.length > 11) {
          throw new Error('올바른 연락처를 입력해주세요. (숫자 9~11자리)');
        }
        if (!$('account-consent').checked) throw new Error('개인정보 수집·이용 동의가 필요합니다.');
        const { error } = await client.auth.signUp({email,password,options:{
          emailRedirectTo: window.location.origin + window.location.pathname,
          data: {account_type:type,full_name:fullName,phone,academy_name:academyName,academy_address:academyAddress}
        }});
        if (error) throw error;
        form.reset();
        notice('가입 신청이 접수됐습니다. 이메일 인증 안내를 확인해주세요. 원장 계정은 추가 승인이 필요합니다.');
      } else {
        const {data,error} = await client.auth.signInWithPassword({email,password});
        if (error) throw error;
        const route = await showMember(data.user);
        if (route) window.location.assign(route);
      }
    } catch (error) {
      notice(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호를 확인해주세요.' : error.message,true);
    } finally { submit.disabled = false; }
  });
  $('member-signout').addEventListener('click',async()=> {
    await client.auth.signOut();
    setMode('login');
    form.reset();
    document.querySelectorAll('[data-account="login"]').forEach(el=>el.textContent='로그인');
  });
  client.auth.onAuthStateChange((event,session) => {
    document.querySelectorAll('[data-account="login"]').forEach(el=>el.textContent=session ? '내 계정' : '로그인');
  });
  client.auth.getSession().then(({data}) => {
    if (data?.session) document.querySelectorAll('[data-account="login"]').forEach(el=>el.textContent='내 계정');
  }).catch(() => {});
})();
