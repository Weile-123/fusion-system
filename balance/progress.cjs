'use strict';
const fs=require('node:fs');
const {groups}=require('./suite.cjs');
const file=process.argv[2]||'artifacts/balance-round2-2000-v3.log';
const raw=fs.readFileSync(file),text=raw.toString(raw[0]===255?'utf16le':'utf8').replace(/^\uFEFF/,'');
const rows=text.split(/\r?\n/).flatMap(line=>{try{const x=JSON.parse(line);return x.group?[x]:[]}catch{return []}});
console.log(JSON.stringify({total:rows.length,groups:groups.map(g=>{const xs=rows.filter(x=>x.group===g.id);return {group:g.id,finished:xs.length,errors:xs.filter(x=>x.status==='error').length,censored:xs.filter(x=>x.status==='censored').length,maxCleared:Math.max(0,...xs.map(x=>x.highestCleared||0))}})},null,2));
