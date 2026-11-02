'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'../admin-dashboard.html'),'utf8');
const code=fs.readFileSync(path.join(__dirname,'../admin-dashboard.js'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../dashboard.css'),'utf8');

test('The administrator dashboard only shows membership application controls',()=>{
 for(const title of ['협력학원 양방향 추천수익 정책','학부모 할인 정책','콘매쓰 추천 학생 현황'])
  assert.equal(page.includes(title),false);
 assert.match(page,/회원가입 승인 관리/);
 assert.match(page,/id="pending-members"/);
 assert.doesNotMatch(page,/partner-rate-breakdown/);
});
test('Approval and rejection controls are present with distinct styles',()=>{
 assert.match(code,/decide\('approved'\)/);
 assert.match(code,/decide\('rejected'\)/);
 assert.match(code,/가입 승인/);
 assert.match(code,/가입 반려/);
 assert.match(style,/\.approval-reject/);
});
test('Only pending parent and academy applications can be changed',()=>{
 assert.match(code,/approval_status:'eq.pending'/);
 assert.match(code,/account_type:'eq.'\+item.account_type/);
 assert.match(code,/approval_status:'eq.pending'/);
 assert.match(code,/item.account_type==='parent'/);
 assert.match(code,/academy_address/);
 assert.match(code,/parent_children/);
 assert.match(code,/member_login_ids/);
 assert.doesNotMatch(code,/,email,phone,/);
 assert.match(code,/approval_status:decision/);
 assert.match(code,/window\.confirm\(question\)/);
 assert.doesNotMatch(code,/\/auth\/v1\/admin\/users/);
});
test('Admin dashboard script still parses',()=>new Function(code));

test('A pending parent cannot see rewards on its dashboard',()=>{
 const parentPage=fs.readFileSync(path.join(__dirname,'../parent-dashboard.html'),'utf8');
 const shared=fs.readFileSync(path.join(__dirname,'../dashboard.js'),'utf8');
 assert.match(parentPage,/id="parent-approved-content" hidden/);
 assert.match(parentPage,/id="parent-approval-text"/);
 assert.match(shared,/state!=='approved'/);
 assert.match(shared,/parent-approved-content/);
});
test('Both member types are registered pending, with no extra personal fields',()=>{
 const signup=fs.readFileSync(path.join(__dirname,'../member-auth.js'),'utf8');
 const page=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.doesNotMatch(page,/name="phone"/);
 assert.match(page,/name="academy_address"/);
 assert.match(page,/name="child_name"/);
 assert.match(page,/name="login_id"/);
 assert.doesNotMatch(page,/name="email"/);
 assert.doesNotMatch(signup,/fields.get\('phone'\)/);
 assert.match(signup,/관리자 승인 대기/);
 assert.match(signup,/identityForLogin/);
 assert.match(signup,/accounts\.conmath\.kr/);
});
