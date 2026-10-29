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
