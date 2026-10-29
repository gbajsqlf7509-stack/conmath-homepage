'use strict';
(() => {
  const form = document.getElementById('admin-login-form');
  const status = document.getElementById('dashboard-message');
  const button = document.getElementById('admin-login-submit');
  if (!form || !status || !button) return;
  const display = (message, bad = false, popup = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', bad);
    status.classList.toggle('is-success', !bad);
    status.setAttribute('role', bad ? 'alert' : 'status');
    if (bad && popup && typeof window.alert === 'function') window.alert(message);
  };
  const timeout = (p,ms,label) => {
    let timer;
    return Promise.race([
      p,
      new Promise((_,reject) => {timer=setTimeout(()=>reject(new Error(label)),ms);})
    ]).finally(()=>clearTimeout(timer));
  };
  const explain = error => {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    if (message.includes('invalid login credentials') || code==='invalid_credentials')
      return '이메일 또는 비밀번호를 확인해주세요.';
    if (message.includes('email not confirmed') || code==='email_not_confirmed')
      return '이메일 인증이 완료되지 않았습니다. 메일을 확인해주세요.';
    if (message.includes('too many requests') || code==='over_request_rate_limit')
      return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
    if (message.includes('failed to fetch') || message.includes('network') || message.includes('fetch failed'))
      return '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요.';
    if (message.includes('시간이 초과'))
      return message;
    if (message.includes('관리자') || message.includes('회원'))
      return error.message;
    return '로그인 과정에서 오류가 발생했습니다. 새로고침한 뒤 다시 시도해주세요.';
  };
  const client=window.supabase?.createClient(
    'https://fyzgwhtqqomsftqbfvjb.supabase.co',
    'sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw'
  );
  if(!client) {
    display('로그인 서비스를 불러오지 못했습니다. 페이지를 새로고침해주세요.',true);
    button.disabled=true;
    return;
  }
  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (button.disabled) return;
    const fields=new FormData(form);
    const email=String(fields.get('email')||'').trim();
    const password=String(fields.get('password')||'');
    if (!email || !password) {
      display('이메일과 비밀번호를 모두 입력해주세요.',true,true);
      return;
    }
    button.disabled=true;
    button.textContent='로그인 확인 중…';
    display('관리자 계정 확인 중입니다.');
    try {
      const {data,error}=await timeout(
        client.auth.signInWithPassword({email,password}),15000,
        '로그인 요청 시간이 초과되었습니다. 네트워크를 확인하고 다시 시도해주세요.'
      );
      if (error) throw error;
      const user=data?.user;
      if(!user?.id) throw new Error('로그인 정보를 확인할 수 없습니다. 다시 시도해주세요.');
      display('비밀번호 인증 완료. 관리자 권한 확인 중입니다.');
      // signInWithPassword has already returned the verified user. Avoid a redundant
      // getUser() network round-trip immediately after login.
      const [profileResult,badgeResult]=await timeout(
        Promise.all([
          client.from('member_profiles').select('account_type').eq('user_id',user.id).single(),
          client.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle()
        ]),15000,'관리자 권한 확인 시간이 초과되었습니다. 다시 로그인해주세요.'
      );
      if(profileResult.error || badgeResult.error)
        throw new Error('로그인은 성공했지만 관리자 권한 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
      if(profileResult.data?.account_type!=='admin' || !badgeResult.data){
        await client.auth.signOut();
        throw new Error('관리자 권한이 없는 계정입니다. 관리자 전용 이메일을 사용해주세요.');
      }
      display('관리자 인증 완료. 관리자 화면으로 이동합니다.');
      window.location.assign('admin-dashboard.html');
    } catch(error) {
      display(explain(error),true,true);
    } finally {
      button.disabled=false;
      button.textContent='관리자 로그인';
    }
  });
})();