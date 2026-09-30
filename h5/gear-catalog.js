/* 装备目录：五类非球衣各五件、十二件基础经典球衣，以及十五件传奇点解锁球衣。 */
(function(root){
  'use strict';
  const gear=[
    {id:'lockdown_band',name:'防守指挥头带',rarity:'C',slot:'头带',price:8,sellPrice:4,stats:{def:5}},
    {id:'analytics_band',name:'赛前录像头带',rarity:'B',slot:'头带',price:16,sellPrice:7,stats:{handle:7},counterCash:2},
    {id:'balance_band',name:'攻防转换头带',rarity:'B',slot:'头带',price:17,sellPrice:7,stats:{drive:5,def:3}},
    {id:'paul_band',name:'场上指挥头带',rarity:'A',slot:'头带',price:25,sellPrice:10,stats:{handle:10,mid:5},turnoverReduction:.015},
    {id:'core_robe',name:'全能核心头带',rarity:'S',slot:'头带',price:42,sellPrice:17,stats:{handle:14},dimensionPercent:{creation:6},percentStats:{all:3}},

    {id:'wrist',name:'启动护腕',rarity:'C',slot:'护腕',price:8,sellPrice:4,stats:{drive:5}},
    {id:'deep_wrist',name:'3D护腕',rarity:'B',slot:'护腕',price:16,sellPrice:7,stats:{three:7,mid:3}},
    {id:'steady_wrist',name:'强硬护腕',rarity:'B',slot:'护腕',price:16,sellPrice:7,stats:{def:7,inside:3}},
    {id:'armor_jersey',name:'禁区护框护腕',rarity:'A',slot:'护腕',price:25,sellPrice:10,stats:{def:10,inside:6}},
    {id:'iverson_sleeve',name:'脚踝终结护腕',rarity:'S',slot:'护腕',price:42,sellPrice:17,stats:{drive:17,handle:8},clutchBonus:.03},

    {id:'paint_shoes',name:'Shaq Attaq',rarity:'C',slot:'球鞋',price:8,sellPrice:4,stats:{inside:5}},
    {id:'footwork_shoes',name:'Kyrie 2',rarity:'B',slot:'球鞋',price:16,sellPrice:7,stats:{mid:3,handle:7}},
    {id:'perimeter_shoes',name:'Kobe 4',rarity:'B',slot:'球鞋',price:16,sellPrice:7,stats:{def:7,drive:3}},
    {id:'king_shoes',name:'LeBron 2',rarity:'A',slot:'球鞋',price:25,sellPrice:10,stats:{drive:10,inside:6}},
    {id:'clutch_shoes',name:'Last Shot',rarity:'S',slot:'球鞋',price:42,sellPrice:17,stats:{drive:15,mid:10},clutchBonus:.04},

    {id:'rookie_ring',name:'新秀戒指',rarity:'C',slot:'戒指',price:9,sellPrice:4,percentStats:{all:2}},
    {id:'veteran_ring',name:'老将戒指',rarity:'B',slot:'戒指',price:17,sellPrice:7,percentStats:{all:3}},
    {id:'defense_ring',name:'防守戒指',rarity:'B',slot:'戒指',price:17,sellPrice:7,stats:{def:8},dimensionPercent:{perimeterStop:3}},
    {id:'finals_ring',name:'全明星戒指',rarity:'A',slot:'戒指',price:27,sellPrice:11,percentStats:{all:4},clutchBonus:.02},
    {id:'dynasty_ring',name:'总冠军戒指',rarity:'S',slot:'戒指',price:50,sellPrice:20,percentStats:{all:6},dimensionPercent:{all:5}},

    {id:'spacing_board',name:'空间战术板',rarity:'C',slot:'战术板',price:8,sellPrice:4,stats:{three:5}},
    {id:'tactics_board',name:'八区战术板',rarity:'B',slot:'战术板',price:16,sellPrice:7,stats:{three:6,handle:4}},
    {id:'matchup_board',name:'对位战术板',rarity:'B',slot:'战术板',price:16,sellPrice:7,stats:{def:7},dimensionPercent:{rimStop:3}},
    {id:'taiping_playbook',name:'临场战术板',rarity:'A',slot:'战术板',price:27,sellPrice:11,stats:{three:8,handle:6},counterCash:3},
    {id:'team_jersey',name:'核心单打战术板',rarity:'S',slot:'战术板',price:43,sellPrice:17,stats:{handle:9},dimensionPercent:{all:4},bondBoost:.15},

    {id:'curry_wrist',name:'勇士·30号',rarity:'A',slot:'球衣',teamCode:'gsw',price:20,sellPrice:8,stats:{three:12,handle:6}},
    {id:'king_double_wrist',name:'骑士·23号',rarity:'A',slot:'球衣',teamCode:'cle',price:20,sellPrice:8,stats:{drive:10,handle:8}},
    {id:'jordan_sleeve',name:'公牛·23号',rarity:'A',slot:'球衣',teamCode:'chi',price:20,sellPrice:8,stats:{mid:10,drive:8}},
    {id:'kobe_sleeve',name:'湖人·8号',rarity:'A',slot:'球衣',teamCode:'lal',price:20,sellPrice:8,stats:{mid:10,drive:8}},
    {id:'giannis_shoes',name:'热火·6号',rarity:'A',slot:'球衣',teamCode:'mia',price:20,sellPrice:8,stats:{inside:9,handle:9}},
    {id:'jordan_playbook',name:'公牛·45号',rarity:'A',slot:'球衣',teamCode:'chi',price:20,sellPrice:8,stats:{mid:9,def:9}},
    {id:'shaq_jersey',name:'湖人·34号',rarity:'A',slot:'球衣',teamCode:'lal',price:20,sellPrice:8,stats:{inside:12,def:6}},
    {id:'durant_sleeve',name:'勇士·35号',rarity:'A',slot:'球衣',teamCode:'gsw',price:20,sellPrice:8,stats:{mid:10,three:8}},
    {id:'kobe_wrist',name:'湖人·24号',rarity:'A',slot:'球衣',teamCode:'lal',price:20,sellPrice:8,stats:{mid:12,three:6}},
    {id:'westbrook_shoes',name:'森林狼·21号',rarity:'A',slot:'球衣',teamCode:'min',price:20,sellPrice:8,stats:{inside:9,def:9}},
    {id:'duncan_jersey',name:'马刺·21号',rarity:'A',slot:'球衣',teamCode:'sas',price:20,sellPrice:8,stats:{inside:9,def:9}},
    {id:'magic_ring',name:'湖人·32号',rarity:'A',slot:'球衣',teamCode:'lal',price:20,sellPrice:8,stats:{handle:12,inside:6}},
    {id:'tmac_magic_jersey',legendName:'麦迪',name:'魔术·1号',rarity:'A',slot:'球衣',teamCode:'orl',price:20,sellPrice:8,stats:{three:9,drive:9},unlockable:true},
    {id:'iverson_sixers_jersey',legendName:'艾弗森',name:'76人·3号',rarity:'A',slot:'球衣',teamCode:'phi',price:20,sellPrice:8,stats:{drive:10,handle:8},unlockable:true},
    {id:'kareem_lakers_jersey',legendName:'贾巴尔',name:'湖人·33号',rarity:'A',slot:'球衣',teamCode:'lal',price:20,sellPrice:8,stats:{inside:12,mid:6},unlockable:true},
    {id:'bird_celtics_jersey',legendName:'拉里·伯德',name:'凯尔特人·33号',rarity:'A',slot:'球衣',teamCode:'bos',price:20,sellPrice:8,stats:{three:10,mid:8},unlockable:true},
    {id:'harden_rockets_jersey',legendName:'哈登',name:'火箭·13号',rarity:'A',slot:'球衣',teamCode:'hou',price:20,sellPrice:8,stats:{three:9,handle:9},unlockable:true},
    {id:'allen_celtics_jersey',legendName:'雷·阿伦',name:'凯尔特人·20号',rarity:'A',slot:'球衣',teamCode:'bos',price:20,sellPrice:8,stats:{three:12,mid:6},unlockable:true},
    {id:'durant_thunder_jersey',legendName:'杜兰特',name:'雷霆·35号',rarity:'A',slot:'球衣',teamCode:'okc',price:20,sellPrice:8,stats:{mid:10,three:8},unlockable:true},
    {id:'westbrook_thunder_jersey',legendName:'威少',name:'雷霆·0号',rarity:'A',slot:'球衣',teamCode:'okc',price:20,sellPrice:8,stats:{drive:10,handle:8},unlockable:true},
    {id:'wade_heat_jersey',legendName:'韦德',name:'热火·3号',rarity:'A',slot:'球衣',teamCode:'mia',price:20,sellPrice:8,stats:{drive:10,def:8},unlockable:true},
    {id:'giannis_bucks_jersey',legendName:'字母哥',name:'雄鹿·34号',rarity:'A',slot:'球衣',teamCode:'mil',price:20,sellPrice:8,stats:{inside:10,def:8},unlockable:true},
    {id:'olajuwon_rockets_jersey',legendName:'奥拉朱旺',name:'火箭·34号',rarity:'A',slot:'球衣',teamCode:'hou',price:20,sellPrice:8,stats:{inside:9,def:9},unlockable:true},
    {id:'dirk_mavericks_jersey',legendName:'诺维茨基',name:'独行侠·41号',rarity:'A',slot:'球衣',teamCode:'dal',price:20,sellPrice:8,stats:{mid:10,three:8},unlockable:true},
    {id:'doncic_mavericks_jersey',legendName:'东契奇',name:'独行侠·77号',rarity:'A',slot:'球衣',teamCode:'dal',price:20,sellPrice:8,stats:{handle:10,three:8},unlockable:true},
    {id:'wilt_warriors_jersey',legendName:'张伯伦',name:'勇士·13号',rarity:'A',slot:'球衣',teamCode:'gsw',price:20,sellPrice:8,stats:{inside:12,def:6},unlockable:true},
    {id:'russell_celtics_jersey',legendName:'比尔·拉塞尔',name:'凯尔特人·6号',rarity:'A',slot:'球衣',teamCode:'bos',price:20,sellPrice:8,stats:{def:12,inside:6},unlockable:true}
  ];
  if(typeof module!=='undefined'&&module.exports)module.exports=gear;
  root.SupFusionGearCatalog=gear;
})(typeof window!=='undefined'?window:globalThis);
