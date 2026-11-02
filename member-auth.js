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
  const form = $('account-form'), signup = $('signup-only'), academy = $('academy-fields'), parentFields = $('parent-fields'),
    status = $('account-status'), panel = $('member-panel'), switchButton = $('account-switch');
  let mode = 'login';
  // UI-facing login IDs; Supabase Auth currently accepts email/phone identifiers.
  // Internal alias is never shown to users or used for password recovery emails.
  // This draft must NOT be merged until Confirm Email is OFF and the
  // username/child RLS migration has been applied and verified.
  const ACCOUNT_DOMAIN = 'accounts.conmath.kr';
  const validId = /^[a-z][a-z0-9_]{3,19}$/;
  function normalizeId(value) {
    const id = String(value || '').trim().toLowerCase();
    if (!validId.test(id)) throw new Error('아이디는 영문으로 시작하며 영문 소문자·숫자·_ 포함 4~20자로 입력해주세요.');
    if (['admin', 'administrator', 'support', 'system', 'root'].includes(id))
      throw new Error('사용할 수 없는 아이디입니다.');
    return id;
  }
  function identityForLogin(value) {
    const input = String(value || '').trim();
    // Transitional compatibility for the two pre-existing test signups.
    if (input.includes('@')) return input;
    return normalizeId(input) + '@' + ACCOUNT_DOMAIN;
  }
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
    form.querySelector('.account-submit').textContent = mode === 'signup' ? '회원가입' : '로그인';
    switchButton.textContent = mode === 'signup' ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입';
    switchButton.hidden = false;
    $('admin-login-link').hidden = mode !== 'login';
  }
  $('account-type').addEventListener('change', () => {
    const isAcademy = $('account-type').value === 'academy_owner';
    academy.hidden = !isAcademy;
    parentFields.hidden = isAcademy;
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
    if (profile.account_type === 'admin') {
      await client.auth.signOut();
      form.hidden = true;
      panel.hidden = true;
      switchButton.hidden = true;
      $('admin-login-link').hidden = false;
      $('account-title').textContent = '관리자 전용 로그인';
      notice('관리자 계정은 일반 회원 로그인에서 이용할 수 없습니다. 아래 관리자 전용 로그인으로 이동해주세요.');
      return null;
    }
    form.hidden = true;
    panel.hidden = false;
    switchButton.hidden = true;
    $('account-title').textContent = '내 계정';
    const accountLabel = profile.account_type === 'parent' ? '학부모' : '협력학원 원장';
    const state = profile.approval_status === 'approved' ? accountLabel + ' · 승인 완료'
      : profile.approval_status === 'rejected' ? accountLabel + ' · 가입 반려'
      : accountLabel + ' · 관리자 승인 대기';
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
    const loginId = String(fields.get('login_id') || '').trim();
    const password = String(fields.get('password') || '');
    try {
      if (mode === 'signup') {
        const type = String(fields.get('account_type'));
        if (!['parent','academy_owner'].includes(type)) throw new Error('올바른 회원 유형을 선택해주세요.');
        const username = normalizeId(loginId);
        const childName = String(fields.get('child_name') || '').trim();
        const academyName = String(fields.get('academy_name') || '').trim();
        const academyAddress = String(fields.get('academy_address') || '').trim();
        if (type === 'parent' && (!childName || childName.length > 60))
          throw new Error('아이 이름을 60자 이내로 입력해주세요.');
        if (type === 'academy_owner' && (!academyName || !academyAddress))
          throw new Error('학원명과 학원 주소를 모두 입력해주세요.');
        if (!$('account-consent').checked) throw new Error('개인정보 수집·이용 동의가 필요합니다.');
        const {data,error} = await client.auth.signUp({
          email: identityForLogin(username),password,options:{
          data: {
            account_type:type,
            login_id:username,
            // Only signup metadata; child data is copied into a protected child table
            // by the trusted database trigger (not used for authorization).
            child_name: type === 'parent' ? childName : '',
            academy_name:type === 'academy_owner' ? academyName : '',
            academy_address:type === 'academy_owner' ? academyAddress : '',
            full_name:type === 'parent' ? '학부모 회원' : '협력학원 담당자',
            privacy_consent_version:'2026-10-29-username-draft',
            privacy_consent_at:new Date().toISOString()
          }
        }});
        if (error) throw error;
        form.reset();
        form.hidden = true;
        switchButton.hidden = true;
        if (data?.session && data?.user) {
          // Supabase Confirm email disabled: signup returns an authenticated
          // session immediately, without sending a confirmation message.
          $('account-title').textContent = '가입 신청 완료';
          panel.hidden = false;
          $('member-message').textContent = type === 'academy_owner'
            ? '협력학원 원장 가입 신청이 접수됐습니다. 관리자 승인 후 원장 전용 기능을 이용할 수 있습니다.'
            : '학부모 가입 신청이 접수됐습니다. 관리자 승인 후 학부모 전용 기능을 이용할 수 있습니다.';
          $('account-dashboard-link').href =
            type === 'academy_owner' ? 'academy-dashboard.html' : 'parent-dashboard.html';
          $('account-dashboard-link').hidden = false;
          notice('가입 신청 완료 · 관리자 승인 대기');
        } else {
          // Username-only signup requires email confirmation to be OFF. An
          // internal alias has no delivery inbox, so do not claim an email was sent.
          $('account-title').textContent = '가입 설정 확인 필요';
          notice('아이디 방식의 가입 설정이 아직 준비되지 않았습니다. 관리자에게 문의해주세요.', true);
        }
      } else {
        const {data,error} = await client.auth.signInWithPassword({email:identityForLogin(loginId),password});
        if (error) throw error;
        const route = await showMember(data.user);
        if (route) window.location.assign(route);
      }
    } catch (error) {
      const raw = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '').toLowerCase();
      const message = raw.includes('invalid login credentials') || code === 'invalid_credentials'
        ? '이메일 또는 비밀번호를 확인해주세요.'
        : raw.includes('email not confirmed') || code === 'email_not_confirmed'
        ? '이메일 인증이 완료되지 않았습니다. 받은 메일을 확인해주세요.'
        : raw.includes('too many requests')
        ? '로그인 요청이 많습니다. 잠시 후 다시 시도해주세요.'
        : raw.includes('failed to fetch') || raw.includes('network')
        ? '로그인 서비스 연결이 원활하지 않습니다. 인터넷 상태를 확인해주세요.'
        : error?.message || '요청 처리 중 오류가 발생했습니다.';
      notice(message,true);
      if (mode === 'login' && typeof window.alert === 'function') window.alert(message);
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
