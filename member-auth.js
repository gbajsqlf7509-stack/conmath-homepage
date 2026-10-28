'use strict';
// Browser-safe publishable key only. Never place service_role or database passwords in client files.
(function () {
  const url = 'https://fyzgwhtqqomsftqbfvjb.supabase.co';
  const publishableKey = 'sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw';
  const client = window.supabase?.createClient(url, publishableKey);
  const dialog = document.getElementById('account-dialog');
  if (!client || !dialog) return;
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
    form.password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
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
    const { data: { user } } = await client.auth.getUser();
    if (user) await showMember(user);
  }));
  async function showMember(user) {
    const { data: profile, error } = await client.from('member_profiles')
      .select('full_name, account_type, approval_status').eq('user_id', user.id).single();
    if (error || !profile) { notice('계정 정보를 불러오지 못했어요. 다시 로그인해주세요.', true); return; }
    form.hidden = true;
    panel.hidden = false;
    switchButton.hidden = true;
    $('account-title').textContent = '내 계정';
    const state = profile.account_type === 'parent' ? '학부모 계정 · 이용 가능'
      : profile.approval_status === 'approved' ? '학원 원장 · 승인 완료'
      : profile.approval_status === 'rejected' ? '학원 원장 · 승인 반려'
      : '학원 원장 · 관리자 승인 대기';
    $('member-message').textContent = profile.full_name + '님, ' + state;
    const { data: admin } = await client.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    $('admin-area').hidden = !admin;
    if (admin) await loadPending();
  }
  async function loadPending() {
    const target = $('pending-members');
    target.textContent = '조회 중…';
    const { data, error } = await client.from('member_profiles')
      .select('user_id,full_name,email,phone,academy_name,academy_address,approval_status')
      .eq('account_type','academy_owner').eq('approval_status','pending').order('created_at',{ascending:true});
    target.textContent = '';
    if (error) { target.textContent = '승인 목록을 불러오지 못했습니다.'; return; }
    if (!data?.length) { target.textContent = '승인 대기 중인 원장이 없습니다.'; return; }
    for (const member of data) {
      const row = document.createElement('section');
      row.className = 'pending-member';
      const details = document.createElement('p');
      details.textContent = [member.full_name,member.academy_name,member.academy_address,member.email,member.phone].filter(Boolean).join(' · ');
      const approve = document.createElement('button');
      approve.type = 'button';
      approve.className = 'account-submit';
      approve.textContent = '승인';
      approve.addEventListener('click', async () => {
        if (!confirm(member.academy_name + ' 원장 가입을 승인하시겠습니까?')) return;
        approve.disabled = true;
        const { error: updateError } = await client.from('member_profiles')
          .update({approval_status:'approved',updated_at:new Date().toISOString()}).eq('user_id',member.user_id);
        if (updateError) { notice('승인 실패: ' + updateError.message,true); approve.disabled = false; }
        else { notice('원장 계정을 승인했습니다.'); await loadPending(); }
      });
      row.append(details,approve);
      target.append(row);
    }
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
        const fullName = String(fields.get('full_name') || '').trim();
        const phone = String(fields.get('phone') || '').trim();
        const academyName = String(fields.get('academy_name') || '').trim();
        const academyAddress = String(fields.get('academy_address') || '').trim();
        if (!fullName || !phone || (type === 'academy_owner' && (!academyName || !academyAddress)))
          throw new Error('필수 정보를 모두 입력해주세요.');
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
        await showMember(data.user);
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
    if (data.session) document.querySelectorAll('[data-account="login"]').forEach(el=>el.textContent='내 계정');
  });
})();
