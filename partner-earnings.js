'use strict';
(async () => {
  const $=id=>document.getElementById(id);
  const status=$('partner-earnings-status');
  const fmt=won=>Math.round(Number(won)||0).toLocaleString('ko-KR')+'원';
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const part=name=>parts.find(x=>x.type===name)?.value;
  const currentMonth=part('year')+'-'+part('month')+'-01';
  const client=window.supabase?.createClient(
    'https://fyzgwhtqqomsftqbfvjb.supabase.co',
    'sb_publishable_yE-Ao1-apsmTvkdHhqEasg_Oarn7dSw'
  );
  if(!client){status.textContent='추천비 서비스를 불러오지 못했습니다.';return;}
  try{
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user)throw new Error('로그인이 필요합니다.');
    const {data:profile,error:profileError}=await client.from('member_profiles')
      .select('account_type,approval_status').eq('user_id',user.id).maybeSingle();
    if(profileError||profile?.account_type!=='academy_owner'||profile.approval_status!=='approved'){
      status.textContent='관리자 승인 후 정산 내역을 확인할 수 있습니다.';
      return;
    }
    const {data:rows,error:readError}=await client.from('cm_partner_monthly_balances')
      .select('billing_month,earned_won,paid_won')
      .eq('partner_id',user.id).order('billing_month',{ascending:false});
    if(readError)throw readError;
    const current=(rows||[]).find(row=>row.billing_month===currentMonth);
    const allEarned=(rows||[]).reduce((sum,row)=>sum+Number(row.earned_won),0);
    const allPaid=(rows||[]).reduce((sum,row)=>sum+Number(row.paid_won),0);
    $('partner-month-earned').textContent=fmt(current?.earned_won||0);
    $('partner-total-due').textContent=fmt(Math.max(0,allEarned-allPaid));
    $('partner-total-paid').textContent=fmt(allPaid);
    $('partner-earning-month').textContent=part('year')+'년 '+Number(part('month'))+'월';
    status.textContent=(rows||[]).length?'관리자가 확인한 실제 원비 납부·지급 기록 기준입니다.':'아직 입력된 추천비 내역이 없습니다.';
  }catch(error){
    status.textContent='추천비 조회 실패: '+(error?.message||'다시 시도해주세요.');
  }
})();