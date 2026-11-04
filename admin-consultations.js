'use strict';
(async()=>{
 const root=document.getElementById('admin-comment-history');if(!root)return;
 const base='https://fyzgwhtqqomsftqbfvjb.supabase.co',key='sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw';
 const client=window.supabase?.createClient(base,key);if(!client){root.textContent='코멘트 서비스를 불러오지 못했습니다.';return}
 const saved=JSON.parse(sessionStorage.getItem('conmath_admin_bootstrap_v1')||'null');
 const session=saved?.token&&(!saved.expires_at||saved.expires_at*1000>Date.now())?{access_token:saved.token}:((await client.auth.getSession()).data?.session);
 const token=session?.access_token;
 if(!token){root.textContent='관리자 로그인이 필요합니다.';return}
 const rest=async(method,path,params={},body)=>{
  const url=new URL(base+path);
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  const response=await fetch(url,{method,headers:{apikey:key,Authorization:'Bearer '+token,Accept:'application/json',
   ...(body===undefined?{}:{'Content-Type':'application/json','Prefer':'return=representation'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw new Error('요청 실패 ('+response.status+'). 관리자 로그인 및 접근 권한을 확인해주세요.');
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
 const childSelect=document.getElementById('admin-comment-child');
 const form=document.getElementById('admin-comment-form');
 const textarea=document.getElementById('admin-comment-text');
 const submit=document.getElementById('admin-comment-submit');
 const status=document.getElementById('admin-comment-status');
 const show=text=>status.textContent=text;
 let children=[];
 async function loadChildren(){
  const rows=await rest('GET','/rest/v1/parent_children',{select:'id,parent_id,child_name,school_stage,grade',order:'created_at.desc',limit:300});
  children=rows;
  childSelect.replaceChildren();
  const defaultOption=document.createElement('option');defaultOption.value='';defaultOption.textContent='등록 자녀를 선택해주세요';childSelect.append(defaultOption);
  if(!rows.length){root.textContent='등록된 자녀가 없습니다. 학부모가 자녀를 등록하면 작성할 수 있습니다.';submit.disabled=true;return}
  const parentIds=[...new Set(rows.map(row=>row.parent_id))];
  const names=parentIds.length?await rest('GET','/rest/v1/member_profiles',{select:'user_id,full_name',user_id:'in.('+parentIds.join(',')+')'}):[];
  const parentMap=new Map(names.map(item=>[item.user_id,item.full_name]));
  for(const row of rows){
   const option=document.createElement('option');option.value=row.id;
   option.textContent=(parentMap.get(row.parent_id)||'학부모')+' / '+row.child_name+
    (row.school_stage==='middle'?' (중등)':row.school_stage==='high'?' (고등)':row.school_stage==='elementary'?' (초등)':'');
   childSelect.append(option);
  }
  submit.disabled=false;
 }
 async function loadNotes(){
  root.replaceChildren();
  const childId=childSelect.value;
  if(!childId){root.append(create('div','empty-state','위에서 자녀를 선택하면 코멘트 내역을 확인할 수 있습니다.'));return}
  if(!children.some(row=>row.id===childId)){root.append(create('div','empty-state','등록된 자녀를 선택해주세요.'));return}
  const rows=await rest('GET','/rest/v1/parent_child_comments',{select:'id,comment,created_at',child_id:'eq.'+childId,order:'created_at.desc',limit:30});
  if(!rows.length){root.append(create('div','empty-state','아직 작성된 코멘트가 없습니다.'));return}
  for(const row of rows){
   const card=create('article','consult-card','');
   card.append(create('div','meta',stamp(row.created_at)));
   card.append(create('div','answer',row.comment));
   root.append(card);
  }
 }
 childSelect.addEventListener('change',()=>loadNotes().catch(error=>show('코멘트 조회 실패: '+error.message)));
 textarea.addEventListener('input',()=>document.getElementById('admin-comment-count').textContent=textarea.value.length+' / 300자');
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const child=children.find(row=>row.id===childSelect.value);
  const comment=textarea.value.trim();
  if(!child){show('등록된 자녀를 선택해주세요.');return}
  if(comment.length<2||comment.length>300){show('코멘트는 2~300자로 작성해주세요.');return}
  if(!window.confirm('작성한 학습 코멘트를 해당 학부모에게 공개하시겠습니까?'))return;
  submit.disabled=true;show('코멘트 등록 중…');
  try{
   const saved=await rest('POST','/rest/v1/parent_child_comments',{},
    {parent_id:child.parent_id,child_id:child.id,author_id:user.id,comment});
   if(!Array.isArray(saved)||saved.length!==1)throw new Error('등록 결과를 확인하지 못했습니다.');
   textarea.value='';textarea.dispatchEvent(new Event('input'));
   show('학습 코멘트가 등록됐습니다. 학부모 화면에 표시됩니다.');
   await loadNotes();
  }catch(error){show('코멘트 등록 실패: '+error.message)}
  finally{submit.disabled=false}
 });
 await loadChildren();await loadNotes();
})().catch(error=>{const el=document.getElementById('admin-comment-history');if(el)el.textContent='코멘트 기능을 불러오지 못했습니다: '+error.message;});