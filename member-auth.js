'use strict';
// Username login is adapted to Supabase email/password auth using a project-scoped
// internal alias; no email delivery is used. Never store or display passwords to administrators.
(function () {
  const url='https://fyzgwhtqqomsftqbfvjb.supabase.co';
  const publishableKey='sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw';
  const client=window.supabase?.createClient(url,publishableKey);
  const dialog=document.getElementById('account-dialog');
  if(!dialog)return;
  if(!client){
    document.querySelectorAll('[data-account]').forEach(button=>button.addEventListener('click',()=>{
      dialog.showModal();
      document.getElementById('account-status').textContent='로그인 서비스를 불러오지 못했습니다. 새로고침해주세요.';
    }));
    dialog.querySelector('.account-close')?.addEventListener('click',()=>dialog.close());
    return;
  }
  const $=id=>document.getElementById(id);
  const form=$('account-form'),signup=$('signup-only'),status=$('account-status'),
    panel=$('member-panel'),switchButton=$('account-switch');
  const idInput=$('login-id'),bankInput=$('account-bank');
  const ID_RE=/^[a-z][a-z0-9_-]{3,19}$/;
  const alias=id=>id+'@fyzgwhtqqomsftqbfvjb.supabase.co';
  let mode='login';

  function notice(message,error=false){
    status.textContent=message||'';
    status.classList.toggle('is-error',error);
  }
  function syncRole(){
    const isOwner=$('account-type').value==='academy_owner';
    bankInput.required=mode==='signup'&&isOwner;
    $('payout-guide').textContent=isOwner
      ? '협력학원 원장은 계좌정보를 필수로 입력해주세요. 은행명과 계좌번호를 함께 입력합니다.'
      : '학부모는 추천비를 받으실 분만 계좌정보를 입력해주세요. 일반 학부모는 비워두세요.';
  }
  function setMode(next){
    mode=next;
    notice('');
    panel.hidden=true;
    form.hidden=false;
    signup.hidden=mode!=='signup';
    $('account-title').textContent=mode==='signup'?'회원가입':'로그인';
    idInput.maxLength=mode==='signup'?20:254;
    idInput.setAttribute('pattern',mode==='signup'?'[a-zA-Z][a-zA-Z0-9_-]{3,19}':'.+');
    idInput.placeholder=mode==='signup'?'영문으로 시작, 4~20자':'아이디 (기존 회원은 이메일)';
    $('login-id-label').textContent=mode==='signup'?'아이디':'아이디 (기존 회원은 이메일 가능)';
    form.elements.namedItem('password').autocomplete=mode==='signup'?'new-password':'current-password';
    form.querySelector('.account-submit').textContent=mode==='signup'?'회원가입':'로그인';
    switchButton.textContent=mode==='signup'?'이미 계정이 있으신가요? 로그인':'계정이 없으신가요? 회원가입';
    switchButton.hidden=false;
    $('admin-login-link').hidden=mode!=='login';
    syncRole();
  }
  $('account-type').addEventListener('change',syncRole);
  switchButton.addEventListener('click',()=>setMode(mode==='signup'?'login':'signup'));
  dialog.querySelector('.account-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  document.querySelectorAll('[data-account]').forEach(button=>button.addEventListener('click',async()=>{
    setMode(button.dataset.account==='signup'?'signup':'login');
    form.reset();
    if(mode==='signup')syncRole();
    dialog.showModal();
    try{
      const {data}=await client.auth.getUser();
      if(data?.user)await showMember(data.user);
    }catch(_){}
  }));

  async function showMember(user){
    const {data:profile,error}=await client.from('member_profiles')
      .select('full_name,account_type,approval_status,username').eq('user_id',user.id).single();
    if(error||!profile){notice('계정 정보를 불러올 수 없습니다. 다시 로그인해주세요.',true);return null;}
    if(profile.account_type==='admin'){
      await client.auth.signOut();
      form.hidden=true;panel.hidden=true;switchButton.hidden=true;
      $('admin-login-link').hidden=false;
      $('account-title').textContent='관리자 전용 로그인';
      notice('관리자 계정은 관리자 전용 로그인으로 이동해주세요.');
      return null;
    }
    form.hidden=true;panel.hidden=false;switchButton.hidden=true;
    $('account-title').textContent='내 계정';
    const kind=profile.account_type==='parent'?'학부모':'협력학원 원장';
    const stage=profile.approval_status==='approved'?'가입 승인 완료'
      :profile.approval_status==='rejected'?'가입 반려':'관리자 승인 대기';
    $('member-message').textContent=profile.full_name+'님, '+kind+' · '+stage;
    const href=profile.account_type==='academy_owner'?'academy-dashboard.html':'parent-dashboard.html';
    $('account-dashboard-link').href=href;
    $('account-dashboard-link').hidden=false;
    return href;
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    notice('');
    const submit=form.querySelector('.account-submit');
    submit.disabled=true;
    const fields=new FormData(form);
    const rawId=String(fields.get('login_id')||'').trim();
    const password=String(fields.get('password')||'');
    try{
      if(mode==='signup'){
        const accountType=String(fields.get('account_type')||'');
        const name=String(fields.get('full_name')||'').trim();
        const username=rawId.toLowerCase();
        const bank=String(fields.get('account_details')||'').trim();
        if(!['parent','academy_owner'].includes(accountType))throw new Error('회원 유형을 확인해주세요.');
        if(!name||name.length>60)throw new Error('이름을 입력해주세요.');
        if(!ID_RE.test(username))throw new Error('아이디는 영문자로 시작하는 4~20자의 영문·숫자·밑줄·하이픈만 가능합니다.');
        if(password.length<8)throw new Error('비밀번호는 8자 이상 입력해주세요.');
        if(accountType==='academy_owner'&&!bank)throw new Error('학원장은 은행명과 계좌번호를 입력해주세요.');
        if(bank&&bank.length<8)throw new Error('은행명과 계좌번호를 함께 입력해주세요.');
        if(bank.length>100)throw new Error('계좌정보가 너무 깁니다.');
        if(!$('account-consent').checked)throw new Error('개인정보 수집·이용 동의가 필요합니다.');
        // No bank data or passwords in user-editable auth metadata.
        const {data,error}=await client.auth.signUp({
          email:alias(username),password,
          options:{data:{account_type:accountType,full_name:name,username,
            privacy_consent_version:'2026-11-11',privacy_consent_at:new Date().toISOString()}}
        });
        if(error)throw error;
        if(!data?.user)throw new Error('회원가입 결과를 확인할 수 없습니다.');
        if(bank){
          if(!data.session)throw new Error('회원 계정은 생성됐지만 계좌정보를 저장할 수 없습니다. 관리자에게 가입 아이디를 알려주세요.');
          const {error:bankError}=await client.from('member_payout_accounts').upsert({
            user_id:data.user.id,account_details:bank,updated_at:new Date().toISOString()
          },{onConflict:'user_id'});
          if(bankError){
            form.hidden=true;switchButton.hidden=true;
            $('account-title').textContent='회원가입 신청 완료';
            notice('계정은 생성됐지만 계좌정보 저장에 실패했습니다. 관리자에게 문의하여 계좌정보를 등록해주세요.',true);
            return;
          }
        }
        form.reset();form.hidden=true;switchButton.hidden=true;
        $('account-title').textContent='회원가입 신청 완료';
        panel.hidden=true;
        notice(data.session
          ? '가입 신청이 접수됐습니다. 관리자 승인 후 서비스를 이용할 수 있습니다.'
          : '가입 신청은 접수됐지만 로그인 확인이 필요합니다. 관리자에게 문의해주세요.');
      }else{
        const username=rawId.toLowerCase();
        const email=rawId.includes('@')?rawId:(ID_RE.test(username)?alias(username):'');
        if(!email)throw new Error('아이디를 확인해주세요.');
        const {data,error}=await client.auth.signInWithPassword({email,password});
        if(error)throw error;
        const route=await showMember(data.user);
        if(route)window.location.assign(route);
      }
    }catch(error){
      const raw=String(error?.message||'').toLowerCase();
      const code=String(error?.code||'').toLowerCase();
      const msg=raw.includes('already registered')||code==='user_already_exists'
        ? '이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.'
        :raw.includes('invalid login credentials')||code==='invalid_credentials'
        ?'아이디 또는 비밀번호를 확인해주세요.'
        :raw.includes('email address')||code==='email_address_invalid'
        ?'아이디 계정 생성에 문제가 있습니다. 관리자에게 문의해주세요.'
        :raw.includes('too many requests')
        ?'요청이 많습니다. 잠시 후 다시 시도해주세요.'
        :raw.includes('failed to fetch')||raw.includes('network')
        ?'로그인 서비스 연결이 원활하지 않습니다.'
        :error?.message||'요청 처리 중 오류가 발생했습니다.';
      notice(msg,true);
      if(mode==='login'&&typeof window.alert==='function')window.alert(msg);
    }finally{submit.disabled=false;}
  });
  $('member-signout').addEventListener('click',async()=>{
    await client.auth.signOut();
    setMode('login');form.reset();
    document.querySelectorAll('[data-account="login"]').forEach(el=>el.textContent='로그인');
  });
  client.auth.onAuthStateChange((event,session)=>{
    document.querySelectorAll('[data-account="login"]').forEach(el=>el.textContent=session?'내 계정':'로그인');
  });
  client.auth.getSession().then(({data})=>{
    if(data?.session)document.querySelectorAll('[data-account="login"]').forEach(el=>el.textContent='내 계정');
  }).catch(()=>{});
})();
