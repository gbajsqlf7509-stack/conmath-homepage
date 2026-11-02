'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../member-auth.js'),'utf8');

class Element {
 constructor(){
  this.hidden=false;this.textContent='';this.dataset={};this.handlers={};
  this.classList={toggle(){}};
 }
 addEventListener(name,fn){(this.handlers[name]??=[]).push(fn)}
 async dispatchEvent(event){
  for(const fn of this.handlers[event.type]??[])await fn({target:this,preventDefault(){}});
 }
 querySelector(selector){
  return selector==='.account-submit'?this.submit:selector==='.account-close'?this.closeBtn:null;
 }
 showModal(){this.open=true}
 close(){this.open=false}
 reset(){}
}
class FakeEvent {constructor(type){this.type=type}}
class FakeFormData extends Map {
 constructor(form){super(Object.entries(form.fields??{}))}
}

async function simulate({mode='signup',kind='parent',adminBadge=false,childName='아동가',username='parent001',unavailable=false,instantSignup=false}={}) {
 const names=['account-dialog','account-form','signup-only','academy-fields','parent-fields','account-status',
 'member-panel','account-switch','account-type','account-title','account-consent',
 'member-message','account-dashboard-link','member-signout','admin-login-link'];
 const elements=Object.fromEntries(names.map(name=>[name,new Element()]));
 const form=elements['account-form'];
 form.submit=new Element();
 form.elements={namedItem:()=>({autocomplete:''})};
 form.fields={account_type:kind,login_id:username,password:'long-secure-password',
  child_name:childName,academy_name:kind==='academy_owner'?'테스트 학원':'',
  academy_address:kind==='academy_owner'?'경기도 수원시':''};
 elements['account-dialog'].closeBtn=new Element();
 elements['account-type'].value=kind;
 elements['account-consent'].checked=true;
 const loginButton=new Element(),signupButton=new Element();
 loginButton.dataset.account='login';signupButton.dataset.account='signup';
 const document={
  getElementById:id=>elements[id],
  querySelectorAll:selector=>selector==='[data-account]'?[loginButton,signupButton]:
    selector==='[data-account="login"]'?[loginButton]:[]
 };
 let submitted=null,route=null;
 const user={id:'simulated-session-user'};
 const client={
  auth:{
   getUser:async()=>({data:{user:null}}),
   getSession:async()=>({data:{session:null}}),
   onAuthStateChange:()=>{},
   signUp:async payload=>{submitted=payload;return {error:null,data:instantSignup?{session:{access_token:'mock'},user}:{session:null,user}}},
   signInWithPassword:async()=>({data:{user},error:null}),
   signOut:async()=>({error:null})
  },
  from:table=>({
   select(){return this},eq(){return this},
   single:async()=>({data:{account_type:kind,full_name:'테스트 회원',
       approval_status:kind==='academy_owner'?'pending':'active'}}),
   maybeSingle:async()=>({data:adminBadge?{user_id:user.id}:null,error:null})
  })
 };
 const window={
  supabase:unavailable?null:{createClient:()=>client},
  location:{origin:'https://www.conmath.kr',pathname:'/index.html',assign:target=>route=target}
 };
 vm.runInNewContext(source,{window,document,Event:FakeEvent,FormData:FakeFormData,confirm:()=>true});
 await (mode==='login'?loginButton:signupButton).dispatchEvent({type:'click'});
 if(!unavailable)await form.dispatchEvent({type:'submit'});
 return {submitted,route,status:elements['account-status'].textContent,adminLinkVisible:!elements['admin-login-link'].hidden,formHidden:form.hidden,panelVisible:!elements['member-panel'].hidden,dashboardHref:elements['account-dashboard-link'].href,memberMessage:elements['member-message'].textContent};
}

test('학부모 가입은 내부 식별자만 생성하고 아이 이름 등록',async()=>{
 const r=await simulate();
 assert.equal(r.submitted.options.data.account_type,'parent');
 assert.equal(r.submitted.email,'parent001@accounts.conmath.kr');
 assert.equal(r.submitted.options.data.child_name,'아동가');
 assert.equal(r.submitted.options.emailRedirectTo,undefined);
});
test('협력 원장 회원가입',async()=>{
 const r=await simulate({kind:'academy_owner'});
 assert.equal(r.submitted.options.data.academy_name,'테스트 학원');
 assert.equal('phone' in r.submitted.options.data,false);
 assert.equal(r.submitted.options.data.academy_address,'경기도 수원시');
 assert.equal('child_name' in r.submitted.options.data,true);
 assert.match(r.status,/아이디 방식의 가입 설정/);
});
test('아이 이름 없으면 학부모 가입을 요청하지 않음',async()=>{
 const r=await simulate({childName:''});
 assert.equal(r.submitted,null);
 assert.match(r.status,/아이 이름/);
});
test('공개 회원가입에서 관리자 역할을 만들 수 없음',async()=>{
 const r=await simulate({kind:'admin'});
 assert.equal(r.submitted,null);
});
test('학부모 전용 화면으로 이동',async()=>{
 assert.equal((await simulate({mode:'login'})).route,'parent-dashboard.html');
});
test('원장 전용 화면으로 이동',async()=>{
 assert.equal((await simulate({mode:'login',kind:'academy_owner'})).route,'academy-dashboard.html');
});
test('관리자 계정은 일반 로그인에서 관리자 화면으로 이동하지 않음',async()=>{
 const r=await simulate({mode:'login',kind:'admin',adminBadge:true});
 assert.equal(r.route,null);
 assert.match(r.status,/관리자 전용 로그인/);
 assert.equal(r.adminLinkVisible,true);
});
test('관리자 프로필은 일반 로그인에서 뱃지 유무와 관계없이 전용 로그인으로 안내',async()=>{
 const r=await simulate({mode:'login',kind:'admin'});
 assert.equal(r.route,null);
 assert.match(r.status,/관리자 전용 로그인/);
 assert.equal(r.adminLinkVisible,true);
});
test('외부 Supabase 스크립트 로딩 실패 시 오류 안내',async()=>{
 const r=await simulate({mode:'login',unavailable:true});
 assert.match(r.status,/불러오지/);
});

test('이메일 인증 비활성화: 학부모 가입 직후 승인 대기 표시',async()=>{
 const r=await simulate({kind:'parent',instantSignup:true});
 assert.equal(r.formHidden,true);
 assert.equal(r.panelVisible,true);
 assert.equal(r.dashboardHref,'parent-dashboard.html');
 assert.match(r.status,/승인 대기/);
 assert.doesNotMatch(r.status,/이메일 인증 링크/);
 assert.match(r.memberMessage,/관리자 승인/);
});
test('이메일 인증 비활성화: 협력학원 가입 후 관리자 승인 대기',async()=>{
 const r=await simulate({kind:'academy_owner',instantSignup:true});
 assert.equal(r.panelVisible,true);
 assert.equal(r.dashboardHref,'academy-dashboard.html');
 assert.match(r.memberMessage,/관리자 승인/);
 assert.doesNotMatch(r.status,/이메일 인증/);
});
test('아이디 가입에서 인증 설정 미완료면 이메일 전송을 안내하지 않음',async()=>{
 const r=await simulate({kind:'academy_owner',instantSignup:false});
 assert.equal(r.formHidden,true);
 assert.equal(r.panelVisible,false);
 assert.match(r.status,/아이디 방식의 가입 설정/);
 assert.doesNotMatch(r.status,/이메일 인증 링크/);
});

test('아이디 형식에 맞지 않으면 인증 호출 없이 가입 차단',async()=>{
 const r=await simulate({username:'bad id@naver.com'});
 assert.equal(r.submitted,null);
 assert.match(r.status,/아이디는 영문/);
});
