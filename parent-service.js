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
  const list=$('child-list'),select=$('consult-child'),previous=select.value;
  list.replaceChildren();select.replaceChildren();
  const initial=document.createElement('option');initial.value='';initial.textContent=children.length?'자녀를 선택해주세요':'자녀를 먼저 등록해주세요';select.append(initial);
  if(!children.length)list.append(empty('아직 등록한 자녀가 없습니다.'));
  for(const child of children){
   const row=document.createElement('div');row.className='child-card';
   const name=document.createElement('strong');name.textContent=child.child_name;
   const meta=document.createElement('small');meta.textContent=stageLabel(child);
   row.append(name,meta);list.append(row);
   const option=document.createElement('option');option.value=child.id;option.textContent=child.child_name+' · '+stageLabel(child);select.append(option);
  }
  if(children.some(c=>c.id===previous))select.value=previous;
  else if(children.length===1)select.value=children[0].id;
  $('consult-submit').disabled=!children.length;
 }
 async function loadHistory(){
  const target=$('consult-history');target.replaceChildren();
  const {data,error}=await client.from('parent_consultations').select('id,child_id,question,answer,created_at,answered_at')
   .eq('parent_id',user.id).order('created_at',{ascending:false}).limit(60);
  if(error){target.append(empty('상담 내역을 불러오지 못했습니다.'));return}
  if(!data?.length){target.append(empty('아직 남긴 상담이 없습니다.'));return}
  for(const entry of data){
   const child=children.find(c=>c.id===entry.child_id);
   const card=document.createElement('article');card.className='consult-card';
   const meta=document.createElement('div');meta.className='meta';
   for(const content of [child?.child_name||'등록 자녀',format(entry.created_at),entry.answer?'답변 완료':'답변 대기']){
    const span=document.createElement('span');span.textContent=content;if(content==='답변 완료'||content==='답변 대기')span.className='status';meta.append(span);
   }
   const question=document.createElement('p');question.className='question';question.textContent='Q. '+entry.question;card.append(meta,question);
   if(entry.answer){const answer=document.createElement('div');answer.className='answer';answer.textContent='콘매쓰 답변 · '+(entry.answered_at?format(entry.answered_at):'')+'\n'+entry.answer;card.append(answer)}
   target.append(card);
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
   await loadChildren();mark('child-status','자녀 등록이 완료됐습니다.');
  }catch(error){mark('child-status',String(error.message).includes('child_limit_reached')?'자녀는 최대 6명까지 등록 가능합니다.':'자녀 등록에 실패했습니다. 입력 정보를 확인해주세요.',true)}
  finally{busy(button,false)}
 });
 const question=$('consult-question');
 question.addEventListener('input',()=>{$('question-count').textContent=question.value.length+' / 200자'});
 $('consult-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const child_id=$('consult-child').value,body=question.value.trim(),button=$('consult-submit');
  if(!children.some(child=>child.id===child_id)){mark('consult-status','상담할 자녀를 선택해주세요.',true);return}
  if(body.length<3||body.length>200){mark('consult-status','상담은 3~200자로 적어주세요.',true);return}
  busy(button,true);mark('consult-status','상담을 등록하는 중…');
  try{
   const {error}=await client.from('parent_consultations').insert({parent_id:user.id,child_id,question:body});
   if(error)throw error;
   question.value='';question.dispatchEvent(new Event('input'));
   mark('consult-status','상담이 등록됐습니다. 관리자 답변을 기다려주세요.');await loadHistory();
  }catch(error){
   const raw=String(error?.message||'');
   mark('consult-status',raw.includes('consultation_waiting')?'이전 상담 답변을 기다려주세요.':
    raw.includes('consultation_weekly')?'같은 자녀는 이전 상담 후 7일이 지나야 질문할 수 있습니다.':
    '상담 등록에 실패했습니다. 횟수·로그인 상태를 확인해주세요.',true);
  }finally{busy(button,!children.length)}
 });
 await loadChildren();await loadHistory();
})().catch(()=>{const el=document.getElementById('child-status');if(el)el.textContent='학부모 서비스를 불러오지 못했습니다. 새로고침해주세요.';});