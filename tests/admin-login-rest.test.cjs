'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../admin-login.js'),'utf8');
const dashboard=fs.readFileSync(path.join(__dirname,'../admin-dashboard.js'),'utf8');
test('Both admin login controllers have valid syntax',()=>{
  new Function(script);
  new Function(dashboard);
});
test('JWT-based REST lookup without SDK session lock',()=>{
  assert.match(script,/signInWithPassword/);
  assert.match(script,/rest\/v1\/member_profiles/);
  assert.match(script,/rest\/v1\/platform_admins/);
  assert.doesNotMatch(script,/client\.from\(/);
});
test('Dashboard confirms JWT server-side, badge, and approval',()=>{
  assert.match(dashboard,/auth\/v1\/user/);
  assert.match(dashboard,/platform_admins/);
  assert.match(dashboard,/가입 승인/);
});

async function checkLogin({role='admin',badge=true,authError=null}={}){
  const events={},storage={},popups=[];
  const status={textContent:'',classList:{toggle(){}},setAttribute(){}};
  const btn={disabled:false,textContent:''};
  const form={addEventListener:(name,callback)=>events[name]=callback};
  const doc={getElementById:id=>id==='admin-login-form'?form:id==='dashboard-message'?status:btn};
  let next=null,requests=0,signouts=0;
  const api={supabaseUrl:'https://demo.supabase.co',supabaseKey:'publishable',
    auth:{
      signInWithPassword:async()=>authError?{error:authError}:{data:{
        user:{id:'test-user'},session:{access_token:'access',expires_at:9999999999}}},
      signOut:async()=>{signouts++}
    }};
  const window={supabase:{createClient:()=>api},alert:value=>popups.push(value),
    location:{assign:value=>next=value}};
  const sessionStorage={setItem:(key,value)=>storage[key]=value};
  class FakeURL {
    constructor(value){this.url=value;this.searchParams={set(){}}}
    toString(){return this.url}
  }
  class FormData{get(field){return field==='email'?'test@example.invalid':'placeholder'}}
  const fetch=async url=>{
    requests++;
    return {ok:true,json:async()=>url.includes('member_profiles')?[{account_type:role}]:
      badge?[{user_id:'test-user'}]:[]};
  };
  new Function('window','document','FormData','fetch','sessionStorage','URL','setTimeout','clearTimeout',script)
    (window,doc,FormData,fetch,sessionStorage,FakeURL,setTimeout,clearTimeout);
  await events.submit({preventDefault(){}});
  return {next,requests,signouts,notice:status.textContent,popups,storage};
}
test('Admin credentials lead to dashboard with two RLS GETs',async()=>{
  const r=await checkLogin();
  assert.equal(r.next,'admin-dashboard.html');
  assert.equal(r.requests,2);
  assert.ok(r.storage.conmath_admin_bootstrap_v1);
});
test('Ordinary user is never accepted as admin',async()=>{
  const r=await checkLogin({role:'parent',badge:false});
  assert.equal(r.next,null);
  assert.equal(r.signouts,1);
  assert.match(r.notice,/관리자 권한이 없는 계정/);
});
test('Wrong password produces Korean error and alert',async()=>{
  const r=await checkLogin({authError:{message:'Invalid login credentials'}});
  assert.equal(r.next,null);
  assert.match(r.notice,/이메일 또는 비밀번호/);
  assert.equal(r.popups.length,1);
});
