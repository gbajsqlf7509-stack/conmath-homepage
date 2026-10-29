'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../admin-login.js'), 'utf8');

async function simulate({loginError=null, accountType='admin', badge=true, databaseError=false, missingSdk=false}={}){
  const events={};
  const status={textContent:'',attributes:{},classList:{toggle(){ }},setAttribute(name,value){this.attributes[name]=value;}};
  const button={disabled:false,textContent:'관리자 로그인'};
  const form={addEventListener(type,handler){events[type]=handler},fields:{email:'admin@example.invalid',password:'Secret#123456'}};
  const doc={getElementById(id){return ({'admin-login-form':form,'dashboard-message':status,'admin-login-submit':button})[id]}};
  let redirected=null,signouts=0,credentials=null;
  const user={id:'mock-user'};
  const client={
    auth:{
      signInWithPassword:async data=>{credentials=data;return loginError?{data:{user:null},error:loginError}:{data:{user},error:null}},
      signOut:async()=>{signouts++;return {error:null}}
    },
    from(table){
      return {
        select(){return this},
        eq(){return this},
        async single(){
          if(databaseError)return {data:null,error:{message:'Database temporarily unavailable'}};
          return {data:{account_type:accountType},error:null};
        },
        async maybeSingle(){
          if(databaseError)return {data:null,error:{message:'Database temporarily unavailable'}};
          return {data:badge?{user_id:user.id}:null,error:null};
        }
      };
    }
  };
  const alerts=[];
  const win={
    supabase:missingSdk?null:{createClient(){return client}},
    location:{assign(target){redirected=target}},
    alert(message){alerts.push(message)}
  };
  class FD extends Map{constructor(f){super(Object.entries(f.fields))}}
  vm.runInNewContext(source,{window:win,document:doc,FormData:FD,Promise,setTimeout,clearTimeout});
  if(events.submit)await events.submit({preventDefault(){}});
  return {redirected,signouts,credentials,status:status.textContent,alerts,disabled:button.disabled};
}
test('로그인 비밀번호 인증 성공 후 관리자 역할로 즉시 이동',async()=>{
  const r=await simulate();
  assert.equal(r.redirected,'admin-dashboard.html');
  assert.deepEqual({...r.credentials},{email:'admin@example.invalid',password:'Secret#123456'});
  assert.equal(r.signouts,0);
});
test('틀린 비밀번호는 한국어 오류 표시와 팝업 알림',async()=>{
  const r=await simulate({loginError:{message:'Invalid login credentials',code:'invalid_credentials'}});
  assert.equal(r.redirected,null);
  assert.match(r.status,/이메일 또는 비밀번호/);
  assert.equal(r.alerts.length,1);
  assert.match(r.alerts[0],/이메일 또는 비밀번호/);
  assert.equal(r.disabled,false);
});
test('이메일 미인증 오류를 한국어로 표시',async()=>{
  const r=await simulate({loginError:{message:'Email not confirmed'}});
  assert.match(r.status,/이메일 인증/);
});
test('학부모는 관리자 화면에 접근할 수 없음',async()=>{
  const r=await simulate({accountType:'parent',badge:false});
  assert.equal(r.redirected,null);
  assert.equal(r.signouts,1);
  assert.match(r.status,/관리자 권한이 없는 계정/);
});
test('역할 정보 DB 오류를 비밀번호 오류로 오인하지 않음',async()=>{
  const r=await simulate({databaseError:true});
  assert.equal(r.redirected,null);
  assert.match(r.status,/로그인은 성공했지만 관리자 권한 정보를/);
});
test('외부 인증 SDK가 로드되지 않아도 안내 표시',async()=>{
  const r=await simulate({missingSdk:true});
  assert.match(r.status,/로그인 서비스를 불러오지 못했습니다/);
});
