'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const file=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const parent=file('parent-dashboard.html');
const code=file('parent-service.js');
const admin=file('admin-dashboard.html');
const compose=file('admin-consultations.js');
test('학부모는 승인 이후에만 자녀 관리와 코멘트를 확인함',()=>{
 assert.match(parent,/id="parent-approved-content" hidden/);
 assert.match(code,/approval_status!=='approved'/);
 assert.match(parent,/id="child-form"/);
 assert.match(parent,/id="comment-history"/);
 assert.match(code,/\.eq\('parent_id',user\.id\)/);
});
test('학부모는 자녀별 코멘트를 읽기만 하고 질문·답변 입력 UI가 없음',()=>{
 assert.match(parent,/읽기 전용/);
 assert.match(parent,/코멘트 작성은 관리자만 가능/);
 assert.match(code,/from\('parent_child_comments'\)\.select/);
 assert.doesNotMatch(parent,/id="consult-form"|id="consult-question"|id="consult-submit"|id="admin-comment-form"/);
 assert.doesNotMatch(code,/from\('parent_child_comments'\)\.insert/);
 assert.doesNotMatch(code,/from\('parent_consultations'\)/);
 assert.doesNotMatch(parent,/name="phone"/);
});
test('관리자만 자녀를 선택하고 코멘트 입력 가능',()=>{
 assert.match(admin,/id="admin-comment-form"/);
 assert.match(admin,/id="admin-comment-child"/);
 assert.match(compose,/platform_admins/);
 assert.match(compose,/account_type!=='admin'/);
 assert.match(compose,/method,path,params/);
 assert.match(compose,/rest\('POST','\/rest\/v1\/parent_child_comments'/);
 assert.match(compose,/author_id:user\.id/);
 assert.match(compose,/parent_id:child\.parent_id/);
 assert.match(compose,/comment\.length<2\|\|comment\.length>300/);
 assert.doesNotMatch(compose,/rest\('PATCH'/);
});
test('신규 스크립트 구문 검증',()=>{new Function(code);new Function(compose)});
