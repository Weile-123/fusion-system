const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const migration='20261010190000_weekly_ovr_leaderboard.sql';
const sql=fs.readFileSync('cloudbase/migrations/'+migration,'utf8');
let db,serial=0;
const uuid=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
async function query(text,args=[]){return (await db.query(text,args)).rows;}
async function one(text,args=[]){return (await query(text,args))[0];}
async function rpc(name,args){const row=await one(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args);return row.result;}
async function clock(value){await db.query('update test_clock set value=$1',[value]);}
async function run(user='player',proof=3,rules=6){const id=uuid();await db.query('insert into leaderboard_runs(id,puid,talent,seed,display_name,proof_version,state) values($1,$2,$3,911,$4,$5,$6)',[id,user,'reserve_fund','Name '+user,proof,{balanceRulesVersion:rules}]);return id;}
async function battle(id,rating,stage=1,won=true){const r=await one('select * from leaderboard_runs where id=$1',[id]);return rpc('record_game_leaderboard_battle',[r.puid,id,911,r.battle_count+1,stage,r.wins,r.losses,won,rating]);}
async function reset(){await databaseReady;await db.exec(`set timezone='UTC';
  create or replace function public.weekly_ovr_now() returns timestamptz language sql volatile set search_path=public as $$ select value from test_clock $$;
  truncate weekly_ovr_snapshots,weekly_ovr_entries,weekly_ovr_periods,leaderboard_battles,leaderboard_runs,leaderboard_entries cascade; update weekly_ovr_settings set enabled_at=null`);await clock('2026-10-11T15:59:59Z');}
async function enable(){await db.exec("update weekly_ovr_settings set enabled_at='2026-01-01T00:00:00Z'");}

const databaseReady=(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table public.demo_items(id uuid primary key default gen_random_uuid(),puid text not null);`);
  for(const file of fs.readdirSync('cloudbase/migrations').filter(f=>f.endsWith('.sql')&&f<migration).sort())await db.exec(fs.readFileSync('cloudbase/migrations/'+file,'utf8'));
  // First execute the unmodified deployment migration against the real PG engine.
  await db.exec(sql);await db.exec(sql); // Re-applying is safe and preserves activation.
  assert.equal(sql,fs.readFileSync('activity/migrations/'+migration,'utf8'));
  const eventMigration='20261011210000_event_talent_unlock.sql',eventSql=fs.readFileSync('cloudbase/migrations/'+eventMigration,'utf8');
  assert.equal(eventSql,fs.readFileSync('activity/migrations/'+eventMigration,'utf8'));await db.exec(eventSql);await db.exec(eventSql);
  const minimumMigration='20261012103000_weekly_ovr_min_rules.sql';
  const minimumSql=fs.readFileSync('cloudbase/migrations/'+minimumMigration,'utf8');
  assert.equal(minimumSql,fs.readFileSync('activity/migrations/'+minimumMigration,'utf8'));
  await db.exec(minimumSql);await db.exec(minimumSql);
  // Deterministic boundary clock in this disposable local DB only. Nothing is uploaded.
  await db.exec(`create table public.test_clock(value timestamptz not null);insert into public.test_clock values('2026-10-11T15:59:59Z');`);
  await db.exec(`create or replace function public.weekly_ovr_now() returns timestamptz language sql volatile set search_path=public as $$ select value from public.test_clock $$;`);
})();
test.before(async()=>{await databaseReady});
test.beforeEach(reset);
test.after(async()=>{if(db)await db.close()});

test('weekly eligibility uses the saved rules version; legacy battles still save cumulative scores',async()=>{
  await enable();
  for(const rules of [1,2,3,4,5,6,7,8,9,null,'invalid']){
    const id=await run('version-'+rules,3,rules);await battle(id,1000);
    const weekly=await one('select count(*)::int n from weekly_ovr_entries where run_id=$1',[id]);
    assert.equal(weekly.n,[6,7,8,9].includes(rules)?1:0);
    assert.equal((await one('select count(*)::int n from leaderboard_battles where run_id=$1',[id])).n,1);
  }
  const old=await run('upgrade',3,3);await battle(old,13030);
  assert.equal((await one("select score from leaderboard_entries where puid='upgrade' and board='ovr'")).score,13030);
  const upgraded=await run('upgrade',3,6);await battle(upgraded,500);
  await battle(old,14000,2);
  assert.equal((await one("select score from weekly_ovr_entries where puid='upgrade'")).score,500);
});

test('minimum-rules migration removes only ineligible current-week scores and is idempotent',async()=>{
  await enable();await db.exec(sql); // Seed scores written by the former deployed trigger.
  const history=await run('history-old',3,3);await battle(history,900);
  await clock('2026-10-11T16:00:00Z');
  const previous=await rpc('get_weekly_ovr_page',['previous',50]);
  const low=await run('current-old',3,3),valid=await run('current-valid',3,6),missing=await run('current-missing',3,null);
  await battle(low,13030);await battle(valid,600);await battle(missing,700);
  const cumulative=await query('select puid,board,score from leaderboard_entries order by puid,board');
  const minimumSql=fs.readFileSync('cloudbase/migrations/20261012103000_weekly_ovr_min_rules.sql','utf8');
  await db.exec(minimumSql);await db.exec(minimumSql);
  assert.deepEqual((await rpc('get_weekly_ovr_page',['current',50])).entries.map(e=>e.score),[600]);
  assert.deepEqual((await rpc('get_weekly_ovr_page',['previous',50])).entries,previous.entries);
  assert.deepEqual(await query('select puid,board,score from leaderboard_entries order by puid,board'),cumulative);
  assert.equal((await one('select count(*)::int n from leaderboard_battles')).n,4);
  await battle(low,14000,2);
  assert.deepEqual((await rpc('get_weekly_ovr_page',['current',50])).entries.map(e=>e.score),[600]);
});

test('verified career aggregates distinct event discoveries only from finished verified runs of the current player',async()=>{
 const a=await run('events'),b=await run('events'),pending=await run('events'),unverified=await run('events',0),other=await run('other');
 for(const [id,seen,finished]of [[a,['T01','T02'],true],[b,['T02','T03'],true],[pending,['T04'],false],[unverified,['T05'],true],[other,['T06'],true]])await db.query('update leaderboard_runs set finished=$2,state=$3::jsonb where id=$1',[id,finished,JSON.stringify({eventState:{seen},collectedPlayers:[],endless:false})]);
 const profile=(await rpc('get_verified_game_profile',['events'])).profile;
 assert.deepEqual(profile.discoveredEvents.sort(),['T01','T02','T03']);assert.equal(profile.runs,2);
 assert.deepEqual((await rpc('get_verified_game_profile',['new-player'])).profile.discoveredEvents,[]);
});
test('event profile migration remains idempotent and limits execution to the backend service role',async()=>{
  const id=await run('events');await db.query('update leaderboard_runs set finished=true,state=$2::jsonb where id=$1',[id,JSON.stringify({eventState:{seen:['T01']},collectedPlayers:['curry'],endless:false})]);
  const before=await rpc('get_verified_game_profile',['events']);
  const migrationSql=fs.readFileSync('cloudbase/migrations/20261011210000_event_talent_unlock.sql','utf8');
  await db.exec(migrationSql);await db.exec(migrationSql);
  assert.deepEqual(await rpc('get_verified_game_profile',['events']),before);
  const permissions=await one(`select has_function_privilege('anon','get_verified_game_profile(text)','EXECUTE') as anon,has_function_privilege('authenticated','get_verified_game_profile(text)','EXECUTE') as authenticated,has_function_privilege('service_role','get_verified_game_profile(text)','EXECUTE') as backend`);
  assert.deepEqual(permissions,{anon:false,authenticated:false,backend:true});
});

test('migration leaves cumulative data and old RPC results intact; activation is explicit',async()=>{
  const id=await run();await battle(id,391);
  assert.equal((await rpc('get_ovr_leaderboard_page',[50])).entries[0].score,391);
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).enabled,false);
  assert.equal((await one('select count(*)::int n from weekly_ovr_entries')).n,0);
  await enable();await db.exec(sql);
  assert.equal((await rpc('get_ovr_leaderboard_page',[50])).entries[0].score,391);
  await battle(id,500,2); // Runs opened before activation never enter the weekly board.
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries.length,0);
});

test('one-time launch-week backfill imports original peaks, lets existing runs continue and never repeats next week',async()=>{
  const backfill=fs.readFileSync('activity/releases/weekly-ovr/backfill_first_week.sql','utf8');
  await clock('2026-10-08T00:00:00Z');
  const history=await run('history'),prior=await run('prior-week'),unverified=await run('unverified',0);
  await db.query("update leaderboard_runs set created_at='2026-10-07T00:00:00Z' where id in ($1,$2)",[history,unverified]);
  await db.query("update leaderboard_runs set created_at='2026-10-04T00:00:00Z' where id=$1",[prior]);
  await battle(history,350);await battle(history,410,2);await battle(prior,500);await battle(unverified,450);
  await db.exec("update leaderboard_entries set verified=false where puid='unverified'; update leaderboard_entries set updated_at='2026-10-08T00:00:00Z' where puid='history'");
  await clock('2026-10-10T14:41:00Z');
  await db.exec("update weekly_ovr_settings set enabled_at='2026-10-10T14:40:22Z'");
  const recent=await run('recent');await battle(recent,430);
  await db.exec(backfill);
  let page=await rpc('get_weekly_ovr_page',['current',50]);
  assert.deepEqual(page.entries.map(e=>[e.displayName,e.score,e.stage]),[['Name recent',430,1],['Name history',410,2]]);
  assert.equal((await one("select reached_at::text v from weekly_ovr_entries where puid='history'")).v,'2026-10-08 00:00:00+00');
  assert.equal((await one('select weekly_ovr_start::text v from leaderboard_runs where id=$1',[history])).v,'2026-10-04 16:00:00+00');
  const cumulative=await rpc('get_ovr_leaderboard_page',[50]);
  await db.exec(backfill);assert.deepEqual(await rpc('get_ovr_leaderboard_page',[50]),cumulative);
  await battle(history,440,3);assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries[0].score,440);
  await clock('2026-10-11T16:00:00Z');assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries.length,0);
  const archived=await rpc('get_weekly_ovr_page',['previous',50]);assert.equal(archived.entries[0].score,440);
  await assert.rejects(db.exec(backfill),/FIRST_WEEK_BACKFILL_NOT_ALLOWED/);await db.exec('rollback');
  await battle(history,480,4);assert.deepEqual((await rpc('get_weekly_ovr_page',['previous',50])).entries,archived.entries);
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries.length,0);
});

test('Beijing Monday boundary, year boundary and session timezones agree',async()=>{
  assert.equal((await one("select weekly_ovr_week('2026-10-11T15:59:59Z')::text v")).v,'2026-10-04 16:00:00+00');
  assert.equal((await one("select weekly_ovr_week('2026-10-11T16:00:00Z')::text v")).v,'2026-10-11 16:00:00+00');
  assert.equal((await one("select weekly_ovr_week('2027-01-01T00:00:00Z')::text v")).v,'2026-12-27 16:00:00+00');
  await db.exec("set timezone='America/New_York'");await enable();await clock('2026-03-02T00:00:00Z');
  const page=await rpc('get_weekly_ovr_page',['current',50]);
  assert.equal(Date.parse(page.endsAt)-Date.parse(page.startsAt),168*3600000);
  await db.exec("set timezone='UTC'");
});

test('verified battles atomically maintain both boards, peak stage and first-achieved ordering',async()=>{
  await enable();const a=await run('a'),b=await run('b');
  await battle(a,391,1);await clock('2026-10-11T15:59:59.1Z');await battle(b,391,1);
  await battle(a,390,2);await battle(a,391,3);
  const page=await rpc('get_weekly_ovr_page',['current',50]);
  assert.deepEqual(page.entries.map(e=>e.displayName),['Name a','Name b']);
  assert.equal(page.entries[0].stage,1);
  assert.equal((await rpc('get_weekly_ovr_rank',['a','current',page.weekId])).entry.rank,1);
  assert.equal((await rpc('get_ovr_leaderboard_page',[50])).entries.length,2);
  await rpc('record_game_leaderboard_battle',['a',a,911,3,3,2,0,true,391]);
  assert.equal((await one('select count(*)::int n from leaderboard_battles')).n,4);
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries[0].stage,1);
  const unverified=await run('unverified',0);await battle(unverified,9999);
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries.length,2);
});

test('new week starts empty; old runs continue saving but cannot change either weekly board',async()=>{
  await enable();const old=await run('a');await battle(old,391);
  const before=await rpc('get_weekly_ovr_page',['current',50]);
  await clock('2026-10-11T16:00:00Z');
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries.length,0);
  const archived=await rpc('get_weekly_ovr_page',['previous',50]);assert.equal(archived.entries[0].score,391);
  await battle(old,1000,2);
  assert.equal((await rpc('get_ovr_leaderboard_page',[50])).entries[0].score,1000);
  assert.equal((await rpc('get_weekly_ovr_page',['previous',50])).entries[0].score,391);
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries.length,0);
  const fresh=await run('a');await battle(fresh,200);
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries[0].score,200);
  assert.equal((await rpc('get_weekly_ovr_rank',['a','current',before.weekId])).entry.score,391);
});

test('authoritative transition commits the weekly entry once and preserves terminal legend rewards',async()=>{
  await enable();const id=await run();
  await db.query('update leaderboard_runs set state=$2 where id=$1',[id,{wins:0,losses:0,balanceRulesVersion:6}]);
  const args=['player',id,0,'battle-proof','battle',{wins:1,losses:0},{stage:1,won:true,rating:400}];
  await rpc('commit_verified_game_transition',args);await rpc('commit_verified_game_transition',args);
  assert.equal((await one('select count(*)::int n from weekly_ovr_entries')).n,1);
  assert.equal((await one('select count(*)::int n from leaderboard_battles')).n,1);
  for(let stage=2;stage<=10;stage++)await battle(id,300+stage,stage);
  await rpc('finish_game_leaderboard_run',['player',id]);await rpc('finish_game_leaderboard_run',['player',id]);
  assert.equal((await one("select score from leaderboard_entries where board='legend' and puid='player'")).score,200);
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries[0].score,400);
});

test('scheduled activation excludes pre-activation runs and does not backfill historical scores',async()=>{
  await db.exec("update weekly_ovr_settings set enabled_at='2026-10-11T16:00:00Z'");
  const old=await run('old');await battle(old,999);
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).enabled,false);
  await clock('2026-10-11T16:00:00Z');
  await battle(old,1000,2);await battle(await run('new'),200);
  const page=await rpc('get_weekly_ovr_page',['current',50]);assert.equal(page.entries.length,1);assert.equal(page.entries[0].score,200);
});

test('archive preserves exactly fifty identities, names, scores and stages; absent players stay absent',async()=>{
  await enable();
  for(let i=0;i<60;i++)await battle(await run('p'+String(i).padStart(2,'0')),500-i,1);
  const current=await rpc('get_weekly_ovr_rank',['p50','current',null]);
  assert.equal(current.entry.rank,51);assert.equal(current.entry.score,450);
  await clock('2026-10-11T16:00:00Z');
  const page=await rpc('get_weekly_ovr_page',['previous',999]);assert.equal(page.entries.length,50);
  assert.equal(page.entries[49].score,451);assert.equal(page.entries[0].displayName,'Name p00');
  assert.equal((await rpc('get_weekly_ovr_rank',['p49','previous',page.weekId])).entry.rank,50);
  assert.equal((await rpc('get_weekly_ovr_rank',['p50','previous',page.weekId])).entry,null);
  assert.equal((await rpc('get_weekly_ovr_rank',['missing','previous',page.weekId])).entry,null);
  await db.exec("update leaderboard_runs set display_name='new name'");
  assert.equal((await rpc('get_weekly_ovr_page',['previous',50])).entries[0].displayName,'Name p00');
  await rpc('close_weekly_ovr_period',[page.startsAt]);
  assert.equal((await one('select count(*)::int n from weekly_ovr_snapshots')).n,50);
});

test('first previous week is empty; archival catches up after several inactive weeks',async()=>{
  await enable();assert.equal((await rpc('get_weekly_ovr_page',['previous',50])).entries.length,0);
  await battle(await run('a'),391);
  await clock('2026-11-02T00:00:00Z');
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries.length,0);
  assert.equal((await one("select count(*)::int n from weekly_ovr_snapshots where score=391")).n,1);
  assert.equal((await rpc('get_weekly_ovr_page',['previous',50])).entries.length,0);
});

test('a weekly write failure rolls back the battle, cumulative score and run progress together',async()=>{
  await enable();const id=await run();
  await db.exec("alter table weekly_ovr_entries add constraint injected_failure check(score<100)");
  await assert.rejects(battle(id,391),/injected_failure/);
  assert.equal((await one('select count(*)::int n from leaderboard_battles')).n,0);
  assert.equal((await one('select count(*)::int n from leaderboard_entries')).n,0);
  assert.equal((await one('select battle_count from leaderboard_runs where id=$1',[id])).battle_count,0);
  await db.exec('alter table weekly_ovr_entries drop constraint injected_failure');
  await battle(id,391);assert.equal((await rpc('get_weekly_ovr_page',['current',50])).entries[0].score,391);
});

test('queued duplicate uploads and archive requests are idempotent',async()=>{
  await enable();const id=await run();
  const args=['player',id,911,1,1,0,0,true,391];
  await Promise.all(Array.from({length:10},()=>rpc('record_game_leaderboard_battle',args)));
  assert.equal((await one('select count(*)::int n from leaderboard_battles')).n,1);
  await clock('2026-10-11T16:00:00Z');
  await Promise.all(Array.from({length:10},()=>rpc('get_weekly_ovr_page',['previous',50])));
  assert.equal((await one('select count(*)::int n from weekly_ovr_snapshots')).n,1);
});

test('clients cannot mutate tables, activation or trigger functions; service reads use only guarded RPCs',async()=>{
  const rights=await one(`select has_table_privilege('authenticated','weekly_ovr_settings','UPDATE') activation,
    has_table_privilege('anon','weekly_ovr_entries','INSERT') writes,
    has_function_privilege('authenticated','get_weekly_ovr_page(text,integer)','EXECUTE') reads,
    has_function_privilege('service_role','close_weekly_ovr_period(timestamptz)','EXECUTE') close,
    has_function_privilege('service_role','get_weekly_ovr_page(text,integer)','EXECUTE') rpc`);
  assert.deepEqual(rights,{activation:false,writes:false,reads:false,close:false,rpc:true});
  await enable();await db.exec('set role service_role');
  assert.equal((await rpc('get_weekly_ovr_page',['current',50])).enabled,true);
  assert.equal((await rpc('get_weekly_ovr_rank',['a','current',null])).entry,null);
  await db.exec('reset role');
  await enable();await assert.rejects(rpc('get_weekly_ovr_page',['invalid',50]));
  await assert.rejects(rpc('get_weekly_ovr_rank',['a','current','2026-10-13']),/INVALID_WEEK/);
  await assert.rejects(rpc('get_weekly_ovr_rank',['a','current','2026-02-31']));
});

test('prepared activation and preflight scripts execute locally; repeating activation keeps the original time',async()=>{
  const enableSql=fs.readFileSync('activity/releases/weekly-ovr/enable.sql','utf8');
  await db.exec(enableSql);
  const first=await one('select enabled_at::text as v from weekly_ovr_settings');
  await db.exec(enableSql);
  assert.equal((await one('select enabled_at::text as v from weekly_ovr_settings')).v,first.v);
  await db.exec(fs.readFileSync('activity/releases/weekly-ovr/preflight.sql','utf8'));
});
