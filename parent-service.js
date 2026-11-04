'use strict';
(async()=>{
 const $=id=>document.getElementById(id);
 if(!$('child-form'))return;
 const client=window.supabase?.createClient('https://fyzgwhtqqomsftqbfvjb.supabase.co','sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw');
 const stageName={elementary:'초등',middle:'중등',high:'고등',other:'학교급 미기재'};
 const mark=(id,text,error=false)=>{const el=$(id);el.textContent=text;el.classList.toggle('is-error',error)};
 const busy=(el,on)=>{el.disabled=on;el.setAttribute('aria-busy',String(on))};
 const format=value=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
 const empty=message=>{const el=document.createElement('div');el.className='empty-state';el.textContent=message;return el};
 if(!client){mark('child-status','데이터 서비스를 불러올 수 없습니다.',true);return}
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)return;
 const {data:profile,error:profileError}=await client.from('member_profiles').select('account_type,approval_status').eq('user_id',user.id).single();
 if(profileError||profile?.account_type!=='parent'||profile.approval_status!=='approved')return;
 let children=[];
 const stageLabel=child=>child.school_stage==='other'?'학교급 미기재':stageName[child.school_stage]+(child.grade?' '+child.grade+'학년':'');
 async function loadChildren(){
  const {data,error}=await client.from('parent_children').select('id,child_name,school_stage,grade,created_at').eq('parent_id',user.id).order('created_at',{ascending:true});
  if(error){mark('child-status','자녀 목록을 불러오지 못했습니다. 새로고침해주세요.',true);return}
  children=data||[];
  const list=$('child-list'),select=$('comment-child-filter'),previous=select.value;
  list.replaceChildren();select.replaceChildren();
  const initial=document.createElement('option');initial.value='';initial.textContent='전체 자녀';select.append(initial);
  if(!children.length)list.append(empty('아직 등록한 자녀가 없습니다.'));
  for(const child of children){
   const row=document.createElement('div');row.className='child-card';
   const name=document.createElement('strong');name.textContent=child.child_name;
   const meta=document.createElement('small');meta.textContent=stageLabel(child);
   row.append(name,meta);list.append(row);
   const option=document.createElement('option');option.value=child.id;option.textContent=child.child_name+' · '+stageLabel(child);select.append(option);
  }
  if(children.some(c=>c.id===previous))select.value=previous;
 }
 async function loadComments(){
  const target=$('comment-history');target.replaceChildren();
  const filter=$('comment-child-filter').value;
  if(filter && !children.some(child=>child.id===filter)){target.append(empty('등록된 자녀를 선택해주세요.'));return}
  let query=client.from('parent_child_comments').select('id,child_id,comment,created_at')
   .eq('parent_id',user.id).order('created_at',{ascending:false}).limit(80);
  if(filter)query=query.eq('child_id',filter);
  const {data,error}=await query;
  if(error){target.append(empty('학습 코멘트를 불러오지 못했습니다. 새로고침해주세요.'));return}
  if(!data?.length){target.append(empty('아직 등록된 학습 코멘트가 없습니다.'));return}
  for(const entry of data){
   const child=children.find(c=>c.id===entry.child_id);
   const card=document.createElement('article');card.className='consult-card';
   const meta=document.createElement('div');meta.className='meta';
   const name=document.createElement('strong');name.textContent=child?.child_name||'등록 자녀';
   const date=document.createElement('span');date.textContent=format(entry.created_at);
   meta.append(name,date);
   const content=document.createElement('div');content.className='answer';content.textContent=entry.comment;
   card.append(meta,content);target.append(card);
  }
 }
 const form=$('child-form'),stage=form.elements.namedItem('school_stage'),grade=form.elements.namedItem('grade');
 stage.addEventListener('change',()=>{
  const max=stage.value==='elementary'?6:stage.value==='other'?0:3;
  for(const option of grade.options)if(option.value)option.disabled=Number(option.value)>max;
  if(!max||Number(grade.value)>max)grade.value='';
  grade.disabled=!max;
 });
 stage.dispatchEvent(new Event('change'));
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(form),name=String(data.get('child_name')||'').trim(),school_stage=String(data.get('school_stage')||'other'),level=String(data.get('grade')||'');
  if(!name||name.length>40){mark('child-status','자녀 이름을 1~40자로 입력해주세요.',true);return}
  if(children.length>=6){mark('child-status','자녀는 최대 6명까지 등록 가능합니다.',true);return}
  const button=form.querySelector('button[type="submit"]');busy(button,true);mark('child-status','자녀 등록 중…');
  try{
   const {error}=await client.from('parent_children').insert({parent_id:user.id,child_name:name,school_stage,grade:level?Number(level):null});
   if(error)throw error;
   form.reset();stage.dispatchEvent(new Event('change'));
   await loadChildren();await loadComments();
   mark('child-status','자녀 등록이 완료됐습니다.');
  }catch(error){mark('child-status',String(error.message).includes('child_limit_reached')?'자녀는 최대 6명까지 등록 가능합니다.':'자녀 등록에 실패했습니다. 입력 정보를 확인해주세요.',true)}
  finally{busy(button,false)}
 });
 $('comment-child-filter').addEventListener('change',loadComments);
 await loadChildren();await loadComments();
})().catch(()=>{const el=document.getElementById('child-status');if(el)el.textContent='학부모 서비스를 불러오지 못했습니다. 새로고침해주세요.';});