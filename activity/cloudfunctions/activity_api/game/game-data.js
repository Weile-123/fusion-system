/* 第四版球星与羁绊数据。数值为游戏策划值，不代表真实比赛统计。 */
(function (root, factory) {
  'use strict';
  const data=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=data;
  root.SupFusionGameData=data;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  // 原始球探值保留八项输入；对外卡牌数据会统一折算为六项游戏属性。
  const RAW_STAR_ROWS = [
    ['curry','斯蒂芬·库里','S','PG','勇士','three',[96,91,82,94,50,72,71,60],'超远射程'],
    ['lebron','勒布朗·詹姆斯','S','SF','湖人','drive',[84,88,96,94,86,96,88,90],'全能统治'],
    ['kobe','科比·布莱恩特','S','SG','湖人','mid',[86,95,89,87,82,88,84,72],'关键杀手'],
    ['duncan','蒂姆·邓肯','S','PF','马刺','post',[52,88,71,69,94,93,96,96],'稳固根基'],
    ['kawhi','科怀·伦纳德','S','SF','快船','def',[86,89,85,80,77,89,97,87],'死亡缠绕'],
    ['irving','凯里·欧文','A','PG','独行侠','handle',[90,89,91,96,61,82,73,57],'脚踝终结'],
    ['durant','凯文·杜兰特','S','SF','太阳','mid',[92,97,86,84,85,94,84,79],'无解投射'],
    ['jokic','尼古拉·约基奇','S','C','掘金','post',[81,90,76,95,95,96,83,96],'中轴策应'],
    ['giannis','扬尼斯·阿德托昆博','S','PF','雄鹿','drive',[66,79,97,86,88,98,94,95],'禁区冲击'],
    ['shaq','沙奎尔·奥尼尔','S','C','湖人','inside',[30,70,83,71,97,99,91,99],'篮下巨兽'],
    ['jordan','迈克尔·乔丹','S','SG','公牛','mid',[82,97,97,92,88,97,96,85],'最后一投'],
    ['wade','德维恩·韦德','A','SG','热火','drive',[72,87,95,89,74,91,90,77],'闪电突破'],
    ['harden','詹姆斯·哈登','A','SG','快船','handle',[93,87,91,94,78,88,72,69],'节奏大师'],
    ['klay','克莱·汤普森','A','SG','独行侠','three',[95,86,77,75,62,81,86,71],'接球即投'],
    ['green','德雷蒙德·格林','B','PF','勇士','def',[75,74,71,84,82,80,93,89],'防线指挥'],
    ['holiday','朱·霍勒迪','B','PG','凯尔特人','def',[82,83,78,86,67,78,92,75],'后场铁闸'],
    ['white','德里克·怀特','B','G','凯尔特人','def',[82,81,77,83,63,78,88,70],'追身封盖'],
    ['lillard','达米安·利拉德','A','PG','雄鹿','three',[94,87,88,92,62,81,72,62],'超远决胜'],
    ['tatum','杰森·塔图姆','A','SF','凯尔特人','mid',[87,89,88,85,83,88,86,83],'锋线得分'],
    ['booker','德文·布克','A','SG','太阳','mid',[88,94,86,87,72,86,78,67],'中投连击'],
    ['embiid','乔尔·恩比德','A','C','76人','post',[79,86,79,74,93,96,89,95],'低位威慑'],
    ['davis','安东尼·戴维斯','A','PF','湖人','def',[74,82,83,72,88,94,96,95],'禁区屏障'],
    ['westbrook','拉塞尔·威斯布鲁克','B','PG','掘金','drive',[70,78,94,88,70,86,77,83],'全速冲锋'],
    ['paul','克里斯·保罗','A','PG','马刺','handle',[86,92,76,97,60,75,88,63],'精准掌控'],
    ['nash','史蒂夫·纳什','A','PG','太阳','handle',[91,92,78,98,55,79,68,62],'大师传球'],
    ['rodman','丹尼斯·罗德曼','B','PF','公牛','rebound',[45,63,75,62,77,78,92,99],'篮板狂人'],
    ['gobert','鲁迪·戈贝尔','B','C','森林狼','def',[35,59,61,58,78,89,96,97],'护框专家'],
    ['anunoby','OG·阿奴诺比','C','SF','尼克斯','drive',[79,76,78,72,65,76,87,77],'侧翼防线'],
    ['caruso','亚历克斯·卡鲁索','C','G','雷霆','handle',[76,73,76,80,58,73,88,70],'拼抢先锋'],
    ['lopez','布鲁克·洛佩兹','C','C','雄鹿','three',[78,73,55,57,82,86,86,82],'高塔投射'],
    ['magic','埃尔文·约翰逊','S','PG','湖人','handle',[82,88,93,99,86,95,84,83],'魔术传球'],
    ['bird','拉里·伯德','S','SF','凯尔特人','mid',[93,96,82,91,91,92,87,92],'预言绝杀'],
    ['kareem','卡里姆·阿卜杜尔-贾巴尔','S','C','湖人','post',[38,92,78,79,99,99,94,97],'天勾'],
    ['hakeem','哈基姆·奥拉朱旺','S','C','火箭','def',[28,88,82,78,98,98,99,98],'梦幻脚步'],
    ['dirk','德克·诺维茨基','S','PF','独行侠','mid',[93,98,79,82,94,94,78,90],'金鸡独立'],
    ['garnett','凯文·加内特','S','PF','凯尔特人','def',[76,91,84,78,96,95,98,98],'全域协防'],
    ['pippen','斯科蒂·皮蓬','A','SF','公牛','def',[77,87,92,91,78,90,98,86],'锋线封锁'],
    ['rayallen','雷·阿伦','A','SG','凯尔特人','three',[96,89,80,83,60,82,77,64],'底角绝命'],
    ['pierce','保罗·皮尔斯','A','SF','凯尔特人','mid',[89,93,84,87,84,88,80,76],'真理单打'],
    ['iverson','阿伦·艾弗森','A','PG','76人','drive',[84,91,98,97,54,89,71,55],'变向风暴'],
    ['kidd','贾森·基德','A','PG','篮网','handle',[86,88,80,98,70,78,93,88],'全场视野'],
    ['malone','卡尔·马龙','A','PF','爵士','post',[32,88,84,73,97,96,88,95],'强硬终结'],
    ['stockton','约翰·斯托克顿','A','PG','爵士','handle',[87,89,75,99,55,72,91,60],'挡拆手术刀'],
    ['bosh','克里斯·波什','A','PF','热火','mid',[83,88,80,76,89,93,84,88],'空间内线'],
    ['parker','托尼·帕克','B','PG','马刺','handle',[72,92,94,95,55,88,73,55],'陀螺突破'],
    ['ginobili','马努·吉诺比利','B','SG','马刺','drive',[86,88,93,91,62,86,82,65],'欧洲步'],
    ['pau','保罗·加索尔','B','PF','湖人','post',[75,91,72,82,94,94,87,94],'高位策应'],
    ['benwallace','本·华莱士','B','C','活塞','rebound',[20,50,66,55,78,85,99,100],'禁区铁门'],
    ['mutombo','迪肯贝·穆托姆博','B','C','掘金','def',[15,45,50,48,75,88,99,98],'摇指封盖'],
    ['howard','德怀特·霍华德','A','C','魔术','inside',[35,62,88,67,90,99,96,99],'魔兽空接'],
    ['carter','文斯·卡特','A','SG','猛龙','drive',[88,91,97,88,72,95,76,70],'世纪扣篮'],
    ['melo','卡梅隆·安东尼','A','SF','掘金','mid',[83,96,88,84,91,91,72,72],'三威胁'],
    ['butler','吉米·巴特勒','A','SF','热火','drive',[78,91,92,88,82,90,95,82],'硬仗模式'],
    ['george','保罗·乔治','A','SF','快船','three',[90,89,88,86,75,87,94,82],'攻防侧翼'],
    ['bowen','布鲁斯·鲍文','C','SF','马刺','def',[86,72,65,68,55,70,96,68],'贴身压迫'],
    ['battier','肖恩·巴蒂尔','C','SF','热火','def',[87,77,70,74,68,76,95,74],'遮眼防守'],
    ['horry','罗伯特·霍里','C','PF','湖人','three',[88,82,72,74,76,85,86,82],'大心脏'],
    ['chandler','泰森·钱德勒','B','C','独行侠','rebound',[10,45,65,50,76,91,94,98],'冠军护框'],
    ['korver','凯尔·科沃尔','C','SG','老鹰','three',[97,84,62,73,48,68,70,52],'定点神射'],
    ['artest','罗恩·阿泰斯特','B','SF','湖人','def',[77,82,83,80,85,88,98,84],'强硬锁防'],
    // 第三版扩充球员：优先覆盖真实王朝、经典搭档、宿敌、选秀届与传承关系。
    ['tmac','特雷西·麦克格雷迪','A','SF','魔术','mid',[86,96,94,91,82,91,75,69],'干拔时刻'],
    ['doncic','卢卡·东契奇','S','PG','独行侠','handle',[90,94,91,99,88,94,79,88],'节奏掌控'],
    ['isiah','伊赛亚·托马斯','S','PG','活塞','handle',[84,92,94,98,62,87,86,58],'微笑刺客'],
    ['dumars','乔·杜马斯','A','SG','活塞','mid',[87,88,82,88,65,82,96,66],'沉默锁链'],
    ['laimbeer','比尔·兰比尔','B','C','活塞','three',[77,73,55,66,88,89,94,94],'强硬禁区'],
    ['robinson','大卫·罗宾逊','S','C','马刺','def',[48,86,88,79,96,98,98,99],'海军上将'],
    ['ewing','帕特里克·尤因','S','C','尼克斯','inside',[46,90,80,72,96,98,95,97],'纽约支柱'],
    ['iguodala','安德烈·伊戈达拉','B','SF','勇士','def',[79,77,84,86,75,82,94,82],'死亡拼图'],
    ['harper','罗恩·哈珀','B','PG','公牛','handle',[73,79,84,83,70,82,91,77],'高大后卫'],
    ['longley','卢克·朗利','C','C','公牛','inside',[28,65,48,60,82,87,82,86],'中路屏障'],
    ['fisher','德里克·费舍尔','B','PG','湖人','three',[88,80,68,82,54,72,82,60],'关键零点四'],
    ['fox','里克·福克斯','C','SF','湖人','mid',[80,75,72,75,68,76,88,72],'侧翼粘合'],
    ['byron_scott','拜伦·斯科特','B','SG','湖人','three',[89,84,85,82,61,81,78,60],'快攻终结'],
    ['worthy','詹姆斯·沃西','A','SF','湖人','drive',[66,88,95,83,84,94,82,77],'大赛眼镜蛇'],
    ['ac_green','AC·格林','C','PF','湖人','def',[58,72,68,65,80,84,85,92],'铁人篮板'],
    ['griffin','布雷克·格里芬','A','PF','快船','drive',[72,83,94,80,88,97,76,90],'暴力起飞'],
    ['deandre','德安德烈·乔丹','B','C','快船','inside',[20,48,71,55,80,95,91,98],'空接终点'],
    ['mchale','凯文·麦克海尔','S','PF','凯尔特人','inside',[36,92,78,73,98,98,94,96],'低位万花筒'],
    ['parish','罗伯特·帕里什','A','C','凯尔特人','inside',[30,83,69,62,92,94,91,96],'酋长镇守'],
    ['love','凯文·乐福','A','PF','骑士','three',[88,85,68,80,89,88,76,96],'长传炮台'],
    ['reggie','雷吉·米勒','S','SG','步行者','three',[97,88,82,83,56,79,74,58],'米勒时刻'],
    ['amare','阿马雷·斯塔德迈尔','A','PF','太阳','inside',[58,85,95,72,88,98,73,88],'太阳风暴'],
    ['marion','肖恩·马里昂','A','SF','太阳','drive',[76,75,89,77,82,89,95,94],'骇客全能'],
    ['murray','贾马尔·穆雷','A','PG','掘金','mid',[89,94,88,91,60,83,74,60],'季后赛升温'],
    ['aaron_gordon','阿隆·戈登','B','PF','掘金','drive',[74,77,91,74,82,93,88,91],'高空协防'],
    ['wilkins','多米尼克·威尔金斯','S','SF','老鹰','drive',[74,91,99,85,83,98,78,82],'人类电影精华'],
    ['wilt','威尔特·张伯伦','S','C','湖人','inside',[20,78,91,73,99,100,95,100],'百分神迹'],
    ['russell','比尔·拉塞尔','S','C','凯尔特人','def',[20,68,77,72,90,93,100,100],'冠军基石'],
    ['oscar','奥斯卡·罗伯特森','S','PG','雄鹿','handle',[82,93,91,98,84,92,86,92],'三双先驱'],
    ['west','杰里·韦斯特','S','SG','湖人','mid',[91,96,91,94,65,88,91,70],'标志原型'],
    ['baylor','埃尔金·贝勒','S','SF','湖人','drive',[69,91,97,87,86,96,80,87],'空中先驱'],
    ['moses','摩西·马龙','S','C','76人','inside',[22,78,76,67,96,99,91,100],'进攻篮板王'],
    ['barkley','查尔斯·巴克利','S','PF','太阳','drive',[69,88,92,86,92,98,84,98],'空中飞猪'],
    ['drexler','克莱德·德雷克斯勒','A','SG','开拓者','drive',[80,88,96,87,75,93,84,85],'滑翔机'],
    ['mullin','克里斯·穆林','A','SF','勇士','mid',[92,94,78,84,72,85,76,67],'左手神射'],
    ['payton','加里·佩顿','A','PG','超音速','handle',[83,88,85,94,68,84,98,72],'手套压迫'],
    ['kemp','肖恩·坎普','A','PF','超音速','inside',[42,78,96,70,87,98,83,96],'雨人暴扣'],
    ['penny','安芬尼·哈达威','A','PG','魔术','handle',[83,90,93,97,76,90,84,74],'便士魔法'],
    ['grant_hill','格兰特·希尔','A','SF','活塞','drive',[78,90,96,92,82,92,87,89],'全能前锋'],
    ['yao','姚明','A','C','火箭','inside',[70,91,66,73,96,97,91,94],'长城天勾'],
    ['billups','昌西·比卢普斯','A','PG','活塞','handle',[89,88,82,96,66,82,93,68],'大心脏控卫'],
    ['rip','理查德·汉密尔顿','B','SG','活塞','mid',[84,91,83,81,59,84,82,60],'无球永动'],
    ['rasheed','拉希德·华莱士','A','PF','活塞','def',[82,86,73,78,91,90,94,92],'怒吼协防'],
    ['webber','克里斯·韦伯','A','PF','国王','handle',[74,91,84,92,94,94,84,94],'高位华章'],
    ['peja','佩贾·斯托贾科维奇','A','SF','国王','three',[96,90,72,78,68,82,73,65],'国王神射'],
    ['rondo','拉简·隆多','B','PG','凯尔特人','handle',[66,80,88,96,61,75,93,77],'季后赛指挥'],
    ['erving','朱利叶斯·欧文','S','SF','76人','drive',[73,91,99,88,88,98,87,91],'J博士飞行'],
    ['brunson','杰伦·布伦森','A','PG','尼克斯','mid',[86,94,91,94,63,85,79,59],'低重心脚步'],
    ['shai','谢伊·吉尔杰斯-亚历山大','S','SG','雷霆','drive',[85,95,98,96,76,94,93,76],'节奏切割'],
    ['edwards','安东尼·爱德华兹','A','SG','森林狼','drive',[86,89,98,90,74,95,88,83],'蚁人升空'],

    // SSR 异名卡：与基础球员共享羁绊身份；成长上限由游戏模式决定。
    ['king_lebron','天选·詹姆斯','SSR','SF','巅峰传奇','drive',[99,108,125,110,121,112],'霸王踏步','lebron'],
    ['air_jordan','GOAT·乔丹','SSR','SG','巅峰传奇','mid',[94,125,121,106,113,120],'神之领域','jordan'],
    ['mamba_kobe','黑曼巴·科比','SSR','SG','巅峰传奇','mid',[108,120,117,108,108,117],'曼巴时刻','kobe'],
    ['chef_curry','三分王·库里','SSR','PG','巅峰传奇','three',[125,118,111,118,99,91],'三分引力','curry'],
    ['diesel_shaq','大鲨鱼·奥尼尔','SSR','C','巅峰传奇','inside',[85,94,97,90,128,125],'禁区粉碎','shaq'],
    ['stone_duncan','石佛·邓肯','SSR','PF','巅峰传奇','def',[88,104,96,91,122,128],'石佛镇守','duncan'],
    ['showtime_magic','魔术师·约翰逊','SSR','PG','巅峰传奇','handle',[91,104,110,125,111,103],'表演时刻','magic'],
    ['reaper_durant','死神·杜兰特','SSR','SF','巅峰传奇','mid',[116,122,115,109,112,105],'死神终结','durant']
  ];

  const ATTRS=['three','mid','drive','handle','inside','def'];
  const LABELS={three:'三分',mid:'中投',drive:'突破',handle:'控球',inside:'篮下',def:'防守'};
  const COMBAT_LABELS={shooting:'投射威胁',creation:'持球创造',finishing:'禁区终结',perimeterStop:'外线限制',rimStop:'护框强度'};
  const ATTR_TO_COMBAT={
    three:{shooting:1},mid:{shooting:.7,creation:.3},drive:{creation:.4,finishing:.6},
    handle:{creation:1},inside:{finishing:1},def:{perimeterStop:.5,rimStop:.5}
  };
  function mapToCombat(values){
    const result={};
    for(const [attr,value] of Object.entries(values||{})){
      if(attr==='all'){for(const dim of Object.keys(COMBAT_LABELS))result[dim]=(result[dim]||0)+value;continue}
      for(const [dim,weight] of Object.entries(ATTR_TO_COMBAT[attr]||{}))result[dim]=(result[dim]||0)+value*weight;
    }
    return result;
  }
  function combatText(values,unit='%'){
    return Object.entries(values||{}).filter(([,value])=>value).map(([dim,value])=>
      `${COMBAT_LABELS[dim]} ${value>0?'+':''}${Math.round(value*10)/10}${unit}`).join('、');
  }
  // 同级角色先共享强度预算，再按原始强弱项分配；平衡型球员使用更平缓的曲线。
  const TIER_RULES={
    C:{min:25,max:90,main:78,profile:[88,75,60,47,37,28],balanced:[78,68,61,55,49,44],rawMean:74},
    B:{min:35,max:91,main:79,profile:[87,78,71,63,53,43],balanced:[80,74,69,64,59,53],rawMean:81},
    A:{min:40,max:96,main:86,profile:[94,86,78,70,62,50],balanced:[88,83,78,74,69,62],rawMean:85},
    S:{min:45,max:103,main:94,profile:[99,93,86,77,67,54],balanced:[96,92,88,83,77,70],rawMean:83,talent:4},
    SSR:{min:85,max:128,main:120}
  };
  const BEST_MAP={post:'inside',inside:'inside',rebound:'def'};
  function allocateAttributes(rawValues,tier,best){
    if(tier==='SSR')return rawValues.slice(0,6);
    const rule=TIER_RULES[tier],bestIndex=ATTRS.indexOf(best);
    const indices=ATTRS.map((_,index)=>index).sort((a,b)=>b===bestIndex?1:a===bestIndex?-1:rawValues[b]-rawValues[a]||a-b);
    const spread=Math.max(...rawValues)-Math.min(...rawValues);
    const specialization=Math.max(0,Math.min(1,(spread-12)/28));
    const quality=Math.max(-3,Math.min(3,(rawValues.reduce((sum,value)=>sum+value,0)/6-rule.rawMean)*.2));
    const values=Array(6);
    indices.forEach((index,rank)=>{
      const target=rule.balanced[rank]*(1-specialization)+rule.profile[rank]*specialization;
      const detail=Math.max(-2,Math.min(2,(rawValues[index]-rule.rawMean)*.12));
      values[index]=Math.max(rule.min,Math.min(rule.max,Math.round(target+quality+detail)));
    });
    values[bestIndex]=Math.max(rule.main,values[bestIndex]);
    return values;
  }
  const S_TIER_IDS=new Set(['curry','lebron','kobe','duncan','durant','shaq','jordan','magic','bird','kareem','hakeem','wilt','russell','harden']);
  const A_TIER_IDS=new Set(['jokic','kawhi','giannis','dirk','garnett','doncic','isiah','robinson','ewing','mchale','reggie','wilkins','oscar','west','baylor','moses','barkley','erving','shai','wade','iverson','nash','paul','kidd','stockton','malone','pippen','davis','embiid','howard','tmac','rayallen']);
  const C_TIER_IDS=new Set([...RAW_STAR_ROWS.filter(row=>row[2]==='C').map(row=>row[0]),'fisher']);
  function reassignedTier(row){
    if(row[2]==='SSR')return 'SSR';
    if(S_TIER_IDS.has(row[0]))return 'S';
    if(A_TIER_IDS.has(row[0]))return 'A';
    if(C_TIER_IDS.has(row[0]))return 'C';
    return 'B';
  }
  const ATTRIBUTE_OVERRIDES={durant:{drive:90,inside:84}};
  const STAR_ROWS=RAW_STAR_ROWS.map(row=>{
    const raw=row[6],tier=reassignedTier(row),best=BEST_MAP[row[5]]||row[5];
    const six=tier==='SSR'?raw.slice(0,6):allocateAttributes(
      [raw[0],raw[1],raw[2],raw[3],Math.round(raw[4]*.45+raw[5]*.55),Math.round(raw[6]*.72+raw[7]*.28)],tier,best);
    for(const [attr,value] of Object.entries(ATTRIBUTE_OVERRIDES[row[0]]||{}))six[ATTRS.indexOf(attr)]=value;
    return [row[0],row[1],tier,row[3],row[4],best,six,row[7],row[8]||null];
  });
  const S_TALENT_DETAILS={
    curry:{slots:['three'],stats:{three:14,def:-4},description:'安排在三分槽时，三分 +14%，防守 -4%'},
    lebron:{slots:['drive','handle'],all:6,description:'安排在突破槽或控球槽时，全属性 +6%'},
    kobe:{slots:['mid'],stats:{mid:12},description:'安排在中投槽时，中投 +12%'},
    duncan:{slots:['inside','def'],slotEffects:{inside:{stats:{inside:11}},def:{stats:{def:6}}},description:'安排在篮下槽时，篮下 +11%；安排在防守槽时，防守 +6%'},
    durant:{slots:['three','mid'],slotEffects:{three:{stats:{three:10},all:4},mid:{stats:{mid:8}}},description:'安排在三分槽时，三分 +10%、全属性 +4%；安排在中投槽时，中投 +8%'},
    shaq:{slots:['inside'],stats:{inside:16},description:'安排在篮下槽时，篮下 +16%'},
    jordan:{slots:['mid','drive'],slotEffects:{mid:{stats:{mid:10},all:5},drive:{stats:{drive:10}}},description:'安排在中投槽时，中投 +10%、全属性 +5%；安排在突破槽时，突破 +10%'},
    harden:{slots:['handle','three'],slotEffects:{handle:{stats:{handle:10},strategyStats:{outside:{three:5}}},three:{stats:{three:6}}},description:'安排在控球槽时，控球 +10%，采用外线拉开时三分再 +5%；安排在三分槽时，三分 +6%'},
    magic:{slots:['handle','drive'],slotEffects:{handle:{stats:{handle:6},postBattleCash:2,recruitDiscount:1},drive:{stats:{drive:6},postBattleCash:2}},description:'安排在控球槽时，控球 +6%、每次战后 +2 奖金、付费招募 -1；安排在突破槽时，突破 +6%、每次战后 +2 奖金'},
    bird:{slots:['mid','three'],slotEffects:{mid:{all:6},three:{stats:{three:8}}},description:'安排在中投槽时，全属性 +6%；安排在三分槽时，三分 +8%'},
    kareem:{slots:['inside','def'],slotEffects:{inside:{stats:{inside:12}},def:{stats:{def:8,three:-4}}},description:'安排在篮下槽时，篮下 +12%；安排在防守槽时，防守 +8%、三分 -4%'},
    hakeem:{slots:['def','inside'],slotEffects:{def:{stats:{def:10}},inside:{stats:{inside:5},postBattleCash:2}},description:'安排在防守槽时，防守 +10%；安排在篮下槽时，篮下 +5%、每次战后 +2 奖金'},
    wilt:{slots:['inside'],stats:{inside:14,handle:-4},description:'安排在篮下槽时，篮下 +14%，控球 -4%'},
    russell:{slots:['def'],stats:{def:12},description:'安排在防守槽时，防守 +12%'}
  };
  // SSR 参考高稀有角色的双职责设计：主槽提供 22%–35% 专项强化，
  // 再以 8%–12% 全属性、战术条件或经济效果形成不同构筑方向。
  const SSR_TALENT_DETAILS={
    king_lebron:{slots:['drive','handle'],slotEffects:{drive:{stats:{drive:25},all:12},handle:{stats:{handle:18},all:10}},description:'安排在突破槽时，突破 +25%、全属性 +12%；安排在控球槽时，控球 +18%、全属性 +10%'},
    air_jordan:{slots:['mid','drive'],slotEffects:{mid:{stats:{mid:30},all:12},drive:{stats:{drive:30},all:12}},description:'安排在中投槽时，中投 +30%、全属性 +12%；安排在突破槽时，突破 +30%、全属性 +12%'},
    mamba_kobe:{slots:['mid','drive'],slotEffects:{mid:{stats:{mid:28},all:10,strategyStats:{outside:{mid:10}}},drive:{stats:{drive:26},all:10,strategyStats:{drive:{mid:10}}}},description:'安排在中投槽时，中投 +28%、全属性 +10%，采用外线拉开时中投再 +10%；安排在突破槽时，突破 +26%、全属性 +10%，采用突破冲筐时中投再 +10%'},
    chef_curry:{slots:['three','handle'],slotEffects:{three:{stats:{three:35},all:10,strategyStats:{outside:{handle:12}}},handle:{stats:{three:20,handle:20},all:8}},description:'安排在三分槽时，三分 +35%、全属性 +10%，采用外线拉开时控球再 +12%；安排在控球槽时，三分与控球各 +20%、全属性 +8%'},
    diesel_shaq:{slots:['inside','def'],slotEffects:{inside:{stats:{inside:35},all:10},def:{stats:{inside:18,def:18},all:8}},description:'安排在篮下槽时，篮下 +35%、全属性 +10%；安排在防守槽时，篮下与防守各 +18%、全属性 +8%'},
    stone_duncan:{slots:['def','inside'],slotEffects:{def:{stats:{def:35},all:10,strategyStats:{collapse:{inside:12}}},inside:{stats:{inside:20,def:20},all:8}},description:'安排在防守槽时，防守 +35%、全属性 +10%，采用护框收缩时篮下再 +12%；安排在篮下槽时，篮下与防守各 +20%、全属性 +8%'},
    showtime_magic:{slots:['handle','drive'],slotEffects:{handle:{stats:{handle:22},all:8,postBattleCash:3,recruitDiscount:1},drive:{stats:{drive:20},all:10,postBattleCash:2}},description:'安排在控球槽时，控球 +22%、全属性 +8%、每次战后 +3 奖金、付费招募 -1；安排在突破槽时，突破 +20%、全属性 +10%、每次战后 +2 奖金'},
    reaper_durant:{slots:['mid','three'],slotEffects:{mid:{stats:{mid:28},all:12},three:{stats:{three:26},all:12}},description:'安排在中投槽时，中投 +28%、全属性 +12%；安排在三分槽时，三分 +26%、全属性 +12%'}
  };
  // A/B/C 普通球员的槽位天赋：数值由职责类型决定，
  // 稀有度差异由基础属性与获取成本承担。模板包含单项、双项与经济效果。
  const ABC_TALENT_TEMPLATES={
    three:{stats:{three:6},description:'安排在三分槽时，三分 +6%'},
    mid:{stats:{mid:6},description:'安排在中投槽时，中投 +6%'},
    drive:{stats:{drive:6},description:'安排在突破槽时，突破 +6%'},
    handle:{stats:{},postBattleCash:1,description:'安排在控球槽时，每次战后额外获得 1 奖金'},
    inside:{stats:{inside:10},description:'安排在篮下槽时，篮下 +10%'},
    def:{stats:{def:5,handle:5},description:'安排在防守槽时，防守 +5%，控球 +5%'}
  };
  function convertTalentBranch(source){
    const {stats,all,strategyStats,description,...rest}=source;
    return {...rest,dimensions:mapToCombat(stats),allDimensions:all||0,
      strategyDimensions:Object.fromEntries(Object.entries(strategyStats||{}).map(([strategy,values])=>[strategy,mapToCombat(values)]))};
  }
  function describeTalentBranch(effect){
    const parts=[];
    if(effect.allDimensions)parts.push(`战力五维 +${effect.allDimensions}%`);
    if(Object.keys(effect.dimensions||{}).length)parts.push(combatText(effect.dimensions));
    for(const [strategy,values] of Object.entries(effect.strategyDimensions||{})){
      const name={outside:'外线拉开',drive:'突破冲筐',collapse:'护框收缩'}[strategy];
      parts.push(`采用${name}时${combatText(values)}`);
    }
    if(effect.postBattleCash)parts.push(`每次战后 +${effect.postBattleCash} 奖金`);
    if(effect.winCash)parts.push(`胜利奖金 +${effect.winCash}`);
    if(effect.recruitDiscount)parts.push(`付费招募 -${effect.recruitDiscount} 奖金`);
    return parts.join('、');
  }
  const TALENT_DETAILS=Object.fromEntries(STAR_ROWS.map(row=>{
    const id=row[0],tier=row[2],attr=row[5];
    const source=tier==='S'?S_TALENT_DETAILS[id]:tier==='SSR'?SSR_TALENT_DETAILS[id]:{slots:[attr],...ABC_TALENT_TEMPLATES[attr]};
    const effect=convertTalentBranch(source);
    if(source.slotEffects){
      effect.slotEffects=Object.fromEntries(Object.entries(source.slotEffects).map(([slot,branch])=>[slot,convertTalentBranch(branch)]));
    }
    effect.description=(source.slotEffects?Object.entries(effect.slotEffects).map(([slot,branch])=>
      `安排在${LABELS[slot]}槽时，${describeTalentBranch({...effect,...branch})}`).join('；')
      :`安排在${effect.slots.map(slot=>LABELS[slot]).join('或')}槽时，${describeTalentBranch(effect)}`);
    return [id,{attr,...effect}];
  }));
  function makeBond(id,name,ids,stats,extras={}){
    const dimensions=mapToCombat(stats);
    const effect={dimensions,winCash:extras.winCash||0,stageCash:extras.stageCash||0,freeRecruit:extras.freeRecruit||0};
    if(extras.winHeal){effect.winHeal=extras.winHeal;effect.healEveryWins=extras.healEveryWins}
    const parts=[combatText(dimensions)];
    if(effect.winCash)parts.push('胜利奖金 +'+effect.winCash);
    if(effect.stageCash)parts.push('每关奖金 +'+effect.stageCash);
    if(effect.freeRecruit)parts.push('每关免费招募 +'+effect.freeRecruit);
    if(effect.winHeal)parts.push('羁绊激活期间每累计 '+effect.healEveryWins+' 胜恢复 '+effect.winHeal+' 点生命');
    const first=Object.entries(stats)[0]||['three',0];
    return {id,name,ids,attr:first[0],gain:first[1],effect,chainId:extras.chainId||null,chainLevel:extras.chainLevel||0,description:parts.join(' · ')};
  }
  const B=makeBond;
  const LEGACY_SYNERGIES = [
    // Recovery member constraints are internal design requirements, not player-facing rules.
    B('royal_recovery','王者续航',['jordan','lebron','shaq'],{mid:1,drive:1,inside:1},{winHeal:1,healEveryWins:2}),
    B('purple_gold_recovery','紫金薪火',['magic','worthy','byron_scott'],{handle:2,mid:1},{winHeal:1,healEveryWins:3}),
    B('champion_recovery','冠军拼图',['horry','fisher','battier'],{def:2},{winHeal:1,healEveryWins:4}),
    // 44 组双人羁绊：优先真实搭档、宿敌、传承与同队关系。
    B('splash','水花兄弟',['curry','klay'],{three:3,handle:1},{stageCash:1}),
    B('warrior_brain','勇士轴心',['curry','green'],{handle:4,def:3}),
    B('ok_combo','紫金OK',['kobe','shaq'],{inside:3,mid:1},{winCash:1,chainId:'ok_lakers',chainLevel:1}),
    B('mamba_pau','冠军内外线',['kobe','pau'],{inside:4,mid:3}),
    B('laker_twin','湖人双核',['lebron','davis'],{inside:2,def:1},{stageCash:1}),
    B('buck_champs','雄鹿冠军组',['giannis','holiday'],{drive:4,def:3}),
    B('celtic_guards','绿军双闸',['holiday','white'],{handle:3,def:4}),
    B('buck_stars','雄鹿双星',['lillard','giannis'],{three:2,drive:2},{winCash:1}),
    B('phoenix_blades','太阳双刃',['durant','booker'],{mid:6,three:1}),
    B('process_battle','费城硬仗',['embiid','butler'],{inside:4,def:3}),
    B('wolves_core','狼群内外',['edwards','gobert'],{drive:4,def:3}),
    B('knicks_core','纽约双核',['anunoby','brunson'],{mid:3,def:4}),
    B('lake_show','湖人火花',['lebron','caruso'],{handle:3,def:4}),
    B('buck_towers','密城双塔',['giannis','lopez'],{inside:4,def:3}),
    B('pick_roll','挡拆教科书',['stockton','malone'],{handle:2,inside:2},{stageCash:1}),
    B('spurs_heritage','圣城锋线传承',['bowen','kawhi'],{three:3,def:5}),
    B('heat_shield','热火侧翼屏障',['lebron','battier'],{drive:3,def:4}),
    B('mavs_wall','达拉斯冠军内线',['dirk','chandler'],{inside:4,def:3}),
    B('cavs_arc','克城火力网',['lebron','korver'],{three:4,handle:3}),
    B('laker_tough','洛城硬仗',['kobe','artest'],{mid:3,def:4}),
    B('wallace_brothers','华莱士双塔',['benwallace','rasheed'],{inside:3,def:5}),
    B('sixers_final','费城总决赛双核',['iverson','mutombo'],{drive:4,def:4}),
    B('magic_heritage','魔术一号传承',['penny','howard'],{handle:4,inside:4}),
    B('buck_origin','雄鹿冠军起点',['oscar','kareem'],{handle:4,inside:4}),
    B('lake_pioneers','湖人远古双翼',['west','baylor'],{mid:4,drive:4}),
    B('philly_mentors','费城内线传承',['barkley','moses'],{inside:5,def:3}),
    B('rocket_reunion','休城老友',['drexler','hakeem'],{drive:4,def:4}),
    B('warrior_old_days','勇士旧梦',['mullin','webber'],{mid:4,handle:3}),
    B('sonics_duo','手套与雨人',['payton','kemp'],{handle:3,inside:4,def:2}),
    B('duke_wings','全能锋线传承',['grant_hill','tmac'],{mid:4,drive:4}),
    B('yao_tmac','姚麦组合',['yao','tmac'],{mid:2,inside:2},{winCash:1}),
    B('pistons_backcourt','活塞后场双核',['billups','rip'],{handle:4,mid:4}),
    B('kings_duo','国王双核',['webber','peja'],{handle:4,three:4}),
    B('rondo_truth','波士顿新旧指挥',['rondo','pierce'],{handle:4,mid:3}),
    B('fo_fo_fo','费城冠军双核',['erving','moses'],{drive:4,inside:4}),
    B('thunder_mentor','雷霆师徒',['shai','paul'],{handle:4,drive:4}),
    B('showtime_pair','表演时刻',['magic','kareem'],{handle:2,inside:2},{stageCash:1,chainId:'showtime_lakers',chainLevel:1}),
    B('mavs_origin','达拉斯双星',['dirk','nash'],{mid:2,handle:2},{stageCash:1}),
    B('magic_bird','魔鸟争霸',['magic','bird'],{handle:4,mid:4}),
    B('jordan_kobe','飞人传承',['jordan','kobe'],{mid:4,drive:4}),
    B('bad_boys_backcourt','坏孩子双枪',['isiah','dumars'],{handle:2,def:2},{winCash:1,chainId:'bad_boys',chainLevel:1}),
    B('finals_94','九四中锋决战',['hakeem','ewing'],{inside:4,def:4}),
    B('mavs_new_core','独行侠双核',['doncic','irving'],{handle:4,mid:4}),
    B('nets_flight','篮网飞翼',['kidd','carter'],{handle:2,drive:2},{winCash:1}),

    // 17 组三人羁绊。
    B('thunder_three','雷霆三少',['durant','westbrook','harden'],{drive:4,three:3,handle:2},{winCash:1,chainId:'thunder_three',chainLevel:2}),
    B('heat_big_three','南海岸三巨头',['lebron','wade','bosh'],{drive:4,inside:3,def:2},{stageCash:1,chainId:'heat_big_three',chainLevel:2}),
    B('celtic_big_three','绿军三巨头',['pierce','garnett','rayallen'],{mid:3,three:3,def:3},{winCash:1,chainId:'celtic_2008',chainLevel:2}),
    B('bull_triangle','公牛铁三角',['jordan','pippen','rodman'],{def:4,mid:3,drive:2},{winCash:1,chainId:'bulls_dynasty',chainLevel:2}),
    B('gdp','GDP',['duncan','parker','ginobili'],{inside:3,handle:3,def:4},{stageCash:1}),
    B('nets_big_three','篮网三巨头',['durant','harden','irving'],{mid:3,three:3,handle:2},{winCash:1}),
    B('lob_city','空接之城',['paul','griffin','deandre'],{handle:3,drive:3,inside:3},{winCash:1,chainId:'lob_city',chainLevel:2}),
    B('celtic_dynasty','凯尔特人王朝',['bird','mchale','parish'],{mid:3,inside:3,def:4},{stageCash:1,chainId:'celtic_80s',chainLevel:2}),
    B('ok3','OK3',['westbrook','george','melo'],{drive:3,mid:3,three:2},{winCash:1}),
    B('mamba_students','曼巴门徒',['kobe','irving','tatum'],{mid:4,handle:3,drive:2},{stageCash:1}),
    B('cavs_big_three','骑士三巨头',['lebron','irving','love'],{drive:3,three:3,inside:2},{stageCash:1}),
    B('era_shooters','划时代射手',['reggie','rayallen','curry'],{three:6,mid:3},{stageCash:1}),
    B('seven_seconds','7秒进攻',['nash','amare','marion'],{handle:3,inside:3,def:2},{stageCash:1,chainId:'seven_seconds',chainLevel:2}),
    B('nuggets_core','掘金三核',['jokic','murray','aaron_gordon'],{handle:3,mid:3,inside:4},{stageCash:1}),
    B('scoring_kaleidoscope','万花筒',['kobe','melo','durant'],{mid:4,three:2,drive:3},{winCash:1}),
    B('floor_generals','球场指挥官',['paul','kidd','nash'],{handle:5,mid:2,def:2},{winCash:1}),
    B('violent_dunkers','暴力扣将',['wilkins','carter','griffin'],{drive:5,inside:4},{winCash:1}),

    // 15 组四人羁绊。“香蕉船兄弟”替代错误的“03黄金一代”命名，保留用户指定成员。
    B('four_shooting_guards','四大分位',['kobe','tmac','carter','iverson'],{mid:4,drive:4,handle:2,three:2},{winCash:2}),
    B('banana_boat','香蕉船兄弟',['lebron','wade','paul','melo'],{drive:3,handle:2,mid:3,inside:2},{stageCash:3}),
    B('draft_96','96黄金一代',['kobe','iverson','nash','rayallen'],{three:4,handle:3,drive:3,mid:3},{freeRecruit:1}),
    B('european_kings','欧洲天王',['dirk','pau','jokic','doncic'],{mid:4,handle:3,inside:4,three:2},{freeRecruit:1}),
    B('bad_boys','坏孩子军团',['isiah','dumars','laimbeer','rodman'],{def:5,handle:2,inside:2,mid:2},{winCash:2,chainId:'bad_boys',chainLevel:2}),
    B('four_centers','四大中锋',['hakeem','shaq','robinson','ewing'],{inside:8,def:8,mid:3}),
    B('four_great_shooters','四大神射',['curry','reggie','klay','peja'],{three:6,mid:3,handle:2},{stageCash:2}),
    B('bucks_system','密城攻防体系',['giannis','lillard','holiday','lopez'],{inside:4,drive:3,def:3,three:2},{winCash:2}),
    B('spurs_pillars','圣城四柱',['duncan','kawhi','robinson','parker'],{def:5,inside:3,mid:2,handle:1},{winCash:2}),
    B('versatile_forwards','全能大前锋',['giannis','garnett','barkley','lebron'],{inside:3,drive:3,def:3,handle:2},{winCash:2}),
    B('lakers_generations','湖人四代核心',['magic','kareem','west','baylor'],{handle:3,inside:3,mid:3,drive:3},{stageCash:2}),
    B('celtics_pillars','绿军四代基石',['bird','russell','mchale','garnett'],{def:5,inside:3,mid:3,three:1},{stageCash:2}),
    B('scoring_legends','锋卫得分王',['jordan','wilkins','erving','durant'],{mid:3,drive:4,three:2,inside:2},{winCash:2}),
    B('rhythm_creators','节奏掌控者',['shai','oscar','harden','doncic'],{handle:5,drive:3,mid:3,three:1},{winCash:2}),
    B('paint_dominators','禁区统治者',['wilt','russell','moses','kareem'],{inside:9,def:8,mid:3}),

    // 5 组五人终局羁绊。
    B('death_lineup','死亡五小',['curry','klay','iguodala','durant','green'],{three:5,handle:3,def:4,mid:2,drive:1},{freeRecruit:2}),
    B('bulls_dynasty','公牛王朝',['harper','jordan','pippen','rodman','longley'],{def:6,mid:4,drive:3,handle:2},{stageCash:4,chainId:'bulls_dynasty',chainLevel:3}),
    B('ok_dynasty','OK王朝',['fisher','kobe','fox','horry','shaq'],{inside:6,mid:5,three:4,def:3},{winCash:3,chainId:'ok_lakers',chainLevel:3}),
    B('showtime_five','Showtime',['magic','byron_scott','worthy','ac_green','kareem'],{handle:6,inside:5,mid:3,drive:2},{stageCash:4,chainId:'showtime_lakers',chainLevel:3}),
    B('final_answer','最终答案',['magic','jordan','lebron','duncan','shaq'],{handle:3,mid:3,drive:3,inside:3,def:3},{stageCash:4,winCash:3})
  ];
  // v3 bonds; legacy data remains available for old saves and server replay.
  const SYNERGIES = [
  {
    "id": "royal_recovery",
    "name": "王者续航",
    "ids": [
      "jordan",
      "lebron",
      "shaq"
    ],
    "attr": "mid",
    "gain": 1,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "shooting": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0,
      "winHeal": 1,
      "healEveryWins": 2
    },
    "description": "禁区终结 +7%、投射威胁 +5%；每累计2胜恢复1点士气"
  },
  {
    "id": "purple_gold_recovery",
    "name": "紫金薪火",
    "ids": [
      "magic",
      "worthy",
      "byron_scott"
    ],
    "attr": "handle",
    "gain": 2,
    "effect": {
      "dimensions": {
        "creation": 7,
        "shooting": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0,
      "winHeal": 1,
      "healEveryWins": 3
    },
    "description": "持球创造 +7%、投射威胁 +5%；每累计3胜恢复1点士气"
  },
  {
    "id": "champion_recovery",
    "name": "冠军拼图",
    "ids": [
      "horry",
      "fisher",
      "battier"
    ],
    "attr": "def",
    "gain": 2,
    "effect": {
      "dimensions": {
        "perimeterStop": 7,
        "rimStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0,
      "winHeal": 1,
      "healEveryWins": 4
    },
    "description": "外线限制 +7%、护框强度 +5%；每累计4胜恢复1点士气"
  },
  {
    "id": "splash",
    "name": "水花兄弟",
    "ids": [
      "curry",
      "klay"
    ],
    "attr": "three",
    "gain": 3,
    "effect": {
      "dimensions": {
        "shooting": 6,
        "creation": 4
      },
      "winCash": 0,
      "stageCash": 1,
      "freeRecruit": 0
    },
    "description": "投射威胁 +6%、持球创造 +4%；每关奖金 +1"
  },
  {
    "id": "warrior_brain",
    "name": "勇士轴心",
    "ids": [
      "curry",
      "green"
    ],
    "attr": "handle",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +7%、外线限制 +5%"
  },
  {
    "id": "ok_combo",
    "name": "紫金OK",
    "ids": [
      "kobe",
      "shaq"
    ],
    "attr": "inside",
    "gain": 3,
    "effect": {
      "dimensions": {
        "finishing": 6,
        "shooting": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +6%、投射威胁 +4%；胜利奖金 +1"
  },
  {
    "id": "mamba_pau",
    "name": "冠军内外线",
    "ids": [
      "kobe",
      "pau"
    ],
    "attr": "inside",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "shooting": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、投射威胁 +5%"
  },
  {
    "id": "laker_twin",
    "name": "湖人双核",
    "ids": [
      "lebron",
      "davis"
    ],
    "attr": "inside",
    "gain": 2,
    "effect": {
      "dimensions": {
        "finishing": 6,
        "perimeterStop": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +6%、外线限制 +4%；胜利奖金 +1"
  },
  {
    "id": "buck_champs",
    "name": "雄鹿冠军组",
    "ids": [
      "giannis",
      "holiday"
    ],
    "attr": "drive",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 6,
        "creation": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +6%、持球创造 +4%；胜利奖金 +1"
  },
  {
    "id": "celtic_guards",
    "name": "绿军双闸",
    "ids": [
      "holiday",
      "white"
    ],
    "attr": "handle",
    "gain": 3,
    "effect": {
      "dimensions": {
        "creation": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +7%、外线限制 +5%"
  },
  {
    "id": "buck_stars",
    "name": "雄鹿双星",
    "ids": [
      "lillard",
      "giannis"
    ],
    "attr": "three",
    "gain": 2,
    "effect": {
      "dimensions": {
        "shooting": 6,
        "finishing": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +6%、禁区终结 +4%；胜利奖金 +1"
  },
  {
    "id": "phoenix_blades",
    "name": "太阳双刃",
    "ids": [
      "durant",
      "booker"
    ],
    "attr": "mid",
    "gain": 6,
    "effect": {
      "dimensions": {
        "shooting": 7,
        "creation": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +7%、持球创造 +5%"
  },
  {
    "id": "process_battle",
    "name": "费城硬仗",
    "ids": [
      "embiid",
      "butler"
    ],
    "attr": "inside",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、外线限制 +5%"
  },
  {
    "id": "wolves_core",
    "name": "狼群内外",
    "ids": [
      "edwards",
      "gobert"
    ],
    "attr": "drive",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "creation": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、持球创造 +5%"
  },
  {
    "id": "knicks_core",
    "name": "纽约双核",
    "ids": [
      "anunoby",
      "brunson"
    ],
    "attr": "mid",
    "gain": 3,
    "effect": {
      "dimensions": {
        "shooting": 6,
        "perimeterStop": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +6%、外线限制 +4%；胜利奖金 +1"
  },
  {
    "id": "lake_show",
    "name": "湖人火花",
    "ids": [
      "lebron",
      "caruso"
    ],
    "attr": "handle",
    "gain": 3,
    "effect": {
      "dimensions": {
        "creation": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +7%、外线限制 +5%"
  },
  {
    "id": "buck_towers",
    "name": "密城双塔",
    "ids": [
      "giannis",
      "lopez"
    ],
    "attr": "inside",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、外线限制 +5%"
  },
  {
    "id": "pick_roll",
    "name": "挡拆教科书",
    "ids": [
      "stockton",
      "malone"
    ],
    "attr": "handle",
    "gain": 2,
    "effect": {
      "dimensions": {
        "creation": 6,
        "finishing": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +6%、禁区终结 +4%；胜利奖金 +1"
  },
  {
    "id": "spurs_heritage",
    "name": "圣城锋线传承",
    "ids": [
      "bowen",
      "kawhi"
    ],
    "attr": "three",
    "gain": 3,
    "effect": {
      "dimensions": {
        "shooting": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +7%、外线限制 +5%"
  },
  {
    "id": "heat_shield",
    "name": "热火侧翼屏障",
    "ids": [
      "lebron",
      "battier"
    ],
    "attr": "drive",
    "gain": 3,
    "effect": {
      "dimensions": {
        "perimeterStop": 7,
        "rimStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "外线限制 +7%、护框强度 +5%"
  },
  {
    "id": "mavs_wall",
    "name": "达拉斯冠军内线",
    "ids": [
      "dirk",
      "chandler"
    ],
    "attr": "inside",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、外线限制 +5%"
  },
  {
    "id": "cavs_arc",
    "name": "克城火力网",
    "ids": [
      "lebron",
      "korver"
    ],
    "attr": "three",
    "gain": 4,
    "effect": {
      "dimensions": {
        "shooting": 7,
        "creation": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +7%、持球创造 +5%"
  },
  {
    "id": "laker_tough",
    "name": "洛城硬仗",
    "ids": [
      "kobe",
      "artest"
    ],
    "attr": "mid",
    "gain": 3,
    "effect": {
      "dimensions": {
        "shooting": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +7%、外线限制 +5%"
  },
  {
    "id": "wallace_brothers",
    "name": "华莱士双塔",
    "ids": [
      "benwallace",
      "rasheed"
    ],
    "attr": "inside",
    "gain": 3,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、外线限制 +5%"
  },
  {
    "id": "sixers_final",
    "name": "费城总决赛双核",
    "ids": [
      "iverson",
      "mutombo"
    ],
    "attr": "drive",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、外线限制 +5%"
  },
  {
    "id": "magic_heritage",
    "name": "魔术一号传承",
    "ids": [
      "penny",
      "howard"
    ],
    "attr": "handle",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 7,
        "finishing": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +7%、禁区终结 +5%"
  },
  {
    "id": "buck_origin",
    "name": "雄鹿冠军起点",
    "ids": [
      "oscar",
      "kareem"
    ],
    "attr": "handle",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 7,
        "finishing": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +7%、禁区终结 +5%"
  },
  {
    "id": "lake_pioneers",
    "name": "湖人远古双翼",
    "ids": [
      "west",
      "baylor"
    ],
    "attr": "mid",
    "gain": 4,
    "effect": {
      "dimensions": {
        "shooting": 7,
        "creation": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +7%、持球创造 +5%"
  },
  {
    "id": "philly_mentors",
    "name": "费城内线传承",
    "ids": [
      "barkley",
      "moses"
    ],
    "attr": "inside",
    "gain": 5,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、外线限制 +5%"
  },
  {
    "id": "rocket_reunion",
    "name": "休城老友",
    "ids": [
      "drexler",
      "hakeem"
    ],
    "attr": "drive",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、外线限制 +5%"
  },
  {
    "id": "warrior_old_days",
    "name": "勇士旧梦",
    "ids": [
      "mullin",
      "webber"
    ],
    "attr": "mid",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 6,
        "shooting": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +6%、投射威胁 +4%；胜利奖金 +1"
  },
  {
    "id": "sonics_duo",
    "name": "手套与雨人",
    "ids": [
      "payton",
      "kemp"
    ],
    "attr": "handle",
    "gain": 3,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "creation": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、持球创造 +5%"
  },
  {
    "id": "duke_wings",
    "name": "全能锋线传承",
    "ids": [
      "grant_hill",
      "tmac"
    ],
    "attr": "mid",
    "gain": 4,
    "effect": {
      "dimensions": {
        "shooting": 7,
        "creation": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +7%、持球创造 +5%"
  },
  {
    "id": "yao_tmac",
    "name": "姚麦组合",
    "ids": [
      "yao",
      "tmac"
    ],
    "attr": "mid",
    "gain": 2,
    "effect": {
      "dimensions": {
        "finishing": 6,
        "shooting": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +6%、投射威胁 +4%；胜利奖金 +1"
  },
  {
    "id": "pistons_backcourt",
    "name": "活塞后场双核",
    "ids": [
      "billups",
      "rip"
    ],
    "attr": "handle",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 6,
        "shooting": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +6%、投射威胁 +4%；胜利奖金 +1"
  },
  {
    "id": "kings_duo",
    "name": "国王双核",
    "ids": [
      "webber",
      "peja"
    ],
    "attr": "handle",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 6,
        "shooting": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +6%、投射威胁 +4%；胜利奖金 +1"
  },
  {
    "id": "rondo_truth",
    "name": "波士顿新旧指挥",
    "ids": [
      "rondo",
      "pierce"
    ],
    "attr": "handle",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 7,
        "shooting": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +7%、投射威胁 +5%"
  },
  {
    "id": "fo_fo_fo",
    "name": "费城冠军双核",
    "ids": [
      "erving",
      "moses"
    ],
    "attr": "drive",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "creation": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、持球创造 +5%"
  },
  {
    "id": "thunder_mentor",
    "name": "雷霆师徒",
    "ids": [
      "shai",
      "paul"
    ],
    "attr": "handle",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 6,
        "finishing": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +6%、禁区终结 +4%；胜利奖金 +1"
  },
  {
    "id": "showtime_pair",
    "name": "表演时刻",
    "ids": [
      "magic",
      "kareem"
    ],
    "attr": "handle",
    "gain": 2,
    "effect": {
      "dimensions": {
        "creation": 6,
        "finishing": 4
      },
      "winCash": 0,
      "stageCash": 1,
      "freeRecruit": 0
    },
    "description": "持球创造 +6%、禁区终结 +4%；每关奖金 +1"
  },
  {
    "id": "mavs_origin",
    "name": "达拉斯双星",
    "ids": [
      "dirk",
      "nash"
    ],
    "attr": "mid",
    "gain": 2,
    "effect": {
      "dimensions": {
        "creation": 6,
        "shooting": 4
      },
      "winCash": 0,
      "stageCash": 1,
      "freeRecruit": 0
    },
    "description": "持球创造 +6%、投射威胁 +4%；每关奖金 +1"
  },
  {
    "id": "magic_bird",
    "name": "魔鸟争霸",
    "ids": [
      "magic",
      "bird"
    ],
    "attr": "handle",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 7,
        "shooting": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +7%、投射威胁 +5%"
  },
  {
    "id": "jordan_kobe",
    "name": "飞人传承",
    "ids": [
      "jordan",
      "kobe"
    ],
    "attr": "mid",
    "gain": 4,
    "effect": {
      "dimensions": {
        "shooting": 7,
        "creation": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +7%、持球创造 +5%"
  },
  {
    "id": "bad_boys_backcourt",
    "name": "坏孩子双枪",
    "ids": [
      "isiah",
      "dumars"
    ],
    "attr": "handle",
    "gain": 2,
    "effect": {
      "dimensions": {
        "creation": 6,
        "perimeterStop": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +6%、外线限制 +4%；胜利奖金 +1"
  },
  {
    "id": "finals_94",
    "name": "九四中锋决战",
    "ids": [
      "hakeem",
      "ewing"
    ],
    "attr": "inside",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +7%、外线限制 +5%"
  },
  {
    "id": "mavs_new_core",
    "name": "独行侠双核",
    "ids": [
      "doncic",
      "irving"
    ],
    "attr": "handle",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 6,
        "shooting": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +6%、投射威胁 +4%；胜利奖金 +1"
  },
  {
    "id": "nets_flight",
    "name": "篮网飞翼",
    "ids": [
      "kidd",
      "carter"
    ],
    "attr": "handle",
    "gain": 2,
    "effect": {
      "dimensions": {
        "creation": 6,
        "finishing": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +6%、禁区终结 +4%；胜利奖金 +1"
  },
  {
    "id": "thunder_three",
    "name": "雷霆三少",
    "ids": [
      "durant",
      "westbrook",
      "harden"
    ],
    "attr": "drive",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 11,
        "shooting": 7
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +11%、投射威胁 +7%；胜利奖金 +1"
  },
  {
    "id": "heat_big_three",
    "name": "南海岸三巨头",
    "ids": [
      "lebron",
      "wade",
      "bosh"
    ],
    "attr": "drive",
    "gain": 4,
    "effect": {
      "dimensions": {
        "finishing": 11,
        "creation": 7
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +11%、持球创造 +7%；胜利奖金 +1"
  },
  {
    "id": "celtic_big_three",
    "name": "绿军三巨头",
    "ids": [
      "pierce",
      "garnett",
      "rayallen"
    ],
    "attr": "mid",
    "gain": 3,
    "effect": {
      "dimensions": {
        "shooting": 11,
        "perimeterStop": 7
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +11%、外线限制 +7%；胜利奖金 +1"
  },
  {
    "id": "bull_triangle",
    "name": "公牛铁三角",
    "ids": [
      "jordan",
      "pippen",
      "rodman"
    ],
    "attr": "def",
    "gain": 4,
    "effect": {
      "dimensions": {
        "shooting": 11,
        "perimeterStop": 7
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +11%、外线限制 +7%；胜利奖金 +1"
  },
  {
    "id": "gdp",
    "name": "GDP",
    "ids": [
      "duncan",
      "parker",
      "ginobili"
    ],
    "attr": "inside",
    "gain": 3,
    "effect": {
      "dimensions": {
        "finishing": 11,
        "creation": 7
      },
      "winCash": 0,
      "stageCash": 1,
      "freeRecruit": 0
    },
    "description": "禁区终结 +11%、持球创造 +7%；每关奖金 +1"
  },
  {
    "id": "nets_big_three",
    "name": "篮网三巨头",
    "ids": [
      "durant",
      "harden",
      "irving"
    ],
    "attr": "mid",
    "gain": 3,
    "effect": {
      "dimensions": {
        "shooting": 13,
        "creation": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +13%、持球创造 +9%"
  },
  {
    "id": "lob_city",
    "name": "空接之城",
    "ids": [
      "paul",
      "griffin",
      "deandre"
    ],
    "attr": "handle",
    "gain": 3,
    "effect": {
      "dimensions": {
        "finishing": 13,
        "creation": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +13%、持球创造 +9%"
  },
  {
    "id": "celtic_dynasty",
    "name": "凯尔特人王朝",
    "ids": [
      "bird",
      "mchale",
      "parish"
    ],
    "attr": "mid",
    "gain": 3,
    "effect": {
      "dimensions": {
        "finishing": 13,
        "shooting": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +13%、投射威胁 +9%"
  },
  {
    "id": "ok3",
    "name": "OK3",
    "ids": [
      "westbrook",
      "george",
      "melo"
    ],
    "attr": "drive",
    "gain": 3,
    "effect": {
      "dimensions": {
        "shooting": 13,
        "creation": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +13%、持球创造 +9%"
  },
  {
    "id": "mamba_students",
    "name": "曼巴门徒",
    "ids": [
      "kobe",
      "irving",
      "tatum"
    ],
    "attr": "mid",
    "gain": 4,
    "effect": {
      "dimensions": {
        "creation": 13,
        "shooting": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +13%、投射威胁 +9%"
  },
  {
    "id": "cavs_big_three",
    "name": "骑士三巨头",
    "ids": [
      "lebron",
      "irving",
      "love"
    ],
    "attr": "drive",
    "gain": 3,
    "effect": {
      "dimensions": {
        "finishing": 11,
        "shooting": 7
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +11%、投射威胁 +7%；胜利奖金 +1"
  },
  {
    "id": "era_shooters",
    "name": "划时代射手",
    "ids": [
      "reggie",
      "rayallen",
      "curry"
    ],
    "attr": "three",
    "gain": 6,
    "effect": {
      "dimensions": {
        "shooting": 13,
        "creation": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +13%、持球创造 +9%"
  },
  {
    "id": "seven_seconds",
    "name": "7秒进攻",
    "ids": [
      "nash",
      "amare",
      "marion"
    ],
    "attr": "handle",
    "gain": 3,
    "effect": {
      "dimensions": {
        "creation": 11,
        "finishing": 7
      },
      "winCash": 0,
      "stageCash": 1,
      "freeRecruit": 0
    },
    "description": "持球创造 +11%、禁区终结 +7%；每关奖金 +1"
  },
  {
    "id": "nuggets_core",
    "name": "掘金三核",
    "ids": [
      "jokic",
      "murray",
      "aaron_gordon"
    ],
    "attr": "handle",
    "gain": 3,
    "effect": {
      "dimensions": {
        "finishing": 11,
        "creation": 7
      },
      "winCash": 0,
      "stageCash": 1,
      "freeRecruit": 0
    },
    "description": "禁区终结 +11%、持球创造 +7%；每关奖金 +1"
  },
  {
    "id": "scoring_kaleidoscope",
    "name": "万花筒",
    "ids": [
      "kobe",
      "melo",
      "durant"
    ],
    "attr": "mid",
    "gain": 4,
    "effect": {
      "dimensions": {
        "shooting": 13,
        "creation": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +13%、持球创造 +9%"
  },
  {
    "id": "floor_generals",
    "name": "球场指挥官",
    "ids": [
      "paul",
      "kidd",
      "nash"
    ],
    "attr": "handle",
    "gain": 5,
    "effect": {
      "dimensions": {
        "creation": 13,
        "shooting": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +13%、投射威胁 +9%"
  },
  {
    "id": "violent_dunkers",
    "name": "暴力扣将",
    "ids": [
      "wilkins",
      "carter",
      "griffin"
    ],
    "attr": "drive",
    "gain": 5,
    "effect": {
      "dimensions": {
        "finishing": 13,
        "creation": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +13%、持球创造 +9%"
  },
  {
    "id": "four_shooting_guards",
    "name": "四大分位",
    "ids": [
      "kobe",
      "tmac",
      "carter",
      "iverson"
    ],
    "attr": "mid",
    "gain": 4,
    "effect": {
      "dimensions": {
        "shooting": 17,
        "creation": 11
      },
      "winCash": 2,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +17%、持球创造 +11%；胜利奖金 +2"
  },
  {
    "id": "banana_boat",
    "name": "香蕉船兄弟",
    "ids": [
      "lebron",
      "wade",
      "paul",
      "melo"
    ],
    "attr": "drive",
    "gain": 3,
    "effect": {
      "dimensions": {
        "creation": 17,
        "finishing": 11
      },
      "winCash": 2,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +17%、禁区终结 +11%；胜利奖金 +2"
  },
  {
    "id": "draft_96",
    "name": "96黄金一代",
    "ids": [
      "kobe",
      "iverson",
      "nash",
      "rayallen"
    ],
    "attr": "three",
    "gain": 4,
    "effect": {
      "dimensions": {
        "shooting": 17,
        "creation": 11
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 1
    },
    "description": "投射威胁 +17%、持球创造 +11%；免费招募 +1"
  },
  {
    "id": "european_kings",
    "name": "欧洲天王",
    "ids": [
      "dirk",
      "pau",
      "jokic",
      "doncic"
    ],
    "attr": "mid",
    "gain": 4,
    "effect": {
      "dimensions": {
        "shooting": 17,
        "creation": 11
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 1
    },
    "description": "投射威胁 +17%、持球创造 +11%；免费招募 +1"
  },
  {
    "id": "bad_boys",
    "name": "坏孩子军团",
    "ids": [
      "isiah",
      "dumars",
      "laimbeer",
      "rodman"
    ],
    "attr": "def",
    "gain": 5,
    "effect": {
      "dimensions": {
        "creation": 17,
        "perimeterStop": 11
      },
      "winCash": 2,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +17%、外线限制 +11%；胜利奖金 +2"
  },
  {
    "id": "four_centers",
    "name": "四大中锋",
    "ids": [
      "hakeem",
      "shaq",
      "robinson",
      "ewing"
    ],
    "attr": "inside",
    "gain": 8,
    "effect": {
      "dimensions": {
        "finishing": 20,
        "perimeterStop": 14
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +20%、外线限制 +14%"
  },
  {
    "id": "four_great_shooters",
    "name": "四大神射",
    "ids": [
      "curry",
      "reggie",
      "klay",
      "peja"
    ],
    "attr": "three",
    "gain": 6,
    "effect": {
      "dimensions": {
        "shooting": 20,
        "creation": 14
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +20%、持球创造 +14%"
  },
  {
    "id": "spurs_pillars",
    "name": "圣城四柱",
    "ids": [
      "duncan",
      "kawhi",
      "robinson",
      "parker"
    ],
    "attr": "def",
    "gain": 5,
    "effect": {
      "dimensions": {
        "finishing": 17,
        "perimeterStop": 11
      },
      "winCash": 2,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +17%、外线限制 +11%；胜利奖金 +2"
  },
  {
    "id": "versatile_forwards",
    "name": "全能大前锋",
    "ids": [
      "giannis",
      "garnett",
      "barkley",
      "lebron"
    ],
    "attr": "inside",
    "gain": 3,
    "effect": {
      "dimensions": {
        "finishing": 20,
        "creation": 14
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +20%、持球创造 +14%"
  },
  {
    "id": "lakers_generations",
    "name": "湖人四代核心",
    "ids": [
      "magic",
      "kareem",
      "west",
      "baylor"
    ],
    "attr": "handle",
    "gain": 3,
    "effect": {
      "dimensions": {
        "creation": 17,
        "finishing": 11
      },
      "winCash": 2,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +17%、禁区终结 +11%；胜利奖金 +2"
  },
  {
    "id": "celtics_pillars",
    "name": "绿军四代基石",
    "ids": [
      "bird",
      "russell",
      "mchale",
      "garnett"
    ],
    "attr": "def",
    "gain": 5,
    "effect": {
      "dimensions": {
        "shooting": 17,
        "finishing": 11
      },
      "winCash": 2,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +17%、禁区终结 +11%；胜利奖金 +2"
  },
  {
    "id": "scoring_legends",
    "name": "锋卫得分王",
    "ids": [
      "jordan",
      "wilkins",
      "erving",
      "durant"
    ],
    "attr": "mid",
    "gain": 3,
    "effect": {
      "dimensions": {
        "finishing": 20,
        "shooting": 14
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +20%、投射威胁 +14%"
  },
  {
    "id": "rhythm_creators",
    "name": "节奏掌控者",
    "ids": [
      "shai",
      "oscar",
      "harden",
      "doncic"
    ],
    "attr": "handle",
    "gain": 5,
    "effect": {
      "dimensions": {
        "creation": 20,
        "shooting": 14
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +20%、投射威胁 +14%"
  },
  {
    "id": "paint_dominators",
    "name": "禁区统治者",
    "ids": [
      "wilt",
      "russell",
      "moses",
      "kareem"
    ],
    "attr": "inside",
    "gain": 9,
    "effect": {
      "dimensions": {
        "finishing": 20,
        "perimeterStop": 14
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "禁区终结 +20%、外线限制 +14%"
  },
  {
    "id": "death_lineup",
    "name": "死亡五小",
    "ids": [
      "curry",
      "klay",
      "iguodala",
      "durant",
      "green"
    ],
    "attr": "three",
    "gain": 5,
    "effect": {
      "dimensions": {
        "shooting": 24,
        "creation": 16
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 1
    },
    "description": "投射威胁 +24%、持球创造 +16%；免费招募 +1"
  },
  {
    "id": "bulls_dynasty",
    "name": "公牛王朝",
    "ids": [
      "harper",
      "jordan",
      "pippen",
      "rodman",
      "longley"
    ],
    "attr": "def",
    "gain": 6,
    "effect": {
      "dimensions": {
        "creation": 24,
        "perimeterStop": 16
      },
      "winCash": 0,
      "stageCash": 3,
      "freeRecruit": 0
    },
    "description": "持球创造 +24%、外线限制 +16%；每关奖金 +3"
  },
  {
    "id": "ok_dynasty",
    "name": "OK王朝",
    "ids": [
      "fisher",
      "kobe",
      "fox",
      "horry",
      "shaq"
    ],
    "attr": "inside",
    "gain": 6,
    "effect": {
      "dimensions": {
        "shooting": 24,
        "finishing": 16
      },
      "winCash": 3,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +24%、禁区终结 +16%；胜利奖金 +3"
  },
  {
    "id": "showtime_five",
    "name": "Showtime",
    "ids": [
      "magic",
      "byron_scott",
      "worthy",
      "ac_green",
      "kareem"
    ],
    "attr": "handle",
    "gain": 6,
    "effect": {
      "dimensions": {
        "creation": 32,
        "finishing": 22
      },
      "winCash": 0,
      "stageCash": 3,
      "freeRecruit": 0
    },
    "description": "持球创造 +32%、禁区终结 +22%；每关奖金 +3"
  },
  {
    "id": "final_answer",
    "name": "最终答案",
    "ids": [
      "magic",
      "jordan",
      "lebron",
      "duncan",
      "shaq"
    ],
    "attr": "handle",
    "gain": 3,
    "effect": {
      "dimensions": {
        "creation": 24,
        "finishing": 16
      },
      "winCash": 3,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +24%、禁区终结 +16%；胜利奖金 +3"
  },
  {
    "id": "diversity_pair_1",
    "name": "金州双核",
    "ids": [
      "curry",
      "durant"
    ],
    "effect": {
      "dimensions": {
        "shooting": 6,
        "creation": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +6%、持球创造 +4%；胜利奖金 +1"
  },
  {
    "id": "diversity_pair_2",
    "name": "格林公式",
    "ids": [
      "durant",
      "green"
    ],
    "effect": {
      "dimensions": {
        "perimeterStop": 6,
        "rimStop": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "外线限制 +6%、护框强度 +4%；胜利奖金 +1"
  },
  {
    "id": "diversity_pair_3",
    "name": "金州防守枢纽",
    "ids": [
      "green",
      "iguodala"
    ],
    "effect": {
      "dimensions": {
        "perimeterStop": 6,
        "rimStop": 4
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "外线限制 +6%、护框强度 +4%；胜利奖金 +1"
  },
  {
    "id": "diversity_pair_4",
    "name": "一哥掩护",
    "ids": [
      "curry",
      "iguodala"
    ],
    "effect": {
      "dimensions": {
        "shooting": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +7%、外线限制 +5%"
  },
  {
    "id": "diversity_pair_5",
    "name": "侧翼接力",
    "ids": [
      "klay",
      "iguodala"
    ],
    "effect": {
      "dimensions": {
        "shooting": 7,
        "perimeterStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "投射威胁 +7%、外线限制 +5%"
  },
  {
    "id": "diversity_pair_6",
    "name": "芝城双翼",
    "ids": [
      "jordan",
      "pippen"
    ],
    "effect": {
      "dimensions": {
        "perimeterStop": 7,
        "rimStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "外线限制 +7%、护框强度 +5%"
  },
  {
    "id": "diversity_pair_7",
    "name": "篮板与锁链",
    "ids": [
      "pippen",
      "rodman"
    ],
    "effect": {
      "dimensions": {
        "perimeterStop": 7,
        "rimStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "外线限制 +7%、护框强度 +5%"
  },
  {
    "id": "diversity_pair_8",
    "name": "飞人与篮板王",
    "ids": [
      "jordan",
      "rodman"
    ],
    "effect": {
      "dimensions": {
        "perimeterStop": 7,
        "rimStop": 5
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "外线限制 +7%、护框强度 +5%"
  },
  {
    "id": "warriors_connect",
    "name": "金州连接器",
    "ids": [
      "curry",
      "green",
      "iguodala"
    ],
    "effect": {
      "dimensions": {
        "perimeterStop": 11,
        "rimStop": 7
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "外线限制 +11%、护框强度 +7%；胜利奖金 +1"
  },
  {
    "id": "spurs_lock",
    "name": "圣城防守链",
    "ids": [
      "duncan",
      "kawhi",
      "bowen"
    ],
    "effect": {
      "dimensions": {
        "rimStop": 11,
        "perimeterStop": 7
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "护框强度 +11%、外线限制 +7%；胜利奖金 +1"
  },
  {
    "id": "detroit_champs",
    "name": "汽车城铁三角",
    "ids": [
      "billups",
      "benwallace",
      "rasheed"
    ],
    "effect": {
      "dimensions": {
        "perimeterStop": 11,
        "rimStop": 7
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "外线限制 +11%、护框强度 +7%；胜利奖金 +1"
  },
  {
    "id": "bull_wings",
    "name": "芝城侧翼网",
    "ids": [
      "jordan",
      "pippen",
      "harper"
    ],
    "effect": {
      "dimensions": {
        "perimeterStop": 11,
        "creation": 7
      },
      "winCash": 1,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "外线限制 +11%、持球创造 +7%；胜利奖金 +1"
  },
  {
    "id": "laker_advance",
    "name": "洛城快攻链",
    "ids": [
      "magic",
      "worthy",
      "kareem"
    ],
    "effect": {
      "dimensions": {
        "creation": 18,
        "finishing": 12
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +18%、禁区终结 +12%"
  },
  {
    "id": "rocket_axes",
    "name": "休城内外策应",
    "ids": [
      "hakeem",
      "drexler",
      "yao"
    ],
    "effect": {
      "dimensions": {
        "rimStop": 13,
        "finishing": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "护框强度 +13%、禁区终结 +9%"
  },
  {
    "id": "mavs_spacing",
    "name": "达拉斯空间链",
    "ids": [
      "dirk",
      "nash",
      "kidd"
    ],
    "effect": {
      "dimensions": {
        "creation": 13,
        "shooting": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +13%、投射威胁 +9%"
  },
  {
    "id": "bird_circle",
    "name": "魔鸟与天勾",
    "ids": [
      "bird",
      "magic",
      "kareem"
    ],
    "effect": {
      "dimensions": {
        "creation": 18,
        "finishing": 12
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +18%、禁区终结 +12%"
  },
  {
    "id": "sun_transition",
    "name": "纳什转换链",
    "ids": [
      "nash",
      "amare",
      "dirk"
    ],
    "effect": {
      "dimensions": {
        "creation": 13,
        "finishing": 9
      },
      "winCash": 0,
      "stageCash": 0,
      "freeRecruit": 0
    },
    "description": "持球创造 +13%、禁区终结 +9%"
  }
];
  return {ATTRS,LABELS,COMBAT_LABELS,ATTR_TO_COMBAT,mapToCombat,combatText,TIER_RULES,STAR_ROWS,TALENT_DETAILS,SYNERGIES,LEGACY_SYNERGIES};
});
