/* 随机事件配置；故事与编号对应 2026-10-09 设计稿。 */
(function(root){
'use strict';
const events=[
  {
    "id": "T01",
    "name": "弧顶一千球",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "curry"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "散场后的球场只剩一盏灯，你照着库里的投篮影像反复校准弧顶出手，把远投变成单挑中可靠的一招。",
    "attr": "three",
    "dimension": "shooting",
    "jersey": null,
    "cost": 0,
    "rewardText": "投射威胁 +3～5% / +1%"
  },
  {
    "id": "T02",
    "name": "碰撞后的第一步",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "lebron"
    ],
    "minStage": 1,
    "afterLoss": true,
    "story": "你回看刚才被挡住的突破，再对照詹姆斯的启动影像练习压低重心；下一次碰撞后，你要继续踏出通向篮筐的第一步。",
    "attr": "drive",
    "dimension": "finishing",
    "jersey": null,
    "cost": 0,
    "rewardText": "禁区终结 +3～5% / +1%"
  },
  {
    "id": "T03",
    "name": "左手试炼",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "magic"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "你暂停魔术师的一段持球影像，尝试只用左手藏住启动方向，再独自完成这次运球试炼。",
    "attr": "handle",
    "dimension": "creation",
    "jersey": null,
    "cost": 0,
    "rewardText": "持球创造 +3～5% / +1%"
  },
  {
    "id": "T04",
    "name": "篮筐下的落点",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "shaq"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "你在篮下照着奥尼尔的低位影像练习占住落点，让陪练从不同角度贴近出手；熟悉篮下空间后，你要把这份判断用来封住终结路线。",
    "attr": "inside",
    "dimension": "rimStop",
    "jersey": null,
    "cost": 0,
    "rewardText": "护框强度 +3～5% / +1%"
  },
  {
    "id": "T05",
    "name": "飞人的封线课",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "jordan"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "你暂停乔丹防守时横移的一帧，让陪练反复从侧翼启动；不伸手赌抢断，而是用一步滑动先封住突破方向。",
    "attr": "def",
    "dimension": "perimeterStop",
    "jersey": null,
    "cost": 0,
    "rewardText": "外线限制 +3～5% / +1%"
  },
  {
    "id": "T06",
    "name": "水花的两种节奏",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "curry",
      "klay"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "你回看水花搭档的出手影像，把持球后的远投与迅速收球投篮分别练成单挑招式，最后独自选择合适的节奏。",
    "attr": "three",
    "dimension": "shooting",
    "jersey": null,
    "cost": 0,
    "rewardText": "投射威胁 +5～7% / +1%"
  },
  {
    "id": "T07",
    "name": "转身之前",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "magic",
      "kareem"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "一段影像教你用眼神藏住方向，另一段教你用脚步保护收球；你要独自完成转身前的这次节奏变化。",
    "attr": "handle",
    "dimension": "creation",
    "jersey": null,
    "cost": 0,
    "rewardText": "持球创造 +5～7% / +1%"
  },
  {
    "id": "T08",
    "name": "芝城镜像步",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "jordan",
      "pippen"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "你把这对昔日搭档的试探与突破动作拆开练习，再让陪练识破第一步；第二次启动必须骗过同一双眼睛。",
    "attr": "drive",
    "dimension": "finishing",
    "jersey": null,
    "cost": 0,
    "rewardText": "禁区终结 +5～7% / +1%"
  },
  {
    "id": "T10",
    "name": "魔鸟的预判笔记",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "bird",
      "magic"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "你从这对老对手的交锋影像里寻找动作被识破的瞬间，练习在一对一防守中先读肩膀、再封路线。",
    "attr": "def",
    "dimension": "perimeterStop",
    "jersey": null,
    "cost": 0,
    "rewardText": "外线限制 +5～7% / +1%"
  },
  {
    "id": "T11",
    "name": "篮筐前的最后一拍",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "lebron",
      "shaq"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "你把追上突破者的速度与篮下等待的时机放在一起练习，要求自己最后一拍仍站在球与篮筐之间。",
    "attr": "def",
    "dimension": "rimStop",
    "jersey": null,
    "cost": 0,
    "rewardText": "护框强度 +5～7% / +1%"
  },
  {
    "id": "T12",
    "name": "一秒拔起",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "tmac"
    ],
    "minStage": 3,
    "afterLoss": false,
    "story": "旧影像里的干拔只有一瞬，你要在陪练贴身前完成收球、起跳和出手，才能接过那件1号球衣。",
    "attr": "mid",
    "dimension": "shooting",
    "jersey": "tmac_magic_jersey",
    "cost": 0,
    "rewardText": "魔术·1号球衣 / 投射威胁 +1%"
  },
  {
    "id": "T13",
    "name": "底角来信",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "rayallen"
    ],
    "minStage": 3,
    "afterLoss": false,
    "story": "留在球场的一封信要求你从不同角度独自投进底角球，完成后便可领取20号球衣。",
    "attr": "three",
    "dimension": "shooting",
    "jersey": "allen_celtics_jersey",
    "cost": 0,
    "rewardText": "凯尔特人·20号球衣 / 投射威胁 +1%"
  },
  {
    "id": "T14",
    "name": "金鸡独立的平衡",
    "type": "T",
    "category": "技巧较量",
    "players": [
      "dirk"
    ],
    "minStage": 3,
    "afterLoss": false,
    "story": "你尝试把单脚后仰融入自己的单挑投篮，球衣保管人会看最后一次出手是否稳住。",
    "attr": "mid",
    "dimension": "shooting",
    "jersey": "dirk_mavericks_jersey",
    "cost": 0,
    "rewardText": "独行侠·41号球衣 / 投射威胁 +1%"
  },
  {
    "id": "C01",
    "name": "夜场擂台",
    "type": "C",
    "category": "单挑挑战",
    "players": [
      "jordan"
    ],
    "minStage": 5,
    "afterLoss": false,
    "story": "夜场擂主认出你的飞人式试探步，喊住正要离开的你，要求你用一次突破证明这招经得起贴身防守。",
    "attr": "drive",
    "dimension": "finishing",
    "jersey": null,
    "cost": 0,
    "rewardText": "禁区终结 +5%"
  },
  {
    "id": "C02",
    "name": "一球封口",
    "type": "C",
    "category": "单挑挑战",
    "players": [
      "bird"
    ],
    "minStage": 1,
    "afterLoss": true,
    "story": "场边观众看见你练习伯德的投篮，却质疑刚才的失准；你可以接受一球定胜负，也可以离开。",
    "attr": "three",
    "dimension": "shooting",
    "jersey": null,
    "cost": 0,
    "rewardText": "投射威胁 +5%"
  },
  {
    "id": "C03",
    "name": "铁闸通行证",
    "type": "C",
    "category": "单挑挑战",
    "players": [
      "duncan"
    ],
    "minStage": 3,
    "afterLoss": false,
    "story": "挑战者知道你学过邓肯的防守站位，要求你在半场守住他的突破，验证基本功能否变成单挑优势。",
    "attr": "def",
    "dimension": "perimeterStop",
    "jersey": null,
    "cost": 0,
    "rewardText": "外线限制 +5%"
  },
  {
    "id": "C04",
    "name": "后仰对决",
    "type": "C",
    "category": "单挑挑战",
    "players": [
      "kobe"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "一名老练的单挑客认出你练过科比的后仰，贴身压缩出手空间，要求你在干扰下完成这一球。",
    "attr": "mid",
    "dimension": "shooting",
    "jersey": null,
    "cost": 0,
    "rewardText": "投射威胁 +5%"
  },
  {
    "id": "C05",
    "name": "低位重量",
    "type": "C",
    "category": "单挑挑战",
    "players": [
      "hakeem"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "高大的挑战者要检验你的梦幻脚步，不许用远投解决这一球；你必须独自找到篮下转身终结的空间。",
    "attr": "drive",
    "dimension": "finishing",
    "jersey": null,
    "cost": 0,
    "rewardText": "禁区终结 +5%"
  },
  {
    "id": "C06",
    "name": "一臂之内",
    "type": "C",
    "category": "单挑挑战",
    "players": [
      "russell"
    ],
    "minStage": 1,
    "afterLoss": false,
    "story": "你刚看完拉塞尔的防守影像，场边挑战者便标出一臂距离，要求你不抢断、不提前起跳，守住一次突破。",
    "attr": "def",
    "dimension": "perimeterStop",
    "jersey": null,
    "cost": 0,
    "rewardText": "外线限制 +5%"
  },
  {
    "id": "C07",
    "name": "答案在脚下",
    "type": "C",
    "category": "单挑挑战",
    "players": [
      "iverson"
    ],
    "minStage": 3,
    "afterLoss": false,
    "story": "保管3号球衣的人让你先过掉眼前的贴身防守者，答案藏在第一次交叉步之后。",
    "attr": "handle",
    "dimension": null,
    "jersey": "iverson_sixers_jersey",
    "cost": 0,
    "rewardText": "76人·3号球衣"
  },
  {
    "id": "C08",
    "name": "梦境转身",
    "type": "C",
    "category": "单挑挑战",
    "players": [
      "hakeem"
    ],
    "minStage": 3,
    "afterLoss": false,
    "story": "半场挑战者要求你在两次转身以内完成篮下终结，做到便交出珍藏的34号球衣。",
    "attr": "drive",
    "dimension": null,
    "jersey": "olajuwon_rockets_jersey",
    "cost": 0,
    "rewardText": "火箭·34号球衣"
  },
  {
    "id": "C09",
    "name": "长臂下的出手",
    "type": "C",
    "category": "单挑挑战",
    "players": [
      "durant"
    ],
    "minStage": 3,
    "afterLoss": false,
    "story": "防守者高举双臂，要求你在有限的出手空间里完成一球，35号球衣就是这次试炼的奖品。",
    "attr": "mid",
    "dimension": null,
    "jersey": "durant_thunder_jersey",
    "cost": 0,
    "rewardText": "雷霆·35号球衣"
  },
  {
    "id": "P01",
    "name": "球场补给摊",
    "type": "P",
    "category": "剧情抉择",
    "players": [],
    "minStage": 2,
    "afterLoss": false,
    "story": "管理员想在散场前摆一张补给桌，邀请你出一半成本，再用自己的招牌吸引观众。",
    "attr": "handle",
    "dimension": null,
    "jersey": null,
    "cost": 5,
    "rewardText": "投入5：成功到账15（净赚10），失败本金损失 / 放弃，0收益"
  },
  {
    "id": "P02",
    "name": "夜场灯光筹备",
    "type": "P",
    "category": "剧情抉择",
    "players": [],
    "minStage": 4,
    "afterLoss": false,
    "story": "场边商户愿意支持下一场夜间单挑，但先要你拿出场地准备金，并展示足够稳定的投篮。",
    "attr": "three",
    "dimension": null,
    "jersey": null,
    "cost": 6,
    "rewardText": "投入6：成功到账18（净赚12），失败本金损失 / 放弃，0收益"
  },
  {
    "id": "P03",
    "name": "单挑影像制作",
    "type": "P",
    "category": "剧情抉择",
    "players": [],
    "minStage": 6,
    "afterLoss": false,
    "story": "摄影师愿意制作你的单挑教学片，你需要先出制作费，再录出能卖得出去的持球演示。",
    "attr": "handle",
    "dimension": null,
    "jersey": null,
    "cost": 8,
    "rewardText": "投入8：成功到账24（净赚16），失败本金损失 / 放弃，0收益"
  },
  {
    "id": "P05",
    "name": "重写败局",
    "type": "P",
    "category": "剧情抉择",
    "players": [],
    "minStage": 1,
    "afterLoss": true,
    "story": "你想连夜改掉刚才的防守习惯，也可以只修正最明显的站位，给下次挑战留一点余地。",
    "attr": "def",
    "dimension": "perimeterStop",
    "jersey": null,
    "cost": 0,
    "rewardText": "全面复盘：外线限制 +3～5%，失败无奖励 / 修正站位：+1%"
  },
  {
    "id": "R01",
    "name": "场边急救包",
    "type": "R",
    "category": "救援奇遇",
    "players": [],
    "minStage": 1,
    "afterLoss": false,
    "story": "管理员注意到你已经疲惫，拿出急救包和恢复补给，问你是否愿意付费处理再继续单挑。",
    "attr": "handle",
    "dimension": null,
    "jersey": null,
    "cost": 8,
    "rewardText": "支付8：恢复1生命，最高3 / 暂不恢复：不扣钱"
  },
  {
    "id": "X01",
    "name": "旧球场教学带",
    "type": "X",
    "category": "交易交换",
    "players": [],
    "minStage": 1,
    "afterLoss": false,
    "story": "看台下有人出售一盘旧教学带，内容专讲一对一的护球与节奏变化，观看权只需一笔奖金。",
    "attr": "handle",
    "dimension": "creation",
    "jersey": null,
    "cost": 6,
    "rewardText": "支付6：持球创造 +3% / 放弃：不扣钱"
  }
];
if(typeof module!=='undefined'&&module.exports)module.exports=events;
else root.SupFusionEventData=events;
})(typeof window!=='undefined'?window:globalThis);
