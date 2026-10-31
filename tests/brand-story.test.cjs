'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');
const start=html.indexOf('<section class="brand-story"');
const end=html.indexOf('<span id="textbooks"',start);
const brand=html.slice(start,end);

test('Brand navigation leads to an actual brand introduction section',()=>{
 assert.ok(start>=0&&end>start);
 assert.equal(html.split('href="#about"').length-1,2);
 assert.equal(html.split('id="about"').length-1,1);
 assert.match(brand,/aria-labelledby="brand-story-title"/);
 assert.match(brand,/id="brand-story-title"/);
});
test('Native Korean text preserves agreed CON MATH education philosophy',()=>{
 assert.match(brand,/원리를 탐구하며/);
 assert.match(brand,/이해한 개념은/);
 assert.match(brand,/내 것이 된다/);
 for(const pillar of ['이해하는 공부','연결하는 사고','활용하는 힘']){
  assert.ok(brand.includes(pillar),pillar);
 }
 assert.doesNotMatch(brand,/<img\b|<video\b|<canvas\b/);
});
test('Brand uses responsive blue-gold CSS without requiring an AI image',()=>{
 assert.match(css,/\.brand-story-grid/);
 assert.match(css,/\.brand-story-manifesto/);
 assert.match(css,/#edca78/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(html,/style\.css\?v=20261031-brand1/);
});
test('Brand vision is future-facing, not falsely described as launched',()=>{
 assert.match(brand,/넓혀가고자 합니다/);
 assert.match(brand,/href="integrated-math.html"/);
});
