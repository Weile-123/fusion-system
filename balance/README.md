# 无浏览器数值模拟器

直接加载 h5/game-core.js 和真实事件系统。正式游戏核心、数值和云函数不因本工具改变；模拟日志留在 artifacts/balance，不写用户存档或生产服务。

## 运行

```powershell
npm run balance:test
npm run balance:smoke -- --count 20 --out artifacts/balance/smoke
npm run balance:run -- --seed 10001 --policy expert --max-stage 500 --out artifacts/balance/run
npm run balance:replay -- --file artifacts/balance/run/expert-10001.json
npm run balance:validate -- --file artifacts/balance/run/expert-10001.json
npm run balance:batch -- --count 1000 --max-stage 500 --out artifacts/balance/batch
```

smoke 默认共20局，在当前三类策略中轮流分配；指定单一策略时每局使用不同种子。第二轮五组账号的严格等量测试使用 suite.cjs。2026-10-10已完成第二轮2000局，每组400局，详见根目录 BALANCE_REPORT.md；第一轮1000局报告已归档。

当前策略只保留 novice（新手）、ordinary（普通）、expert（高手）。默认广告关闭；--ads rewarded-success 明确表示假定广告成功后的合法奖励，不代表实际广告可用。日志保存广告条件和账号进度。

## 输入配置

第二轮新增 growthLevel：none、half、full。只配置历史账号升级与解锁池；对局现金、球员和实物装备仍由真实核心决定。半成长等级取一半四舍五入，解锁池按 seed 确定可复现的一半名单。五组为新手零成长、普通零成长、高手零成长、高手半成长、高手满成长。

```powershell
node balance/suite.cjs --pilot
node balance/suite.cjs
node balance/report-round2.cjs
```

suite 正式批次每组400局，种子40001～40400；最多1000关、180秒、2000场战斗、30000操作、每战前180动作。8个独立worker并行，不共享游戏状态。只有源指纹相同时才复用已完成文件，报告把真实死亡、截尾、异常分开。当前结果目录 artifacts/balance/batch-2000-20261010-v3，v2是发现换位振荡后停止的诊断批次，不能混入结果。

高手按 docs/多套阵容攻略-2026-10-09.md 的常规路线1推进，兼顾眼前战力与生命，允许花费真实奖金扩容至10名备战。主力与目标备战分别评估，不使用未来随机事件/抽卡结果。观察中额外提供当下成员、正确位置、星级、训练与球衣收藏进度。无尽训练上限随关卡增长，报告不能把“当前关训练上限”描述成一个永久满训状态。

--config 指向JSON文件。可配置 seed、policySeed、setupSeed、policy、profile、rulesVersion、maxStage、maxBattles、maxActions、maxActionsPerBattle、maxMs、ads。默认500关、2000场战斗、30000操作、每场前120操作、30秒；独立worker提供额外2秒关闭宽限。

正常模式从天赋候选和6次初始招募开始，遵循真实经济与操作时机。profile 默认全新账号，每局独立；成熟账号需提供明确的局外进度，不能混入新账号统计。显式talent须在本局可见候选内。

scenario 必须带 label；支持 stage、players（前6名依次为三分/中投/突破/控球/篮下/防守，其余为备战席）、growth（按球员ID指定 stars/train/trainedAt）、cash、morale、gear、gearReserve、boosts、eventBonuses。所有预设场景标记 mode=scenario，不能证明资金可达性。当前尚未提供自定义球员基础属性、技能定义或强制羁绊配置，后续实验入口需在独立引擎实例内实现。

## 流程与策略边界

行动驱动器枚举当前可行操作：招募与十连、满员处理、训练、换位、装备、出售、扩容、刷新、战斗、继续、事件与确认。每次实际操作调用真实核心，不提前生成未来候选，不尝试当前随机状态的战斗结果。十连随机玩家逐张独立选择保留/出售。

AI仅接收冻结的公开观察数据。对手隐藏战术、RNG状态、未来事件和候选不会传入策略。高手可通过已经发生的克制结果学习对手倾向，并在当前可见招募/装备及已有阵容内搜索下一步换位收益。这是有限搜索，不能称为全局最优。

## 记录与验证

每局JSON保存源文件哈希、配置、初始状态、天赋候选、全部操作、操作前后资源/属性/阵容/事件、完整核心状态、随机状态和战斗报告。对局种子和AI种子分开；AI日志不包含私有状态。输出最高尝试关卡与最高已通关关卡，死亡和截尾分开。

replay逐操作核对状态哈希。validate 使用浏览器全局加载方式再次回放每次操作，再通过真实云端验证器检查每场战斗及其前序操作，事件和最终尾部也核对状态。本地前后端核心必须一致；验证不发起网络请求。这是代码路径一致性验证，不代表真机WebView验收。

达到关卡、战斗、时间、操作上限记录 censored；真实生命归零记录 death；异常记录 error。worker强制超时保留最近检查点并标记 partial，不冒充完整可复现记录。

## 当前阶段与后续

已提供单局、批量、3类策略与5组账号、种子复现、资源账本、事件日志和三路回放验证。第二轮已生成逐关统计与通俗结论，保留原始日志和源代码快照；正式数值保持不变。

### 1000局基线记录

本轮使用全新账号、无广告、种子20001～20200、每局最多500关/60秒。记录位于 artifacts/balance/batch-1000-20261010 下的五个策略子目录，每个有200个记录与 summary.json。

```powershell
node balance/verify-batch.cjs artifacts/balance/batch-1000-20261010
node balance/analyze.cjs artifacts/balance/batch-1000-20261010 BALANCE_REPORT.md
```

以上两个旧批次命令应从 artifacts/balance/batch-1000-20261010/source/balance/ 下的旧版代码执行。原始1000局代码与报告已经归档；更新后的驱动器指纹不同，不能拿新版本冒充旧版回放。旧 analyze 要求每策略200个记录，检查源文件指纹，生成逐关、构筑、事件、资源CSV和报告，不能用于第二轮。

本轮发现 random 种子20064的动作枚举缺陷：候选刷新后奖金不足，驱动器仍列出招募，且缺少回到阵容继续战斗路径，导致1局error；正式核心正确拒绝该招募。该局不计玩家死亡。为保留原始指纹和回放，本轮没有覆盖核心/驱动器；修订驱动器后应在新目录重跑，禁止混合两版记录。其余999局死亡、无截尾，最高通关43关，不构成50～500关的验证。

后续：完整战斗攻防诊断（当前核心只保存最后7条战报，因此不能猜测攻防次数）；配置隔离与A/B；事件合格机会/出现频率；截尾存活统计、置信区间、构筑分布、属性边际收益对照；据实际批量数据生成根目录 BALANCE_REPORT.md。不得把操作次数当作战斗攻防次数，不得把使用率与胜率相关性当作装备的因果强度。
