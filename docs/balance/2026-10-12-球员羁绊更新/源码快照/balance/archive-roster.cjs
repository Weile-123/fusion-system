'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root='docs/balance/2026-10-12-球员羁绊更新';fs.mkdirSync(root,{recursive:true});
const hashes={};
for(const dir of ['docs/balance/2026-10-11','docs/balance/2026-10-11-词条天赋更新','docs/balance/2026-10-11-关卡微调']){
  function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='完整记录')continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else hashes[p.replace(/\\/g,'/')]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}}
  walk(dir);
}
const prior=path.join(root,'历史文件校验.json');
if(fs.existsSync(prior))require('node:assert/strict').deepEqual(hashes,JSON.parse(fs.readFileSync(prior,'utf8')));
else fs.writeFileSync(prior,JSON.stringify(hashes,null,2)+'\n');
const paths=[...Object.keys(require('./engine.cjs').manifest()),'balance/replay-verifier.cjs','balance/natural-reference.cjs','balance/natural-page.cjs','balance/compare-roster.cjs','balance/archive-roster.cjs','activity/cloudfunctions/activity_api/verified-game.js'];
for(const file of paths){const out=path.join(root,'源码快照',file);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(file,out)}
fs.cpSync('activity/cloudfunctions/activity_api/game',root+'/源码快照/activity/cloudfunctions/activity_api/game',{recursive:true});
console.log('源码快照已保存；'+Object.keys(hashes).length+'个历史文件校验通过。');
