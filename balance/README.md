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

第一轮仅执行小样本。批量命令已提供，但至少1000局的平衡研究需在一致性验证结果汇报后开始。smoke 默认五类玩家各4局，使用4个共享种子；指定单一策略时每局使用不同种子。未指定 --policy 时五种策略轮流分配。

策略：random、novice、ordinary、expert、extreme。默认广告关闭；--ads rewarded-success 明确表示假定广告成功后的合法奖励，不代表实际广告可用。日志保存广告条件和账号进度。

## 输入配置

--config 指向JSON文件。可配置 seed、policySeed、setupSeed、policy、profile、rulesVersion、maxStage、maxBattles、maxActions、maxActionsPerBattle、maxMs、ads。默认500关、2000场战斗、30000操作、每场前120操作、30秒；独立worker提供额外2秒关闭宽限。

正常模式从天赋候选和6次初始招募开始，遵循真实经济与操作时机。profile 默认全新账号，每局独立；成熟账号需提供明确的局外进度，不能混入新账号统计。显式talent须在本局可见候选内。

scenario 必须带 label；支持 stage、players（前6名依次为三分/中投/突破/控球/篮下/防守，其余为备战席）、growth（按球员ID指定 stars/train/trainedAt）、cash、morale、gear、gearReserve、boosts、eventBonuses。所有预设场景标记 mode=scenario，不能证明资金可达性。当前尚未提供自定义球员基础属性、技能定义或强制羁绊配置，后续实验入口需在独立引擎实例内实现。

## 流程与策略边界

行动驱动器枚举当前可行操作：招募与十连、满员处理、训练、换位、装备、出售、扩容、刷新、战斗、继续、事件与确认。每次实际操作调用真实核心，不提前生成未来候选，不尝试当前随机状态的战斗结果。十连随机玩家逐张独立选择保留/出售。

AI仅接收冻结的公开观察数据。对手隐藏战术、RNG状态、未来事件和候选不会传入策略。高手可通过已经发生的克制结果学习对手倾向；极限策略在当前可见招募/装备及已有阵容内搜索下一步换位收益，是有限搜索策略，不能称为全局最优。

## 记录与验证

每局JSON保存源文件哈希、配置、初始状态、天赋候选、全部操作、操作前后资源/属性/阵容/事件、完整核心状态、随机状态和战斗报告。对局种子和AI种子分开；AI日志不包含私有状态。输出最高尝试关卡与最高已通关关卡，死亡和截尾分开。

replay逐操作核对状态哈希。validate 使用浏览器全局加载方式再次回放每次操作，再通过真实云端验证器检查每场战斗及其前序操作，事件和最终尾部也核对状态。本地前后端核心必须一致；验证不发起网络请求。这是代码路径一致性验证，不代表真机WebView验收。

达到关卡、战斗、时间、操作上限记录 censored；真实生命归零记录 death；异常记录 error。worker强制超时保留最近检查点并标记 partial，不冒充完整可复现记录。

## 当前阶段与后续

已提供单局、批量、5类策略、种子复现、资源账本、事件日志和三路回放验证。此阶段不自动生成平衡结论。

后续：完整战斗攻防诊断（当前核心只保存最后7条战报，因此不能猜测攻防次数）；配置隔离与A/B；事件合格机会/出现频率；截尾存活统计、置信区间、构筑分布、属性边际收益对照；据实际批量数据生成根目录 BALANCE_REPORT.md。不得把操作次数当作战斗攻防次数，不得把使用率与胜率相关性当作装备的因果强度。
