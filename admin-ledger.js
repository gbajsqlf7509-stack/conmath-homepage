'use strict';
(async function () {
 const $=id=>document.getElementById(id);
 const status=$('ledger-status'),app=$('ledger-app');
 const money=n=>Number(n||0).toLocaleString('ko-KR')+'원';
 const monthDate=str=>/^\d{4}-\d{2}$/.test(str)?str+'-01':null;
 const monthDisplay=str=>String(str||'').slice(0,7);
 const today=new Date();
 const currentMonth=today.toISOString().slice(0,7);
 const todayText=today.toISOString().slice(0,10);
 let client;
 try {client=window.supabase.createClient('https://fyzgwhtqqomsftqbfvjb.supabase.co','sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw')} 
 catch(e) {status.textContent='인증 서비스를 불러오지 못했습니다.';return;}
 const db={
  courses:[],families:[],students:[],enrollments:[],summary:[],
  referrals:[],payments:[],settlements:[],rates:[],members:[]
 };
 const state={tab:'prices',table:null};
 const msg=(s,isError=false)=>{
  status.textContent=s;
  status.style.borderColor=isError?'#e6aaaa':'#cbdff4';
  status.style.color=isError?'#ac263d':'#174d83';
 };
 const guarded=async()=> {
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user){location.replace('admin-login.html');return false;}
  const {data:p,error:pe}=await client.from('member_profiles').select('full_name,account_type').eq('user_id',user.id).single();
  const {data:a,error:ae}=await client.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(pe||ae||p?.account_type!=='admin'||!a){msg('이 페이지는 관리자 전용입니다. 다른 계정은 접근할 수 없습니다.',true);return false;}
  $('ledger-greeting').textContent=p.full_name+' 관리자님';
  return true;
 };
 if(!await guarded())return;
 app.hidden=false;
 const firstError=async (q,label)=>{
  const result=await q;
  if(result.error)throw new Error(label+': '+result.error.message);
  return result.data||[];
 };
 const getData=async()=>{
  const results=await Promise.all([
   firstError(client.from('cm_course_prices').select('*').order('id'),'과정금액표'),
   firstError(client.from('cm_families').select('*').order('id'),'가족'),
   firstError(client.from('cm_students').select('*').order('created_at',{ascending:false}),'학생'),
   firstError(client.from('cm_monthly_courses').select('*').order('id',{ascending:false}),'월별수강'),
   firstError(client.from('cm_monthly_tuition_summary').select('*'),'가족정산'),
   firstError(client.from('cm_student_referrals').select('*').order('id',{ascending:false}),'추천'),
   firstError(client.from('cm_tuition_payments').select('*').order('id',{ascending:false}),'실납부'),
   firstError(client.from('cm_referral_settlements').select('*').order('id',{ascending:false}),'지급내역'),
   firstError(client.from('partner_referral_direction_rates').select('*').order('effective_at',{ascending:false}),'추천요율'),
   firstError(client.from('member_profiles').select('user_id,account_type,approval_status,full_name,academy_name'),'협력학원')
  ]);
  ['courses','families','students','enrollments','summary','referrals','payments','settlements','rates','members']
   .forEach((key,i)=>db[key]=results[i]);
 };
 const byId=(key,id)=>db[key].find(x=>String(x.id??x.user_id)===String(id));
 const student=x=>{
   const p=byId('students',x);
   return p?p.student_name+'('+p.phone_last4+')':'미확인 학생';
 };
 const family=x=> x?byId('families',x)?.family_label||'미확인 가족':'없음';
 const course=x=>{const v=byId('courses',x);return v?v.grade+' '+v.course_name:'미확인 과정'};
 const partner=x=>{const p=byId('members',x);return p?(p.academy_name||p.full_name):'미확인 학원'};
 const direction=x=>x==='partner_to_conmath'?'협력학원 → 콘매쓰':'콘매쓰 → 협력학원';
 const rateFor=(which,onDate)=>{
  const d=String(onDate||todayText).slice(0,10);
  const item=db.rates.find(x=>x.direction===which&&x.effective_at?.slice(0,10)<=d);
  return item?Number(item.rate_pct):null;
 };
 function node(tag,text,cls){
  const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;
 }
 function makeTable(id,heads,rows){
  const holder=$(id);holder.replaceChildren();const t=node('table',undefined,'ledger-table');
  const h=node('thead'),head=node('tr');
  for(const x of heads)head.append(node('th',x));
  h.append(head);t.append(h);
  const body=node('tbody');
  if(!rows.length){const tr=node('tr'),td=node('td','등록된 내역이 없습니다.');td.colSpan=heads.length;tr.append(td);body.append(tr);}
  for(const cells of rows){
   const row=node('tr');
   for(const val of cells){
    const cell=node('td');
    if(val instanceof Node)cell.append(val);else cell.textContent=String(val??'');
    row.append(cell);
   }body.append(row);
  }
  t.append(body);holder.append(t);
  if(id==='table-'+state.tab || (state.tab==='courses'&&id==='table-summary') || (state.tab==='settlements'&&id==='table-commission'))state.table=t;
 }
 function selectChoices(selector,list,placeholder){
  for(const el of document.querySelectorAll(selector)){
   const old=el.value;el.replaceChildren(node('option',placeholder));
   el.firstChild.value='';
   for(const [value,label] of list){
    const option=node('option',label);option.value=String(value);el.append(option);
   }
   if([...el.options].some(o=>o.value===old))el.value=old;
  }
 }
 function textInput(value,width=120){const i=document.createElement('input');i.value=String(value??'');i.style.width=width+'px';return i;}
 function dropdown(options,current){
  const sel=node('select');for(const [id,label]of options){
   const opt=node('option',label);opt.value=String(id);sel.append(opt);
  }sel.value=String(current??'');return sel;
 }
 function action(label,fn){
  const btn=node('button',label,'save-cell');btn.type='button';
  btn.onclick=async()=>{
   btn.disabled=true;
   try{await fn();msg('저장 완료');await reload();}
   catch(e){msg(e.message,true);}finally{btn.disabled=false;}
  };return btn;
 }
 const update=(table,fields,id)=>client.from(table).update(fields).eq('id',id).then(({error})=>{if(error)throw error;});
 function renderPrices(){
  makeTable('table-prices',['구분','과정','단위','가격(원)','수정'],db.courses.map(c=>{
   const input=textInput(c.price_won);input.type='number';input.min='0';input.step='1';
   return [c.grade,c.course_name,c.unit_label,input,action('저장',async()=>{
    const value=Number(input.value);
    if(!Number.isSafeInteger(value)||value<0)throw new Error('0원 이상의 정수 금액을 입력하세요.');
    await update('cm_course_prices',{price_won:value},c.id);
   })];
  }));
 }
 function renderFamilies(){
  makeTable('table-families',['가족번호','가족 그룹','메모','등록일'],
   db.families.map(f=>[f.id,f.family_label,f.notes,String(f.created_at).slice(0,10)]));
 }
 function renderStudents(){
  const families=[['','없음'],...db.families.map(f=>[f.id,f.family_label])];
  makeTable('table-students',['학생','가족 그룹','등록일','수정'],db.students.map(s=>{
   const sel=dropdown(families,s.family_id);
   return [student(s.id),sel,String(s.created_at).slice(0,10),action('가족 변경',()=>update('cm_students',{family_id:sel.value||null},s.id))];
  }));
 }
 function renderCourses(){
  const m=$('summary-month').value;
  const lines=db.summary.filter(s=>!m||monthDisplay(s.billing_month)===m);
  makeTable('table-summary',['학생','월','본인 과정수','가족 총 과정수','할인율','정가 합계','할인액','할인 후 원비'],
   lines.map(x=>[student(x.student_id),monthDisplay(x.billing_month),x.own_units,x.family_units,
    x.discount_pct+'%',money(x.sticker_won),
    money(Number(x.sticker_won)-Number(x.discounted_due_won)),money(x.discounted_due_won)]));
  makeTable('table-courses',['학생','월','과정','수량','수강 단가','변경'],db.enrollments.map(e=>{
   const inp=textInput(e.units,72);inp.type='number';inp.min='1';inp.max='100';
   return [student(e.student_id),monthDisplay(e.billing_month),course(e.course_id),inp,
    money(e.unit_price_won),action('수량 수정',async()=>{
     const units=Number(inp.value);if(!Number.isSafeInteger(units)||units<1||units>100)throw new Error('수량은 1~100 정수');
     await update('cm_monthly_courses',{units},e.id);
    })];
  }));
 }
 function renderReferrals(){
  makeTable('table-referrals',['번호','학생','협력학원','추천 방향','추천일','요율(현재)'],
   db.referrals.map(r=>[r.id,student(r.student_id),partner(r.partner_id),direction(r.direction),r.referred_on,
   (rateFor(r.direction,r.referred_on)??'확인 필요')+'%']));
 }
 function renderPayments(){
  makeTable('table-payments',['납부일','정산월','학생','추천 방향','원비 실납부액','발생 수수료(예상)'],
   db.payments.map(p=>{
    const r=byId('referrals',p.referral_id);
    const rate=r?rateFor(r.direction,p.paid_on):null;
    return [p.paid_on,monthDisplay(p.billing_month),r?student(r.student_id):'미확인',r?direction(r.direction):'미확인',
     money(p.paid_won),rate===null?'요율 미확정':money(Math.round(Number(p.paid_won)*rate/100))];
   }));
 }
 function renderSettlements(){
  const groups=new Map();
  for(const payment of db.payments){
   const referral=byId('referrals',payment.referral_id);if(!referral)continue;
   const key=referral.id+'|'+payment.billing_month;
   const rate=rateFor(referral.direction,payment.paid_on);
   const record=groups.get(key)||{r:referral,month:payment.billing_month,received:0,accrued:0,settled:0,unknown:false};
   record.received+=Number(payment.paid_won);
   if(rate===null)record.unknown=true;else record.accrued+=Math.round(Number(payment.paid_won)*rate/100);
   groups.set(key,record);
  }
  for(const p of db.settlements){
   const r=byId('referrals',p.referral_id);if(!r)continue;
   const key=r.id+'|'+p.billing_month;
   const record=groups.get(key)||{r,month:p.billing_month,received:0,accrued:0,settled:0,unknown:false};
   record.settled+=Number(p.settled_won);groups.set(key,record);
  }
  const values=[...groups.values()].sort((a,b)=>String(b.month).localeCompare(String(a.month)));
  makeTable('table-commission',['학생','협력학원','월','방향','실제 원비','발생 수수료','실제 지급·수령','차액'],
   values.map(x=>[student(x.r.student_id),partner(x.r.partner_id),monthDisplay(x.month),
    x.r.direction==='partner_to_conmath'?'콘매쓰 지급 5%':'콘매쓰 수령 10%',
    money(x.received),x.unknown?'요율 미확정':money(x.accrued),
    money(x.settled),x.unknown?'—':money(x.accrued-x.settled)]));
  makeTable('table-settlements',['일자','정산월','추천 학생','구분','금액'],
   db.settlements.map(s=>{
    const r=byId('referrals',s.referral_id);
    return [s.settled_on,monthDisplay(s.billing_month),r?student(r.student_id):'미확인',
     s.settlement_kind==='outgoing_paid'?'지급 완료':'수령 완료',money(s.settled_won)];
   }));
 }
 function refreshSelects(){
  selectChoices('[data-families]',db.families.map(f=>[f.id,f.family_label]),'가족 없음');
  selectChoices('[data-students]',db.students.map(s=>[s.id,student(s.id)]),'학생 선택');
  selectChoices('[data-courses]',db.courses.filter(c=>c.active).map(c=>[c.id,course(c.id)+' · '+money(c.price_won)]),'과정 선택');
  selectChoices('[data-partners]',db.members.filter(m=>m.account_type==='academy_owner'&&m.approval_status==='approved')
   .map(m=>[m.user_id,m.academy_name||m.full_name]),'승인된 협력학원 선택');
  selectChoices('[data-referrals]',db.referrals.map(r=>[r.id,student(r.student_id)+' · '+partner(r.partner_id)+' · '+direction(r.direction)]),'추천 내역 선택');
 }
 function render(){
  refreshSelects();
  renderPrices();renderFamilies();renderStudents();renderCourses();renderReferrals();renderPayments();renderSettlements();
  $('metric-students').textContent=db.students.length+'명';
  $('metric-due').textContent=money(db.summary.filter(x=>monthDisplay(x.billing_month)===currentMonth)
    .reduce((sum,x)=>sum+Number(x.discounted_due_won),0));
  $('metric-payments').textContent=money(db.payments.reduce((sum,x)=>sum+Number(x.paid_won),0));
  const tableId=state.tab==='courses'?'table-summary':state.tab==='settlements'?'table-commission':'table-'+state.tab;
  state.table=$(tableId)?.querySelector('table')||null;
 }
 async function reload(){await getData();render();}
 const wireForm=(id,makePayload,table)=>{
  const form=$(id);
  form.addEventListener('submit',async e=>{
   e.preventDefault();const button=form.querySelector('button');
   button.disabled=true;
   try {
    const data=new FormData(form);
    const payload=await makePayload(data);
    if(!payload) return;
    const {error}=await client.from(table).insert(payload);
    if(error)throw error;
    const defaults={billing_month:currentMonth,paid_on:todayText,referred_on:todayText,settled_on:todayText};
    form.reset();
    for(const [name,value]of Object.entries(defaults))if(form.elements[name])form.elements[name].value=value;
    msg('저장 완료');await reload();
   }catch(error){msg('저장 실패: '+error.message,true)}
   finally{button.disabled=false}
  });
 };
 wireForm('form-family',d=>({family_label:String(d.get('family_label')).trim(),notes:String(d.get('notes')||'').trim()}),'cm_families');
 wireForm('form-student',d=>({student_name:String(d.get('student_name')).trim(),phone_last4:String(d.get('phone_last4')).trim(),family_id:d.get('family_id')||null}),'cm_students');
 wireForm('form-course',async d=>{
  const course=byId('courses',d.get('course_id'));
  const month=monthDate(String(d.get('billing_month')||''));
  const units=Number(d.get('units'));
  if(!course||!month||!Number.isSafeInteger(units)||units<1)throw new Error('수강 정보를 확인해주세요.');
  const existing=db.enrollments.find(x=>String(x.course_id)===String(course.id)&&x.student_id===d.get('student_id')&&x.billing_month===month);
  if(existing){await update('cm_monthly_courses',{units:existing.units+units},existing.id);return null;}
  return {student_id:d.get('student_id'),course_id:course.id,billing_month:month,units,unit_price_won:course.price_won};
 },'cm_monthly_courses');
 wireForm('form-referral',d=>({
  student_id:d.get('student_id'),partner_id:d.get('partner_id'),direction:d.get('direction'),
  referred_on:d.get('referred_on'),notes:''
 }),'cm_student_referrals');
 wireForm('form-payment',d=>{
  const value=Number(d.get('paid_won'));if(!Number.isSafeInteger(value)||value<=0)throw new Error('입금액을 확인해주세요.');
  return {referral_id:Number(d.get('referral_id')),billing_month:monthDate(String(d.get('billing_month'))),
    paid_on:String(d.get('paid_on')),paid_won:value};
 },'cm_tuition_payments');
 wireForm('form-settlement',d=>{
  const r=byId('referrals',d.get('referral_id'));
  const value=Number(d.get('settled_won'));
  if(!r||!Number.isSafeInteger(value)||value<=0)throw new Error('추천 내역과 정산금액을 확인해주세요.');
  return {referral_id:r.id,billing_month:monthDate(String(d.get('billing_month'))),
   settled_on:String(d.get('settled_on')),settled_won:value,
   settlement_kind:r.direction==='partner_to_conmath'?'outgoing_paid':'incoming_received'};
 },'cm_referral_settlements');
 for(const form of document.querySelectorAll('form')){
  for(const el of form.querySelectorAll('[type=month]'))el.value=currentMonth;
  for(const el of form.querySelectorAll('[type=date]'))el.value=todayText;
 }
 $('summary-month').value=currentMonth;
 $('summary-month').addEventListener('change',()=>renderCourses());
 for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>{
  state.tab=button.dataset.tab;
  for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b===button));
  for(const p of document.querySelectorAll('.ledger-panel'))p.classList.toggle('active',p.id==='panel-'+state.tab);
  render();
 });
 $('ledger-export').addEventListener('click',()=>{
  const table=state.table;
  if(!table){msg('저장할 표가 없습니다.',true);return;}
  const csv=[...table.querySelectorAll('tr')].map(row=>[...row.children].map(cell=>{
   const value=(cell.querySelector('input,select')?.value??cell.textContent??'').trim();
   const safe=/^[=+@\-]/.test(value)?"'"+value:value;
   return '"'+safe.replace(/"/g,'""')+'"';
  }).join(',')).join('\r\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const anchor=document.createElement('a'),url=URL.createObjectURL(blob);
  anchor.href=url;anchor.download='CON_MATH_'+state.tab+'_'+todayText+'.csv';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 try{await reload();msg('관리자 전용 데이터가 연결되었습니다. 실제 학생 등록 전 개인정보 처리 안내 및 접근 권한을 확인하세요.');}
 catch(e){msg('목록 조회 실패: '+e.message,true);}
})();
