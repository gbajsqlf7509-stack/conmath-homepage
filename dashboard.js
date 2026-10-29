'use strict';
(async () => {
  const projectUrl='https://fyzgwhtqqomsftqbfvjb.supabase.co';
  const key='sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw';
  const supabase=window.supabase?.createClient(projectUrl,key);
  const page=document.body.dataset.dashboardRole;
  const message=document.getElementById('dashboard-message');
  const showMessage=(text,isError=false)=>{
    if(!message)return;
    message.textContent=text;
    message.classList.toggle('is-error',isError);
  };
  if(!supabase){showMessage('인증 서비스를 불러오지 못했습니다. 새로고침해주세요.',true);return;}
  const dashboardUrl=role=>({
    parent:'parent-dashboard.html',academy_owner:'academy-dashboard.html',admin:'admin-dashboard.html'
  }[role]||'index.html');
  async function getCurrentRole(){
    const {data:{user},error}=await supabase.auth.getUser();
    if(error||!user)return {user:null};
    const {data:profile,error:profileError}=await supabase.from('member_profiles')
      .select('full_name,account_type,approval_status,academy_name')
      .eq('user_id',user.id).single();
    if(profileError||!profile)throw new Error('회원 정보를 불러올 수 없습니다.');
    const {data:admin,error:adminError}=await supabase.from('platform_admins')
      .select('user_id').eq('user_id',user.id).maybeSingle();
    if(adminError)throw adminError;
    if(profile.account_type==='admin' && !admin)throw new Error('관리자 계정 권한을 확인할 수 없습니다.');
    return {user,profile,role:admin && profile.account_type==='admin' ? 'admin' : profile.account_type};
  }
  if(page==='admin-login'){
    const login=document.getElementById('admin-login-form');
    login.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=document.getElementById('admin-login-submit');
      button.disabled=true;showMessage('');
      try{
        const f=new FormData(login);
        const {error}=await supabase.auth.signInWithPassword({
          email:String(f.get('email')||'').trim(),password:String(f.get('password')||'')
        });
        if(error)throw error;
        const result=await getCurrentRole();
        if(result.role!=='admin'){
          await supabase.auth.signOut();
          throw new Error('이 계정에는 관리자 권한이 없습니다.');
        }
        location.replace('admin-dashboard.html');
      }catch(error){showMessage(error.message||'로그인에 실패했습니다.',true)}
      finally{button.disabled=false}
    });
    return;
  }
  try{
    const result=await getCurrentRole();
    if(!result.user){location.replace('index.html');return;}
    if(result.role!==page){location.replace(dashboardUrl(result.role));return;}
    document.getElementById('dashboard-content').hidden=false;
    document.getElementById('user-greeting').textContent=(result.profile.full_name||'회원')+'님, 안녕하세요.';
    showMessage('');
    document.getElementById('dashboard-logout').addEventListener('click',async()=>{
      await supabase.auth.signOut();location.replace('index.html');
    });
    if(page==='academy_owner'){
      const state=result.profile.approval_status;
      document.getElementById('academy-approval-text').textContent={
        pending:'관리자 가입 승인 대기 중입니다. 승인되면 원장 전용 기능을 이용할 수 있습니다.',
        rejected:'가입 신청이 반려되었습니다. 콘매쓰에 문의해주세요.',
        approved:'승인 완료 · '+(result.profile.academy_name||'등록된 학원')
      }[state]||'가입 상태를 확인해주세요.';
      document.getElementById('owner-approved-content').hidden=state!=='approved';
      if (state==='approved') await loadPartnerPolicy();
    }
    if(page==='admin') { await Promise.all([loadPending(),loadPartnerPolicy()]); }
  }catch(error){showMessage('대시보드를 불러오지 못했습니다: '+error.message,true)}
  async function loadPartnerPolicy(){
    const label=document.getElementById('partner-referral-rate');
    const breakdown=document.getElementById('partner-rate-breakdown');
    const {data,error}=await supabase.from('partner_referral_direction_rates')
      .select('direction,rate_pct,effective_at')
      .lte('effective_at',new Date().toISOString()).order('effective_at',{ascending:false});
    if(error||!data?.length){
      if(label) label.textContent='정책 확인 필요';
      if(breakdown) breakdown.textContent='양방향 추천 정책을 불러오지 못했습니다.';
      return;
    }
    const rates=new Map();
    for(const item of data)if(!rates.has(item.direction))rates.set(item.direction,item);
    const paid=rates.get('partner_to_conmath');
    const received=rates.get('conmath_to_partner');
    const fmt=x=>Number(x).toLocaleString('ko-KR',{maximumFractionDigits:2})+'%';
    if(label)label.textContent=paid?fmt(paid.rate_pct):'미설정';
    if(breakdown)breakdown.textContent=
      '협력학원 → 콘매쓰: 콘매쓰가 협력학원에 '
      +(paid?fmt(paid.rate_pct):'미설정')+' 지급. 콘매쓰 → 협력학원: 협력학원이 콘매쓰에 '
      +(received?fmt(received.rate_pct):'미설정')
      +' 지급. 실제 납부 원비 기준이며 양방향 수익은 합산하지 않습니다.';
  }
  async function loadPending(){
    const target=document.getElementById('pending-members');
    target.textContent='조회 중…';
    const {data,error}=await supabase.from('member_profiles')
      .select('user_id,full_name,email,phone,academy_name,academy_address,approval_status')
      .eq('account_type','academy_owner').eq('approval_status','pending')
      .order('created_at',{ascending:true});
    target.textContent='';
    if(error){target.textContent='승인 목록을 조회하지 못했습니다.';return;}
    if(!data?.length){target.textContent='현재 승인 대기 중인 원장이 없습니다.';return;}
    for(const item of data){
      const row=document.createElement('section');row.className='pending-member';
      const p=document.createElement('p');
      p.textContent=[item.full_name,item.academy_name,item.academy_address,item.email,item.phone].filter(Boolean).join(' · ');
      const button=document.createElement('button');button.type='button';button.textContent='승인';
      button.addEventListener('click',async()=>{
        if(!confirm((item.academy_name||'이 학원')+' 원장 가입을 승인하시겠습니까?'))return;
        button.disabled=true;
        const {error:updateError}=await supabase.from('member_profiles')
          .update({approval_status:'approved',updated_at:new Date().toISOString()})
          .eq('user_id',item.user_id).eq('approval_status','pending');
        if(updateError){showMessage('승인 실패: '+updateError.message,true);button.disabled=false;return;}
        showMessage('원장 계정을 승인했습니다.');await loadPending();
      });
      row.append(p,button);target.append(row);
    }
  }
})();