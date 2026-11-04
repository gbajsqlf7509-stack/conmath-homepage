'use strict';
(async()=>{
 const root=document.getElementById('admin-consultations');if(!root)return;
 const base='https://fyzgwhtqqomsftqbfvjb.supabase.co',key='sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw';
 const client=window.supabase?.createClient(base,key);if(!client){root.textContent='상담 서비스를 불러오지 못했습니다.';return}
 const saved=JSON.parse(sessionStorage.getItem('conmath_admin_bootstrap_v1')||'null');
 const session=saved?.token&&(!saved.expires_at||saved.expires_at*1000>Date.now())?{access_token:saved.token}:((await client.auth.getSession()).data?.session);
 const token=session?.access_token;
 if(!token){root.textContent='관리자 로그인이 필요합니다.';return}
 const rest=async(method,path,params={},body)=>{
  const url=new URL(base+path);
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  const response=await fetch(url,{method,headers:{apikey:key,Authorization:'Bearer '+token,
   ...(body===undefined?{}:{'Content-Type':'application/json',Prefer:'return=representation'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw new Error('요청 실패 ('+response.status+'). 로그인 권한을 확인해주세요.');
  return response.status===204?[]:response.json();
 };
 const user=await rest('GET','/auth/v1/user');
 if(!user?.id || (saved?.user_id && saved.user_id!==user.id))throw new Error('관리자 세션을 확인할 수 없습니다.');
 const [profiles,badges]=await Promise.all([
  rest('GET','/rest/v1/member_profiles',{select:'account_type',user_id:'eq.'+user.id}),
  rest('GET','/rest/v1/platform_admins',{select:'user_id',user_id:'eq.'+user.id})
 ]);
 if(profiles?.[0]?.account_type!=='admin'||!badges?.[0]?.user_id){root.textContent='관리자 전용 기능입니다.';return}
 const create=(tag,className,value)=>{const el=document.createElement(tag);el.className=className;el.textContent=value;return el};
 const stamp=t=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(t));
 async function load(){
  root.textContent='답변 대기 상담을 불러오는 중…';
  const rows=await rest('GET','/rest/v1/parent_consultations',{select:'id,child_id,question,created_at',answer:'is.null',order:'created_at.asc',limit:50});
  root.replaceChildren();
  if(!rows.length){root.append(create('div','empty-state','현재 답변을 기다리는 상담이 없습니다.'));return}
  const ids=[...new Set(rows.map(row=>row.child_id))];
  const names=ids.length?await rest('GET','/rest/v1/parent_children',{select:'id,child_name',id:'in.('+ids.join(',')+')'}):[];
  const nameMap=new Map(names.map(row=>[row.id,row.child_name]));
  for(const row of rows){
   const card=create('article','consult-card','');
   card.append(create('div','meta',(nameMap.get(row.child_id)||'자녀')+' · '+stamp(row.created_at)));
   card.append(create('p','question','Q. '+row.question));
   const form=create('form','admin-reply',''),label=create('label','','답변 (최대 300자)');
   const textarea=document.createElement('textarea');
   textarea.required=true;textarea.minLength=2;textarea.maxLength=300;textarea.rows=3;
   textarea.placeholder='학습에 도움이 될 짧은 답변을 남겨주세요.';
   label.append(textarea);
   const actions=create('div','actions',''),count=create('span','','0 / 300자'),button=create('button','','답변 등록');
   button.type='submit';textarea.addEventListener('input',()=>count.textContent=textarea.value.length+' / 300자');
   actions.append(count,button);form.append(label,actions);
   const message=create('p','inline-status','');
   form.addEventListener('submit',async event=>{
    event.preventDefault();const answer=textarea.value.trim();if(answer.length<2||answer.length>300)return;
    if(!window.confirm('답변을 한 번 등록하면 수정할 수 없습니다. 등록하시겠습니까?'))return;
    button.disabled=true;message.textContent='답변 등록 중…';
    try{
     const updated=await rest('PATCH','/rest/v1/parent_consultations',
      {select:'id',id:'eq.'+row.id,answer:'is.null'},
      {answer,answered_at:new Date().toISOString(),answered_by:user.id});
     if(updated.length!==1)throw new Error('다른 관리자가 이미 답변했을 수 있습니다.');
     await load();
    }catch(error){message.textContent='답변 등록 실패: '+error.message;button.disabled=false}
   });
   card.append(form,message);root.append(card);
  }
 }
 await load();
})().catch(error=>{const el=document.getElementById('admin-consultations');if(el)el.textContent='상담 목록을 확인하지 못했습니다: '+error.message;});