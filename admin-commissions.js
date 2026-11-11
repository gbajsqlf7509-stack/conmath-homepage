'use strict';
(async () => {
  const $=id=>document.getElementById(id);
  const notice=(message,bad=false)=>{
    const node=$('commission-status');
    if(!node)return;
    node.textContent=message;
    node.classList.toggle('is-error',bad);
  };
  const client=window.supabase?.createClient(
    'https://fyzgwhtqqomsftqbfvjb.supabase.co',
    'sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw'
  );
  if(!client){notice('정산 서비스를 불러오지 못했습니다.',true);return;}
  const format=won=>Math.round(Number(won)||0).toLocaleString('ko-KR')+'원';
  const koDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const today=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=t=>parts.find(p=>p.type===t)?.value;return [get('year'),get('month'),get('day')].join('-');};
  const monthOf=date=>String(date||'').slice(0,7);
  const monthDate=()=>($('commission-month').value||today().slice(0,7))+'-01';
  const must=(result)=>{if(result.error)throw result.error;return result.data||[];};
  const option=(value,label)=>{const o=document.createElement('option');o.value=String(value);o.textContent=label;return o;};
  const refreshSelect=(node,items,placeholder)=>{
    const previous=node.value;
    node.replaceChildren(option('',placeholder));
    for(const item of items)node.append(option(item.value,item.label));
    if(items.some(v=>String(v.value)===previous))node.value=previous;
  };
  let partners=[],courses=[],students=[],referrals=[],payments=[],settlements=[];
  let busy=false;
  const withBusy=async fn=>{
    if(busy)return;busy=true;
    document.querySelectorAll('#commission-admin button[type="submit"]').forEach(el=>el.disabled=true);
    try{await fn();}catch(error){notice(error?.message||'저장 과정에서 오류가 발생했습니다.',true);}
    finally{busy=false;document.querySelectorAll('#commission-admin button[type="submit"]').forEach(el=>el.disabled=false);}
  };
  const partnerName=id=>{
    const p=partners.find(x=>x.user_id===id);
    return p?.academy_name||p?.full_name||'학원 정보 없음';
  };
  const courseName=id=>{
    const c=courses.find(x=>String(x.id)===String(id));
    return c?c.grade+' '+c.course_name:'과정 미선택';
  };
  const refLabel=r=>{
    const s=students.find(x=>x.id===r.student_id);
    return (s?.phone_last4||'????')+' · '+partnerName(r.partner_id)+' · '+String(r.id);
  };
  const commissionsFor=(refId,month)=>{
    const earned=payments.filter(x=>x.referral_id===refId&&x.billing_month===month)
      .reduce((a,p)=>a+Number(p.commission_won||0),0);
    const paid=settlements.filter(x=>x.referral_id===refId&&x.billing_month===month&&x.settlement_kind==='outgoing_paid')
      .reduce((a,s)=>a+Number(s.settled_won||0),0);
    return {earned,paid,due:Math.max(0,earned-paid)};
  };
  const addCell=(row,value)=>{
    const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);return cell;
  };
  function recalcCourse(){
    const ref=referrals.find(r=>String(r.id)===$('commission-payment-student').value);
    const course=courses.find(c=>String(c.id)===String(ref?.default_course_id||''));
    $('commission-payment-course').textContent=course?courseName(course.id)+' · 기준 '+format(course.price_won):'등록된 과정이 없습니다. 납부액을 직접 입력해주세요.';
    const month=monthDate();
    const existing=payments.find(p=>String(p.referral_id)===String(ref?.id)&&p.billing_month===month);
    $('commission-payment-won').value=existing?existing.paid_won:course?.price_won||'';
    $('commission-payment-submit').textContent=existing?'납부액 수정 저장':'원비 납부 기록';
  }
  function recalcDue(){
    const ref=Number($('commission-settlement-student').value);
    const month=monthDate();
    const {earned,paid,due}=commissionsFor(ref,month);
    $('commission-settlement-due').textContent='발생 '+format(earned)+' · 지급 '+format(paid)+' · 미지급 '+format(due);
    $('commission-settlement-won').value=due>0?due:'';
    $('commission-settlement-submit').disabled=due<=0;
  }
  function render(){
    const selectedMonth=monthDate();
    const byMonth=payments.filter(p=>p.billing_month===selectedMonth&&referrals.some(r=>r.id===p.referral_id));
    const earned=byMonth.reduce((sum,p)=>sum+Number(p.commission_won||0),0);
    const paidAll=settlements.filter(x=>x.settlement_kind==='outgoing_paid')
      .reduce((sum,s)=>sum+Number(s.settled_won||0),0);
    const earnedAll=payments.filter(p=>referrals.some(r=>r.id===p.referral_id))
      .reduce((sum,p)=>sum+Number(p.commission_won||0),0);
    $('commission-month-earned').textContent=format(earned);
    $('commission-unpaid').textContent=format(Math.max(0,earnedAll-paidAll));
    $('commission-paid-total').textContent=format(paidAll);
    refreshSelect($('commission-partner'),partners.map(p=>({value:p.user_id,label:partnerName(p.user_id)})),'추천 협력학원 선택');
    refreshSelect($('commission-course'),courses.filter(c=>c.active).map(c=>({
      value:c.id,label:courseName(c.id)+' · '+format(c.price_won)+(c.unit_label==='시간'?' /시간':'')
    })),'수강 과정 선택');
    const refOptions=referrals.map(r=>({value:r.id,label:refLabel(r)+(r.ended_on?' · 퇴원':'' )}));
    refreshSelect($('commission-payment-student'),refOptions,'수납할 학생 선택');
    refreshSelect($('commission-settlement-student'),refOptions,'지급 대상 학생 선택');
    const body=$('commission-students-body');body.replaceChildren();
    for(const r of referrals){
      const tr=document.createElement('tr');
      const s=students.find(x=>x.id===r.student_id);
      addCell(tr,s?.phone_last4||'????');
      addCell(tr,partnerName(r.partner_id));
      addCell(tr,courseName(r.default_course_id));
      addCell(tr,r.ended_on?'퇴원 ('+r.ended_on+')':'재원 중');
      const td=document.createElement('td');
      if(!r.ended_on){
        const button=document.createElement('button');button.type='button';button.className='commission-small';
        button.textContent='퇴원 처리';
        button.addEventListener('click',()=>withBusy(async()=>{
          if(!window.confirm((s?.phone_last4||'해당')+' 학생을 퇴원 처리할까요? 이후 월의 수납을 입력하지 않도록 표시합니다.'))return;
          must(await client.from('cm_student_referrals').update({ended_on:today()}).eq('id',r.id).eq('direction','partner_to_conmath').select('id'));
          await load();notice('퇴원 처리했습니다. 기존 정산 내역은 유지됩니다.');
        }));
        td.append(button);
      }
      tr.append(td);body.append(tr);
    }
    if(!referrals.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.textContent='등록된 추천 학생이 없습니다.';tr.append(td);body.append(tr);}
    const ledger=$('commission-ledger-body');ledger.replaceChildren();
    for(const p of byMonth){
      const r=referrals.find(x=>x.id===p.referral_id);
      const s=students.find(x=>x.id===r.student_id);
      const tr=document.createElement('tr');
      addCell(tr,s?.phone_last4||'????');
      addCell(tr,partnerName(r.partner_id));
      addCell(tr,format(p.paid_won));
      addCell(tr,format(p.commission_won));
      const c=commissionsFor(r.id,selectedMonth);
      addCell(tr,format(c.paid));
      addCell(tr,format(c.due));
      ledger.append(tr);
    }
    if(!byMonth.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=6;td.textContent='선택한 달에 기록된 원비가 없습니다.';tr.append(td);ledger.append(tr);}
    recalcCourse();recalcDue();
  }
  async function load(){
    const [ps,cs,ss,rs,pays,sts]=await Promise.all([
      client.from('member_profiles').select('user_id,full_name,academy_name').eq('account_type','academy_owner').eq('approval_status','approved'),
      client.from('cm_course_prices').select('id,grade,course_name,price_won,unit_label,active').order('id'),
      client.from('cm_students').select('id,phone_last4'),
      client.from('cm_student_referrals').select('id,student_id,partner_id,direction,default_course_id,ended_on').eq('direction','partner_to_conmath').order('id',{ascending:false}),
      client.from('cm_tuition_payments').select('id,referral_id,billing_month,paid_on,paid_won,commission_won'),
      client.from('cm_referral_settlements').select('id,referral_id,billing_month,settlement_kind,settled_on,settled_won').eq('settlement_kind','outgoing_paid')
    ]);
    partners=must(ps);courses=must(cs);students=must(ss);referrals=must(rs);payments=must(pays);settlements=must(sts);
    render();
  }
  try{
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user)throw new Error('관리자 로그인이 필요합니다.');
    const [admin,profile]=await Promise.all([
      client.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle(),
      client.from('member_profiles').select('account_type').eq('user_id',user.id).maybeSingle()
    ]);
    if(admin.error||profile.error||!admin.data||profile.data?.account_type!=='admin')throw new Error('관리자 권한이 없습니다.');
    $('commission-admin').hidden=false;
    $('commission-month').value=today().slice(0,7);
    $('commission-referred-on').value=today();
    $('commission-paid-on').value=today();
    $('commission-settled-on').value=today();
    $('commission-month').addEventListener('change',render);
    $('commission-payment-student').addEventListener('change',recalcCourse);
    $('commission-settlement-student').addEventListener('change',recalcDue);
    $('commission-course').addEventListener('change',()=>{
      const c=courses.find(x=>String(x.id)===$('commission-course').value);
      $('commission-course-help').textContent=c?'기준 원비: '+format(c.price_won)+(c.unit_label==='시간'?' (1시간 단가)':''):'과정을 선택해주세요.';
    });
    $('commission-register-form').addEventListener('submit',e=>{e.preventDefault();withBusy(async()=>{
      const last4=$('commission-last4').value.trim();
      const partnerId=$('commission-partner').value;
      const courseId=Number($('commission-course').value);
      if(!/^\d{4}$/.test(last4)||!partnerId||!courseId)throw new Error('학생 4자리·협력학원·과정을 모두 선택해주세요.');
      const repeated=referrals.some(r=>r.partner_id===partnerId&&!r.ended_on&&students.some(s=>s.id===r.student_id&&s.phone_last4===last4));
      if(repeated&&!window.confirm('이 학원에서 동일한 뒷자리 학생이 이미 재원 중입니다. 다른 학생이 맞다면 등록을 계속하세요.'))return;
      const created=must(await client.from('cm_students').insert({student_name:last4,phone_last4:last4}).select('id'));
      if(created.length!==1)throw new Error('학생 기록 생성에 실패했습니다.');
      const result=await client.from('cm_student_referrals').insert({
        student_id:created[0].id,partner_id:partnerId,direction:'partner_to_conmath',
        default_course_id:courseId,referred_on:$('commission-referred-on').value||today()
      }).select('id');
      if(result.error)throw new Error('추천 연결 실패: '+result.error.message+' (학생 기본 정보는 저장되었으니 중복 등록에 주의해주세요.)');
      $('commission-register-form').reset();
      $('commission-referred-on').value=today();
      await load();notice(last4+' 학생을 추천 학원에 연결했습니다.');
    });});
    $('commission-payment-form').addEventListener('submit',e=>{e.preventDefault();withBusy(async()=>{
      const r=referrals.find(x=>String(x.id)===$('commission-payment-student').value);
      const month=monthDate();
      const paid=Number($('commission-payment-won').value);
      if(!r||!Number.isInteger(paid)||paid<=0)throw new Error('학생과 실제 납부액(1원 이상)을 확인해주세요.');
      if(r.ended_on&&month>monthOf(r.ended_on)+'-01')throw new Error('퇴원 이후 월은 수납 등록할 수 없습니다.');
      const existing=payments.find(p=>p.referral_id===r.id&&p.billing_month===month);
      const alreadyPaid=commissionsFor(r.id,month).paid;
      const commission=Math.round(paid*0.05);
      if(commission<alreadyPaid)throw new Error('새 추천비가 기존 지급액보다 작습니다. 지급 기록을 먼저 확인해주세요.');
      if(existing&&!window.confirm(monthOf(month)+'의 기존 납부액을 '+format(paid)+'으로 수정할까요? 월별 누적 납부액을 입력하세요.'))return;
      const payload={paid_won:paid,paid_on:$('commission-paid-on').value||today(),commission_rate_pct:5};
      if(existing)must(await client.from('cm_tuition_payments').update(payload).eq('id',existing.id).select('id'));
      else must(await client.from('cm_tuition_payments').insert({...payload,student_id:r.student_id,
        referral_id:r.id,billing_month:month}).select('id'));
      await load();notice('원비 수납액과 추천비 5%를 반영했습니다. 실제 송금은 별도로 진행해주세요.');
    });});
    $('commission-settlement-form').addEventListener('submit',e=>{e.preventDefault();withBusy(async()=>{
      const r=referrals.find(x=>String(x.id)===$('commission-settlement-student').value);
      const month=monthDate();
      const amt=Number($('commission-settlement-won').value);
      if(!r||!Number.isInteger(amt)||amt<=0)throw new Error('지급 대상과 금액을 확인해주세요.');
      const due=commissionsFor(r.id,month).due;
      if(amt!==due)throw new Error('현재는 중복 지급 방지를 위해 해당 학생·월의 미지급 추천비 전액만 지급 기록할 수 있습니다.');
      const exists=settlements.find(s=>s.referral_id===r.id&&s.billing_month===month);
      if(exists)throw new Error('이 학생·월의 지급 기록이 이미 있습니다. 중복 지급 방지를 위해 자동 추가하지 않습니다.');
      if(!window.confirm(format(amt)+'을 실제 송금 완료했나요? 송금이 끝난 금액만 기록해주세요.'))return;
      must(await client.from('cm_referral_settlements').insert({
        referral_id:r.id,billing_month:month,settled_on:$('commission-settled-on').value||today(),
        settled_won:amt,settlement_kind:'outgoing_paid'
      }).select('id'));
      await load();notice('송금 완료 기록을 저장했습니다.');
    });});
    await load();
    notice('정산 데이터를 불러왔습니다. 학생 실명 없이 전화번호 뒷자리 4자리만 등록합니다.');
  }catch(error){
    notice('정산 화면을 열 수 없습니다: '+(error?.message||'알 수 없는 오류'),true);
  }
})();