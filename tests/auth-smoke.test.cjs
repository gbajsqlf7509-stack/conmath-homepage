'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../member-auth.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

class Element{
  constructor(){
    this.hidden=false;this.value='';this.textContent='';
    this.dataset={};this.handlers={};this.classList={toggle(){}};
    this.required=false;this.disabled=false;
  }
  addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
  async dispatchEvent(event){
    for(const fn of this.handlers[event.type]??[])await fn({target:this,preventDefault(){}});
  }
  querySelector(selector){return selector==='.account-submit'?this.submit:
    selector==='.account-close'?this.closeBtn:null;}
  setAttribute(name,value){this[name]=value;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  reset(){}
}
class FakeFormData extends Map{constructor(form){super(Object.entries(form.fields??{}));}}

async function simulate({
  mode='signup',kind='parent',username='happyparent',
  fullName='테스트 회원',bankName='국민은행',bankNumber='123456-789012',
  available=true,legacy=false,bankAlreadySaved=false,session=true,
  authError=null,bankError=null
}={}){
  const names=['account-dialog','account-form','signup-only','account-status',
    'member-panel','account-switch','account-type','account-title','account-consent',
    'member-message','account-dashboard-link','member-signout','admin-login-link',
    'login-id','login-id-label','payout-step','account-bank-name','account-bank-number',
    'payout-step-guide','payout-skip','payout-save','member-open-payout'];
  const els=Object.fromEntries(names.map(id=>[id,new Element()]));
  els['account-dialog'].closeBtn=new Element();
  els['account-form'].submit=new Element();
  els['account-form'].elements={namedItem:()=>({autocomplete:''})};
  els['account-form'].fields={
    account_type:kind,full_name:fullName,
    login_id:legacy?'legacy@example.net':username,password:'test-password-123'
  };
  els['account-type'].value=kind;
  els['account-consent'].checked=true;
  els['account-bank-name'].value=bankName;
  els['account-bank-number'].value=bankNumber;
  const loginButton=new Element(),signupButton=new Element();
  loginButton.dataset.account='login';signupButton.dataset.account='signup';
  const document={
    getElementById:id=>els[id],
    querySelectorAll:selector=>selector==='[data-account]'?[loginButton,signupButton]:
      selector==='[data-account="login"]'?[loginButton]:[]
  };
  const user={id:'fake-user-id'};
  let signupPayload=null,loginEmail=null,payout=null,route=null;
  let savedAccount=bankAlreadySaved?{user_id:user.id,account_details:'국민은행 123456-789012'}:null;
  let signedIn=false;
  const client={
    auth:{
      getUser:async()=>({data:{user:signedIn?user:null},error:null}),
      getSession:async()=>({data:{session:null}}),
      signUp:async payload=>{signupPayload=payload;if(authError)return{data:{user:null,session:null},error:authError};signedIn=session;return{data:{user,session:session?{access_token:'test'}:null},error:null};},
      signInWithPassword:async payload=>{loginEmail=payload.email;if(authError)return{data:{user:null,session:null},error:authError};signedIn=true;return{data:{user,session:{access_token:'test'}},error:null};},
      onAuthStateChange:()=>{},signOut:async()=>({error:null})
    },
    from(table){
      if(table==='member_payout_accounts')return {
        select(){return this;},eq(){return this;},
        maybeSingle:async()=>({data:savedAccount,error:null}),
        upsert:async payload=>{if(bankError)return{error:bankError};payout=payload;savedAccount={...payload};return{error:null};}
      };
      return {
        select(){return this;},eq(){return this;},
        single:async()=>({data:{account_type:kind,full_name:'테스트 회원',approval_status:'pending'},error:null})
      };
    }
  };
  const window={
    supabase:available?{createClient:()=>client}:null,
    location:{assign:p=>route=p},alert:()=>{}
  };
  vm.runInNewContext(source,{window,document,FormData:FakeFormData});
  await (mode==='login'?loginButton:signupButton).dispatchEvent({type:'click'});
  const snapshot=()=>({
    signupPayload,loginEmail,payout,route,
    payoutVisible:!els['payout-step'].hidden,signupVisible:!els['account-form'].hidden,
    skipVisible:!els['payout-skip'].hidden,
    bankLabel:els['payout-step-guide'].textContent,
    message:els['account-status'].textContent,
    memberVisible:!els['member-panel'].hidden,
    title:els['account-title'].textContent
  });
  return {
    elements:els,snapshot,
    submitSignup:async()=>els['account-form'].dispatchEvent({type:'submit'}),
    submitBank:async()=>els['payout-step'].dispatchEvent({type:'submit'}),
    skip:async()=>els['payout-skip'].dispatchEvent({type:'click'}),
    manageAccount:async()=>els['member-open-payout'].dispatchEvent({type:'click'})
  };
}

test('회원가입에는 계좌번호가 없고 별도 입력 화면이 있다',()=>{
  const signup=page.split('<form id="account-form"')[1].split('</form>')[0];
  assert.doesNotMatch(signup,/account_details|account-bank-name|account-bank-number/);
  assert.match(page,/id="payout-step"/);
  assert.match(page,/id="account-bank-name"/);
  assert.match(page,/id="account-bank-number"/);
  assert.match(page,/id="payout-skip"/);
});
test('학부모: 회원가입 성공 → 계좌 화면이 열리고 가입 단계에서는 계좌가 저장되지 않는다',async()=>{
  const x=await simulate();
  await x.submitSignup();
  const s=x.snapshot();
  assert.equal(s.signupPayload.email,'happyparent@fyzgwhtqqomsftqbfvjb.supabase.co');
  assert.equal(s.payoutVisible,true);
  assert.equal(s.signupVisible,false);
  assert.equal(s.skipVisible,true);
  assert.equal(s.payout,null);
  assert.match(s.message,/가입 신청이 접수/);
});
test('학부모는 계좌 단계를 건너뛰고 관리자 승인을 기다릴 수 있다',async()=>{
  const x=await simulate();await x.submitSignup();await x.skip();
  const s=x.snapshot();
  assert.equal(s.payout,null);
  assert.equal(s.payoutVisible,false);
  assert.equal(s.memberVisible,true);
});
test('학원장도 가입한 후 계좌 화면이 열리며 건너뛰기는 제공하지 않는다',async()=>{
  const x=await simulate({kind:'academy_owner',bankAlreadySaved:false});
  await x.submitSignup();
  const s=x.snapshot();
  assert.equal(s.signupPayload.options.data.account_type,'academy_owner');
  assert.equal(s.payoutVisible,true);
  assert.equal(s.skipVisible,false);
  assert.equal(s.payout,null);
});
test('학원장: 별도 계좌 단계에서 저장하면 전용 페이지로 이동할 수 있다',async()=>{
  const x=await simulate({kind:'academy_owner'});
  await x.submitSignup();await x.submitBank();
  const s=x.snapshot();
  assert.equal(s.payout.account_details,'국민은행 123456-789012');
  assert.equal(s.payout.user_id,'fake-user-id');
  assert.equal(s.memberVisible,true);
  assert.equal(s.payoutVisible,false);
  assert.match(s.message,/계좌정보를 저장/);
});
test('학부모도 희망하면 계좌를 저장할 수 있다',async()=>{
  const x=await simulate({kind:'parent'});
  await x.submitSignup();await x.submitBank();
  assert.equal(x.snapshot().payout.account_details,'국민은행 123456-789012');
});
test('학원장이 미등록 계좌로 로그인하면 계좌 화면부터 보여준다',async()=>{
  const x=await simulate({mode:'login',kind:'academy_owner'});
  await x.submitSignup();
  assert.equal(x.snapshot().payoutVisible,true);
  assert.equal(x.snapshot().route,null);
});
test('학원장이 계좌를 이미 등록했으면 기존처럼 마이페이지로 이동한다',async()=>{
  const x=await simulate({mode:'login',kind:'academy_owner',bankAlreadySaved:true});
  await x.submitSignup();
  assert.equal(x.snapshot().route,'academy-dashboard.html');
});
test('기존 이메일 계정도 계속 로그인할 수 있다',async()=>{
  const x=await simulate({mode:'login',legacy:true});
  await x.submitSignup();
  assert.equal(x.snapshot().loginEmail,'legacy@example.net');
  assert.equal(x.snapshot().route,'parent-dashboard.html');
});
test('학부모는 계좌 없이 로그인해도 전용 페이지로 이동할 수 있다',async()=>{
  const x=await simulate({mode:'login',kind:'parent'});
  await x.submitSignup();
  assert.equal(x.snapshot().route,'parent-dashboard.html');
});
test('아이디와 이름은 가입 과정에서 검증한다',async()=>{
  const x=await simulate({username:'a'});await x.submitSignup();
  assert.equal(x.snapshot().signupPayload,null);
  assert.match(x.snapshot().message,/아이디/);
  const y=await simulate({fullName:''});await y.submitSignup();
  assert.equal(y.snapshot().signupPayload,null);
  assert.match(y.snapshot().message,/이름/);
});
test('공개 화면에서 관리자 계정 생성은 막힌다',async()=>{
  const x=await simulate({kind:'admin'});await x.submitSignup();
  assert.equal(x.snapshot().signupPayload,null);
});
test('비정상 계좌번호는 저장하지 않는다',async()=>{
  const x=await simulate({bankNumber:'ABC'});await x.submitSignup();await x.submitBank();
  assert.equal(x.snapshot().payout,null);
  assert.match(x.snapshot().message,/계좌번호/);
});
test('이미 등록한 계좌도 계정 화면에서 다시 수정할 수 있다',async()=>{
  const x=await simulate({mode:'login',bankAlreadySaved:true});
  await x.submitSignup();await x.manageAccount();
  assert.equal(x.snapshot().payoutVisible,true);
});
test('외부 Supabase 스크립트 오류를 안내한다',async()=>{
  const x=await simulate({available:false,mode:'login'});
  assert.match(x.snapshot().message,/불러오지 못/);
});
test('비밀번호를 관리자에게 조회시키지 않는다',()=>{
  const controls=fs.readFileSync(path.join(__dirname,'../admin-account-controls.js'),'utf8');
  assert.match(controls,/admin-reset-member-password/);
  assert.doesNotMatch(controls,/encrypted_password/);
});

test('보안상 17초 제한: 영어 원문 대신 남은 시간을 한국어로 표시',async()=>{
  const x=await simulate({
    authError:{message:'For security purposes, you can only request this after 17 seconds.',status:429,code:'over_request_rate_limit'}
  });
  await x.submitSignup();
  const message=x.snapshot().message;
  assert.match(message,/보안을 위해 17초 후 다시 시도해주세요/);
  assert.doesNotMatch(message,/For security|seconds|request this/i);
});
test('보안 재요청 제한: 초를 모를 때에도 한국어만 안내',async()=>{
  const x=await simulate({authError:{message:'Rate limit exceeded',status:429}});
  await x.submitSignup();
  assert.match(x.snapshot().message,/잠시 후 다시 시도해주세요/);
  assert.doesNotMatch(x.snapshot().message,/[a-z]{3,}/i);
});
test('알려지지 않은 영어 가입 오류도 화면에 표시하지 않는다',async()=>{
  const x=await simulate({authError:{message:'Unexpected Authentication Gateway Message'}});
  await x.submitSignup();
  assert.match(x.snapshot().message,/회원가입 요청/);
  assert.doesNotMatch(x.snapshot().message,/Unexpected|Gateway|Authentication/i);
});
test('영어 로그인 오류도 한국어로 표시',async()=>{
  const x=await simulate({mode:'login',authError:{message:'Invalid login credentials',code:'invalid_credentials'}});
  await x.submitSignup();
  assert.match(x.snapshot().message,/아이디 또는 비밀번호/);
  assert.doesNotMatch(x.snapshot().message,/Invalid login credentials/i);
});
test('계좌 입력 단계에서 영어 서버 오류를 그대로 보여주지 않는다',async()=>{
  const x=await simulate({bankError:{message:'new row violates row-level security policy'}});
  await x.submitSignup();
  await x.submitBank();
  assert.match(x.snapshot().message,/계좌정보를 저장하지 못했습니다/);
  assert.doesNotMatch(x.snapshot().message,/row-level|policy/i);
});
