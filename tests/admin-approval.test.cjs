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
 assert.match(page,/가입 신청 관리/);
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
test('Only pending academy owner applications can be changed',()=>{
 assert.match(code,/approval_status:'eq.pending'/);
 assert.match(code,/account_type:'eq.academy_owner'/);
 assert.match(code,/approval_status:decision/);
 assert.match(code,/window\.confirm\(question\)/);
 assert.doesNotMatch(code,/\/auth\/v1\/admin\/users/);
});
test('Admin dashboard script still parses',()=>new Function(code));
