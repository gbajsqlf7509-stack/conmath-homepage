'use strict';
(async()=>{
  const $=id=>document.getElementById(id);
  const panel=$('member-admin');
  if(!panel)return;
  const status=$('member-admin-status');
  const say=(message,bad=false)=>{
    status.textContent=message;
    status.classList.toggle('is-error',bad);
  };
  const projectUrl='https://fyzgwhtqqomsftqbfvjb.supabase.co';
  const publishableKey='sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw';
  const client=window.supabase?.createClient(projectUrl,publishableKey);
  if(!client){say('회원관리 연결에 실패했습니다.',true);return;}
  let busy=false;
  const button=(label,click)=>{
    const node=document.createElement('button');
    node.type='button';node.textContent=label;node.addEventListener('click',click);
    return node;
  };
  const generatePassword=()=>{
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes=crypto.getRandomValues(new Uint8Array(24));
    return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
  };
  async function load(){
    const [{data:members,error:memberError},{data:accounts,error:bankError}]=await Promise.all([
      client.from('member_profiles')
        .select('user_id,username,email,full_name,academy_name,account_type,approval_status,created_at')
        .in('account_type',['parent','academy_owner'])
        .in('approval_status',['pending','approved']).order('created_at',{ascending:false}),
      client.from('member_payout_accounts').select('user_id,account_details')
    ]);
    if(memberError||bankError)throw memberError||bankError;
    const byId=new Map((accounts||[]).map(x=>[x.user_id,x.account_details]));
    const target=$('all-members');target.replaceChildren();
    for(const member of (members||[]).filter(m=>m.approval_status==='pending'||m.approval_status==='approved')){
      const item=document.createElement('article');
      item.className='account-admin-row';
      const header=document.createElement('div');header.className='account-admin-main';
      const identity=document.createElement('strong');
      identity.textContent=member.full_name+(member.account_type==='academy_owner'?' (학원장)':' (학부모)');
      const meta=document.createElement('span');meta.className='account-admin-meta';
      meta.textContent='아이디: '+(member.username||member.email||'미등록')
        +' · '+({'pending':'승인 대기','approved':'승인','rejected':'반려','active':'활성'}[member.approval_status]||member.approval_status);
      header.append(identity,meta);
      const bankLine=document.createElement('div');bankLine.className='account-admin-account';
      const showBank=()=>{
        const bank=byId.get(member.user_id);
        bankLine.textContent='정산 계좌: '+(bank||'미등록')
          +(member.account_type==='parent'&&!bank?' (추천비 미신청)':'');
      };
      showBank();
      const actions=document.createElement('div');actions.className='account-admin-actions';
      const changeBank=button('계좌 입력·수정',async()=>{
        if(busy)return;
        const previous=byId.get(member.user_id)||'';
        const next=window.prompt(member.full_name+'의 계좌정보를 입력하세요 (은행명 + 계좌번호)',previous);
        if(next===null)return;
        const value=next.trim();
        if(value.length<8||value.length>100){say('은행명과 계좌번호를 함께 입력해주세요 (8~100자).',true);return;}
        busy=true;changeBank.disabled=true;
        try{
          const {error}=await client.from('member_payout_accounts').upsert({
            user_id:member.user_id,account_details:value,updated_at:new Date().toISOString()
          },{onConflict:'user_id'});
          if(error)throw error;
          byId.set(member.user_id,value);showBank();
          say('계좌정보를 저장했습니다. 송금 전 계좌명의 일치 여부를 확인하세요.');
        }catch(error){say('계좌정보 저장 실패: '+error.message,true);}
        finally{busy=false;changeBank.disabled=false;}
      });
      if(member.account_type==='academy_owner'){
        const academyBtn=button('학원명 지정',async()=>{
          if(busy)return;
          const next=window.prompt('정산 목록에 표시할 학원명을 입력해주세요.',member.academy_name||'');
          if(next===null)return;
          const name=next.trim();
          if(!name||name.length>120){say('학원명은 1~120자로 입력해주세요.',true);return;}
          busy=true;academyBtn.disabled=true;
          try{
            const {error}=await client.from('member_profiles').update({
              academy_name:name,updated_at:new Date().toISOString()
            }).eq('user_id',member.user_id).eq('account_type','academy_owner');
            if(error)throw error;
            member.academy_name=name;
            say('학원명을 변경했습니다. 정산 페이지를 새로고침하면 반영됩니다.');
          }catch(error){say('학원명 수정 실패: '+error.message,true);}
          finally{busy=false;academyBtn.disabled=false;}
        });
        actions.append(academyBtn);
      }
      const reset=button('임시 비밀번호 재발급',async()=>{
        if(busy)return;
        if(!window.confirm(member.full_name+' 회원의 비밀번호를 새로운 임시 비밀번호로 변경할까요? 기존 비밀번호는 더 이상 사용할 수 없습니다.'))return;
        busy=true;reset.disabled=true;
        try{
          const temporaryPassword=generatePassword();
          const {data:{session},error:sessionError}=await client.auth.getSession();
          if(sessionError||!session?.access_token)throw new Error('관리자 로그인이 필요합니다.');
          const response=await fetch(projectUrl+'/functions/v1/admin-reset-member-password',{
            method:'POST',
            headers:{'Content-Type':'application/json',apikey:publishableKey,Authorization:'Bearer '+session.access_token},
            body:JSON.stringify({user_id:member.user_id,temporary_password:temporaryPassword})
          });
          const data=await response.json().catch(()=>({}));
          if(!response.ok||!data.ok)throw new Error(data.error||'비밀번호 변경이 완료되지 않았습니다.');
          item.querySelector('.account-admin-secret')?.remove();
          const secret=document.createElement('div');secret.className='account-admin-secret';
          const title=document.createElement('div');
          title.textContent='임시 비밀번호 (이번 화면에서만 확인 가능, 별도 저장하지 않음)';
          const text=document.createElement('code');text.textContent=temporaryPassword;
          const copy=button('임시 비밀번호 복사',async()=>{
            try{await navigator.clipboard.writeText(temporaryPassword);say('임시 비밀번호를 복사했습니다. 회원에게 안전하게 전달해주세요.');}
            catch(_){say('자동 복사를 할 수 없습니다. 화면에 표시된 비밀번호를 직접 복사해주세요.',true);}
          });
          const close=button('확인 후 가리기',()=>secret.remove());
          secret.append(title,text,copy,close);item.append(secret);
          say('회원의 임시 비밀번호를 새로 발급했습니다. 기존 비밀번호는 조회·보관하지 않습니다.');
        }catch(error){say('비밀번호 재발급 실패: '+error.message,true);}
        finally{busy=false;reset.disabled=false;}
      });
      actions.append(changeBank,reset);
      item.append(header,bankLine,actions);target.append(item);
    }
    if(!(members||[]).some(m=>m.approval_status==='pending'||m.approval_status==='approved'))target.textContent='현재 표시할 승인 대기·승인 완료 회원이 없습니다.';
  }
  try{
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user)throw new Error('관리자 로그인이 필요합니다.');
    const [badge,profile]=await Promise.all([
      client.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle(),
      client.from('member_profiles').select('account_type').eq('user_id',user.id).maybeSingle()
    ]);
    if(badge.error||profile.error||!badge.data||profile.data?.account_type!=='admin')
      throw new Error('관리자 권한이 없습니다.');
    panel.hidden=false;
    await load();
    say('회원 아이디 및 계좌정보를 조회했습니다. 기존 비밀번호 원문은 열람할 수 없습니다.');
  }catch(error){say('회원관리 화면 오류: '+(error?.message||'알 수 없는 오류'),true);}
})();