'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const file=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const parent=file('parent-dashboard.html');
const code=file('parent-service.js');
const admin=file('admin-dashboard.html');
const response=file('admin-consultations.js');
test('학부모는 승인 후에만 자녀·상담 화면을 봄',()=>{
 assert.match(parent,/id="parent-approved-content" hidden/);
 assert.match(code,/approval_status!=='approved'/);
 assert.match(parent,/id="child-form"/);
 assert.match(parent,/id="consult-form"/);
});
test('자녀별 상담과 개인정보 최소 수집 및 표시',()=>{
 assert.match(code,/\.eq\('parent_id',user\.id\)/);
 assert.match(code,/textContent='Q\. '/);
 assert.match(code,/parent_children/);
 assert.match(code,/parent_consultations/);
 assert.match(parent,/최대 6명|자녀 등록/);
 assert.doesNotMatch(parent,/name="phone"/);
});
test('질문 글자수 제한 및 관리자 1회 답변',()=>{
 assert.match(parent,/maxlength="200"/);
 assert.match(response,/maxLength=300/);
 assert.match(response,/answer:'is.null'/);
 assert.match(admin,/id="admin-consultations"/);
});
test('new scripts parse without syntax error',()=>{new Function(code);new Function(response)});
