'use strict';
(async () => {
  const $ = id => document.getElementById(id);
  const pageMessage = $('dashboard-message');
  const show = (value,bad=false) => {
    if (!pageMessage) return;
    pageMessage.textContent=value;
    pageMessage.classList.toggle('is-error',bad);
    pageMessage.setAttribute('role',bad?'alert':'status');
  };
  const projectUrl='https://fyzgwhtqqomsftqbfvjb.supabase.co';
  const publishableKey='sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw';
  const authClient=window.supabase?.createClient(projectUrl,publishableKey);
  const bootstrapKey='conmath_admin_bootstrap_v1';
  const timeout = (promise,ms,label) => {
    let handle;
    return Promise.race([
      promise,new Promise((_,reject)=>handle=setTimeout(()=>reject(new Error(label)),ms))
    ]).finally(()=>clearTimeout(handle));
  };
  const rest = async (method,path,token,params={},payload) => {
    const url=new URL(projectUrl+path);
    for(const [name,value] of Object.entries(params))url.searchParams.set(name,String(value));
    const response=await timeout(fetch(url.toString(),{
      method,
      headers:{
        'apikey':publishableKey,
        'Authorization':'Bearer '+token,
        'Accept':'application/json',
        ...(payload===undefined?{}:{'Content-Type':'application/json','Prefer':'return=representation'})
      },
      ...(payload===undefined?{}:{body:JSON.stringify(payload)})
    }),12000,'관리자 자료 요청 시간이 초과됐습니다. 다시 시도해주세요.');
    if (!response.ok) {
      if (response.status===401)throw new Error('관리자 로그인 시간이 만료됐습니다. 다시 로그인해주세요.');
      throw new Error('자료 요청 실패 ('+response.status+'). 새로고침해서 다시 시도해주세요.');
    }
    return response.status===204?[]:response.json();
  };
  if(!authClient){show('인증 서비스를 불러오지 못했습니다. 새로고침해주세요.',true);return;}
  let token='',userId='';
  try {
    show('관리자 권한을 확인하고 있습니다.');
    const boot = JSON.parse(sessionStorage.getItem(bootstrapKey)||'null');
    if(boot?.token&&boot?.user_id&&(!boot.expires_at||boot.expires_at*1000>Date.now())){
      token=boot.token;
      userId=boot.user_id;
    }else{
      sessionStorage.removeItem(bootstrapKey);
      const {data,error}=await timeout(authClient.auth.getSession(),11000,'로그인 정보 확인 시간이 초과됐습니다.');
      if(error)throw error;
      token=data?.session?.access_token||'';
      userId=data?.session?.user?.id||'';
    }
    if(!token||!userId){
      show('로그인이 필요합니다. 관리자 로그인 화면으로 이동합니다.',true);
      window.location.replace('admin-login.html');
      return;
    }
    // Verify the server-recognized user for this JWT, not a user_id supplied by storage.
    const user=await rest('GET','/auth/v1/user',token);
    if(user?.id!==userId)throw new Error('관리자 세션이 일치하지 않습니다. 다시 로그인해주세요.');
    const [profiles,badges]=await Promise.all([
      rest('GET','/rest/v1/member_profiles',token,{select:'full_name,account_type','user_id':'eq.'+user.id}),
      rest('GET','/rest/v1/platform_admins',token,{select:'user_id','user_id':'eq.'+user.id})
    ]);
    if(profiles?.[0]?.account_type!=='admin'||!badges?.[0]?.user_id)
      throw new Error('관리자 권한이 확인되지 않았습니다.');
    $('dashboard-content').hidden=false;
    $('user-greeting').textContent=(profiles[0].full_name||'관리자')+'님, 안녕하세요.';
    show('관리자 로그인 완료.');
    $('dashboard-logout').addEventListener('click',async()=>{
      sessionStorage.removeItem(bootstrapKey);
      try {await timeout(authClient.auth.signOut(),5000,'로그아웃 시간 초과');}
      catch(error){show('로그아웃 과정에 문제가 있습니다. 다시 로그인할 때 계정 상태를 확인해주세요.',true);}
      window.location.replace('admin-login.html');
    });
    const loadPending=async()=>{
      const target=$('pending-members');
      target.textContent='학부모·협력학원 가입 신청 조회 중…';
      try{
        const [rows,usernames,children]=await Promise.all([
          rest('GET','/rest/v1/member_profiles',token,{
            select:'user_id,account_type,academy_name,academy_address,approval_status',
            approval_status:'eq.pending',order:'created_at.asc'
          }),
          rest('GET','/rest/v1/member_login_ids',token,{
            select:'user_id,login_id'
          }),
          rest('GET','/rest/v1/parent_children',token,{
            select:'parent_user_id,child_name'
          })
        ]);
        const nameForId=new Map(usernames.map(x=>[x.user_id,x.login_id]));
        const childrenForId=new Map();
        for(const child of children){
          const list=childrenForId.get(child.parent_user_id)||[];
          list.push(child.child_name);
          childrenForId.set(child.parent_user_id,list);
        }
        target.replaceChildren();
        if(!rows.length){target.textContent='현재 승인 대기 중인 회원가입 신청이 없습니다.';return;}
        for(const item of rows){
          const row=document.createElement('section');row.className='pending-member';
          const info=document.createElement('p');
          const roleLabel=item.account_type==='parent'?'학부모'
            :item.account_type==='academy_owner'?'협력학원 원장':'확인 필요';
          info.textContent=[
            roleLabel,
            '아이디: '+(nameForId.get(item.user_id)||'기존 가입 계정'),
            item.account_type==='parent'
              ? '아이: '+((childrenForId.get(item.user_id)||[]).join(', ')||'등록 필요')
              : item.academy_name,
            item.account_type==='academy_owner' ? item.academy_address : ''
          ].filter(Boolean).join(' · ');
          const actions=document.createElement('div');
          actions.className='approval-actions';
          const approveButton=document.createElement('button');
          approveButton.type='button';approveButton.className='approval-accept';
          approveButton.textContent='가입 승인';
          const rejectButton=document.createElement('button');
          rejectButton.type='button';rejectButton.className='approval-reject';
          rejectButton.textContent='가입 반려';
          let processing=false;
          const decide=async(decision)=>{
            if(processing)return;
            if(!['parent','academy_owner'].includes(item.account_type)){
              show('회원 유형을 확인할 수 없습니다. 신청을 처리하지 않았습니다.',true);return;
            }
            const applicant=(item.academy_name||nameForId.get(item.user_id)||'이 회원')+' ('+roleLabel+')';
            const accepted=decision==='approved';
            const question=accepted
              ? applicant+' 가입을 승인하시겠습니까?'
              : applicant+' 가입을 반려하시겠습니까? 반려 시 회원 전용 기능을 사용할 수 없습니다.';
            if(!window.confirm(question))return;
            processing=true;
            approveButton.disabled=true;rejectButton.disabled=true;
            show(accepted?'회원가입 승인을 처리 중입니다.':'회원가입 반려를 처리 중입니다.');
            try{
              const changed=await rest('PATCH','/rest/v1/member_profiles',token,{
                select:'user_id',
                user_id:'eq.'+item.user_id,
                approval_status:'eq.pending',
                account_type:'eq.'+item.account_type
              },{approval_status:decision,updated_at:new Date().toISOString()});
              if(!Array.isArray(changed)||changed.length!==1)
                throw new Error('신청이 이미 처리되었거나 권한이 없습니다. 목록을 다시 확인해주세요.');
              await loadPending();
              show(accepted?'회원가입을 승인했습니다.':'회원가입을 반려했습니다. 해당 계정은 삭제되지 않습니다.');
            }catch(error){
              show((accepted?'승인 실패: ':'반려 실패: ')+error.message,true);
            }finally{
              processing=false;
              approveButton.disabled=false;rejectButton.disabled=false;
            }
          };
          approveButton.addEventListener('click',()=>decide('approved'));
          rejectButton.addEventListener('click',()=>decide('rejected'));
          actions.append(approveButton,rejectButton);
          row.append(info,actions);target.append(row);
        }
      }catch(error){target.textContent='승인 목록 조회 오류: '+error.message;show('가입 승인 목록 조회에 실패했습니다.',true);}
    };
    await loadPending();
  }catch(error){
    show('관리자 화면을 불러오지 못했습니다: '+(error?.message||'알 수 없는 오류')+'. 로그인 화면으로 돌아가 다시 시도해주세요.',true);
  }
})();