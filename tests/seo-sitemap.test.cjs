'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const get=name=>fs.readFileSync(path.join(root,name),'utf8');
const names=['index.html','brand.html','curriculum.html','course-school.html','integrated-math.html','mentor-class.html','math-reading.html','math-career.html','arithmetic.html','booking.html'];

test('sitemap lists exactly the public homepage and educational pages',()=>{
 const xml=get('sitemap.xml');
 assert.match(xml,/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
 const listed=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 assert.deepEqual(listed,names.map(name=>'https://www.conmath.kr/'+(name==='index.html'?'':name)));
 assert.doesNotMatch(xml,/admin|dashboard|parent|privacy\.html|terms\.html/);
});
test('robots.txt allows Naver and points to sitemap without exposing private dashboards',()=>{
 const robots=get('robots.txt');
 assert.match(robots,/User-agent: \*\nAllow: \//);
 assert.match(robots,/Sitemap: https:\/\/www\.conmath\.kr\/sitemap\.xml/);
 for(const name of ['admin-login.html','admin-dashboard.html','academy-dashboard.html','parent-dashboard.html'])
  assert.match(robots,new RegExp('Disallow: /'+name.replace('.','\\.')+'(?:\\n|$)'));
});
test('every sitemap page has a matching canonical and is not noindex',()=>{
 for(const name of names){
  const html=get(name);
  const url='https://www.conmath.kr/'+(name==='index.html'?'':name);
  assert.ok(html.includes('<link rel="canonical" href="'+url+'">'),name+' canonical');
  assert.doesNotMatch(html,/<meta name="robots" content="noindex"/);
 }
});
test('primary search title contains Korean brand and locality',()=>{
 const index=get('index.html');
 assert.match(index,/<title>콘매쓰\(CON MATH\)/);
 assert.match(index,/<meta name="description" content="수원 호매실 콘매쓰/);
 assert.match(index,/<meta property="og:site_name" content="콘매쓰">/);
});
