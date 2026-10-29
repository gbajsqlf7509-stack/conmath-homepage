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

async function simulate({mode='signup',kind='parent',adminBadge=false,phone='01012345678',unavailable=false}={}) {
 const names=['account-dialog','account-form','signup-only','academy-fields','account-status',
 'member-panel','account-switch','account-type','account-title','account-consent',
 'member-message','account-dashboard-link','member-signout','admin-login-link'];
 const elements=Object.fromEntries(names.map(name=>[name,new Element()]));
 const form=elements['account-form'];
 form.submit=new Element();
 form.elements={namedItem:()=>({autocomplete:''})};
 form.fields={account_type:kind,email:'test@example.invalid',password:'long-secure-password',
  full_name:'테스트 회원',phone,academy_name:kind==='academy_owner'?'테스트 학원':'',
  academy_address:kind==='academy_owner'?'서울':''};
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
   signUp:async payload=>{submitted=payload;return {error:null}},
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
 return {submitted,route,status:elements['account-status'].textContent,adminLinkVisible:!elements['admin-login-link'].hidden};
}

test('학부모 회원가입과 이메일 리다이렉트',async()=>{
 const r=await simulate();
 assert.equal(r.submitted.options.data.account_type,'parent');
 assert.equal(r.submitted.options.emailRedirectTo,'https://www.conmath.kr/index.html');
});
test('협력 원장 회원가입',async()=>{
 const r=await simulate({kind:'academy_owner'});
 assert.equal(r.submitted.options.data.academy_name,'테스트 학원');
 assert.match(r.status,/협력학원 원장 가입 신청/);
});
test('잘못된 연락처로 Supabase 가입을 호출하지 않음',async()=>{
 const r=await simulate({phone:'1'});
 assert.equal(r.submitted,null);
 assert.match(r.status,/연락처/);
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
