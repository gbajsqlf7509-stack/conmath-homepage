'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const page=fs.readFileSync(path.join(root,'brand.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const brand=page.slice(page.indexOf('<section class="brand-story"'),page.indexOf('</main>'));

test('Brand introduction is a standalone page, not a section on the homepage',()=>{
 assert.doesNotMatch(home,/class="brand-story"/);
 assert.doesNotMatch(home,/id="about"/);
 assert.equal(home.split('href="brand.html"').length-1,2);
 assert.match(home,/class="hero"/);
 assert.match(home,/class="features shell"/);
 assert.equal(page.split('aria-current="page"').length-1,2);
 assert.match(page,/<title>브랜드 소개 \| CON MATH 콘매쓰<\/title>/);
 assert.match(page,/<main class="brand-page-main">/);
 assert.doesNotMatch(page,/class="hero"/);
});
test('Brand story has semantic heading, agreed message and three education principles',()=>{
 assert.match(brand,/id="about" aria-labelledby="brand-story-title"/);
 assert.match(brand,/id="brand-story-title"/);
 for(const phrase of ['원리를 탐구하며','이해한 개념은','내 것이 된다','이해하는 공부','연결하는 사고','활용하는 힘'])
   assert.ok(brand.includes(phrase),phrase);
 assert.doesNotMatch(brand,/<img\b|<video\b|<canvas\b/);
});
test('Standalone brand page preserves normal navigation, account login and booking',()=>{
 assert.match(page,/href="index.html" class="logo"/);
 assert.match(page,/href="index.html#partners"/);
 assert.match(page,/href="index.html#management"/);
 assert.match(page,/href="booking.html"/);
 assert.match(page,/id="account-dialog"/);
 assert.match(page,/id="payout-step"/);
 assert.match(page,/src="member-auth.js\?v=20261111-bankstep1"/);
});
test('Brand page remains responsive and never relies on text rendered into images',()=>{
 assert.match(css,/\.brand-story-grid/);
 assert.match(css,/\.brand-story-manifesto/);
 assert.match(css,/\.brand-page-breadcrumb/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(page,/style\.css\?v=20261111-bankstep1/);
 assert.match(home,/style\.css\?v=20261111-bankstep1/);
});
test('Expanded academy partnership remains a future-facing direction',()=>{
 assert.match(brand,/넓혀가고자 합니다/);
 assert.match(brand,/href="integrated-math.html"/);
});
