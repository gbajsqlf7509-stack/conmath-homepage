'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../member-auth.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

class Element{
  constructor(){this.hidden=false;this.value='';this.textContent='';this.dataset={};this.handlers={};
    this.classList={toggle(){}};}
  addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
  async dispatchEvent(event){for(const fn of this.handlers[event.type]??[])await fn({
    target:this,preventDefault(){}});
  }
  querySelector(selector){return selector==='.account-submit'?this.submit:
    selector==='.account-close'?this.closeBtn:null;}
  setAttribute(name,val){this[name]=val;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  reset(){}
}
class FakeFormData extends Map {
  constructor(form){super(Object.entries(form.fields??{}));}
}
async function simulate({
  mode='signup',kind='parent',username='happyparent',fullName='테스트 회원',
  bank='',unavailable=false,legacyEmail=false,approve='approved'
}={}){
  const ids=['account-dialog','account-form','signup-only','account-status',
    'member-panel','account-switch','account-type','account-title','account-consent',
    'member-message','account-dashboard-link','member-signout','admin-login-link',
    'login-id','login-id-label','account-bank','payout-guide'];
  const els=Object.fromEntries(ids.map(id=>[id,new Element()]));
  const form=els['account-form'];
  form.submit=new Element();
  form.elements={namedItem:()=>({autocomplete:''})};
  const details=bank||(kind==='academy_owner'?'국민은행 123456789123':'');
  form.fields={
    account_type:kind,full_name:fullName,login_id:legacyEmail?'legacy@example.net':username,
    password:'long-secure-password',account_details:details
  };
  els['account-dialog'].closeBtn=new Element();
  els['account-type'].value=kind;
  els['account-consent'].checked=true;
  const loginButton=new Element(),joinButton=new Element();
  loginButton.dataset.account='login';joinButton.dataset.account='signup';
  const doc={
    getElementById:id=>els[id],
    querySelectorAll:selector=>selector==='[data-account]'?[loginButton,joinButton]:
      selector==='[data-account="login"]'?[loginButton]:[]
  };
  let submitted=null,route=null,payout=null,loginEmail=null;
  const user={id:'simulated-session-user'};
  const client={
    auth:{
      getUser:async()=>({data:{user:null}}),
      getSession:async()=>({data:{session:null}}),
      onAuthStateChange:()=>{},
      signUp:async payload=>{submitted=payload;return {
        data:{user,session:{access_token:'mock'}},error:null};},
      signInWithPassword:async payload=>{loginEmail=payload.email;return {data:{user},error:null};},
      signOut:async()=>({error:null})
    },
    from:table=>{
      if(table==='member_payout_accounts')return {
        upsert:async payload=>{payout=payload;return {error:null};}
      };
      return {
        select(){return this;},eq(){return this;},
        single:async()=>({data:{account_type:kind,full_name:'테스트 회원',
          approval_status:approve},error:null})
      };
    }
  };
  const window={
    supabase:unavailable?null:{createClient:()=>client},
    location:{assign:path=>route=path},alert:()=>{}
  };
  vm.runInNewContext(source,{window,document:doc,FormData:FakeFormData});
  await (mode==='login'?loginButton:joinButton).dispatchEvent({type:'click'});
  if(!unavailable)await form.dispatchEvent({type:'submit'});
  return {submitted,route,payout,loginEmail,status:els['account-status'].textContent,
    formHidden:form.hidden,bankRequired:els['account-bank'].required,
    adminLinkVisible:!els['admin-login-link'].hidden};
}

test('새 회원가입 화면은 이름·아이디·비번·계좌를 사용하고 이메일을 요구하지 않는다',()=>{
  assert.match(page,/name="login_id"/);
  assert.match(page,/name="account_details"/);
  assert.doesNotMatch(page,/name="email" type="email"/);
  assert.match(page,/추천비를 받으실 분만/);
});
test('학부모는 아이디 회원가입 후 관리자 승인 대상으로 등록된다',async()=>{
  const x=await simulate();
  assert.equal(x.submitted.email,'happyparent@fyzgwhtqqomsftqbfvjb.supabase.co');
  assert.equal(x.submitted.options.data.username,'happyparent');
  assert.equal(x.submitted.options.data.account_type,'parent');
  assert.match(x.status,/관리자 승인/);
  assert.equal(x.payout,null);
});
test('학원장은 은행명과 계좌를 별도 보호 테이블에 저장한다',async()=>{
  const x=await simulate({kind:'academy_owner'});
  assert.equal(x.bankRequired,true);
  assert.equal(x.payout.account_details,'국민은행 123456789123');
  assert.equal(x.payout.user_id,'simulated-session-user');
  assert.equal('account_details' in x.submitted.options.data,false);
  assert.equal('password' in x.submitted.options.data,false);
  assert.equal('phone' in x.submitted.options.data,false);
});
test('추천을 원하는 학부모만 계좌를 선택적으로 저장할 수 있다',async()=>{
  const x=await simulate({bank:'우리은행 123456789123'});
  assert.equal(x.bankRequired,false);
  assert.equal(x.payout.account_details,'우리은행 123456789123');
});
test('학원장이 계좌 없이 회원가입하면 신청하지 않는다',async()=>{
  const x=await simulate({kind:'academy_owner',bank:' '});
  // Empty/whitespace payout should be rejected before signUp.
  assert.equal(x.submitted,null);
  assert.match(x.status,/계좌/);
});
test('아이디가 규칙에 맞지 않으면 회원가입하지 않는다',async()=>{
  const x=await simulate({username:'x'});
  assert.equal(x.submitted,null);
  assert.match(x.status,/아이디/);
});
test('이름 없으면 회원가입하지 않는다',async()=>{
  const x=await simulate({fullName:''});
  assert.equal(x.submitted,null);
  assert.match(x.status,/이름/);
});
test('공개 화면에서 관리자 계정 생성 불가',async()=>{
  const x=await simulate({kind:'admin'});
  assert.equal(x.submitted,null);
});
test('아이디 로그인은 내부 계정으로 전환된다',async()=>{
  const x=await simulate({mode:'login'});
  assert.equal(x.loginEmail,'happyparent@fyzgwhtqqomsftqbfvjb.supabase.co');
  assert.equal(x.route,'parent-dashboard.html');
});
test('기존 이메일 회원은 이전 이메일로 로그인할 수 있다',async()=>{
  const x=await simulate({mode:'login',legacyEmail:true});
  assert.equal(x.loginEmail,'legacy@example.net');
  assert.equal(x.route,'parent-dashboard.html');
});
test('학원장 승인 상태와 별개로 원장 전용 화면에 이동한다',async()=>{
  const x=await simulate({mode:'login',kind:'academy_owner',approve:'pending'});
  assert.equal(x.route,'academy-dashboard.html');
});
test('관리자 계정은 일반 로그인 화면에서 차단된다',async()=>{
  const x=await simulate({mode:'login',kind:'admin'});
  assert.equal(x.route,null);
  assert.match(x.status,/관리자 전용 로그인/);
  assert.equal(x.adminLinkVisible,true);
});
test('Supabase 스크립트 장애를 안내한다',async()=>{
  const x=await simulate({mode:'login',unavailable:true});
  assert.match(x.status,/불러오지 못/);
});
test('관리자 비밀번호 재설정은 회원 비밀번호를 조회하지 않는다',()=>{
  const controls=fs.readFileSync(path.join(__dirname,'../admin-account-controls.js'),'utf8');
  assert.match(controls,/admin-reset-member-password/);
  assert.doesNotMatch(controls,/encrypted_password/);
  assert.match(controls,/임시 비밀번호/);
});
