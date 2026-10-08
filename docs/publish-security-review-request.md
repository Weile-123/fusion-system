# 《我的球星融合系统》发布安全检测复核申请

日期：2026-10-08

## 更新：已改为代码修复

此前框架复核方案未能解决审核驳回，现已调整项目的发布实现，以下“提交说明”保留作为旧版本问题定位记录，不再作为新版的主要提交依据。

### 新版提交说明

本次已将游戏页面的 React DOM 渲染实现替换为项目内的轻量 DOM 渲染层，保留原有 JSX 页面组件、游戏逻辑及虎扑接口调用。发布 JavaScript 不再包含 React DOM 依赖及其外部错误诊断链接。

1. **两处 react.dev**：通过移除发布包中的 React DOM 依赖解决，不进行域名编码、拆分或替换。
2. **JavaScript 中的 www.w3.org**：SVG 使用 HTML 中由浏览器解析创建的 SVG 模板提供的 `namespaceURI`，再通过 `createElementNS` 创建 SVG 子元素。渲染层不硬编码外部命名空间 URL，也不发起命名空间网络请求。
3. **HTML 写入入口**：新渲染层仅创建元素及文本节点，文本使用 `textContent` 更新，不包含 HTML 写入或解析入口，并拒绝 HTML 注入属性及行内事件属性。原模板的标签、属性白名单仍保留。

新版源码位置：

- `src/dom-runtime.mjs`：DOM 节点创建、文本更新、属性限制及列表复用。
- `src/main.jsx`、`src/App.jsx`：应用挂载及加载错误的文本展示。
- `src/react-screens.jsx`：现有页面组件接入项目渲染层。
- `index.html`：隐藏的 SVG 模板元素。
- `vite.config.mjs`：JSX 使用项目内渲染层构建。

独立 SVG 文件仍保留标准 `xmlns` 命名空间声明，以保证文件能够被正确解析；这些声明不属于远程资源请求。上述移除 URL 字面量的说明仅针对发布 JavaScript，不声称删除了独立 SVG 文件中的标准声明。

本次属于项目本地修复，需重新构建并提交新版发布包；平台审核结果仍以重新提交后的结果为准。

### 验证范围

- 构建产物检查：发布 JavaScript 不包含 `react.dev`、`www.w3.org` 或 React 错误诊断文字，不存在 `innerHTML`、`outerHTML` 赋值及 `insertAdjacentHTML` 调用。
- 渲染测试：验证文本不会解析为 HTML、危险属性被拒绝、SVG 心形及裁剪属性正确、按钮禁用状态能够恢复、列表节点及滚动状态能够保留。
- 游戏流程测试：现有控制器流程同时调用新版 DOM 渲染层，覆盖全部 20 种天赋、招募、阵容、商店、对战、生涯报告、图鉴，以及广告、海报和云同步相关流程。
- 尚未进行虎扑 App 真机验证，也未重新提交平台审核；自动化测试通过不等同于平台审核通过。

## 旧版复核说明（历史记录）

本项目发布审核检测到两处 `react.dev` 非批准域名、一处 `www.w3.org` 非批准域名，以及一处 HTML 解析入口风险。经对照项目源码及本地安装的 React DOM 生产代码，这些片段来自打包进发布文件的 React 框架依赖。现申请依据实际用途和业务数据调用链进行复核。

### 1. 两处 react.dev 错误说明链接

检测片段中的 `https://react.dev/errors/` 来自 React DOM 的 `formatProdErrorMessage` 函数，用于生成包含错误编号及诊断链接的异常说明文字。该函数返回字符串，不执行网络请求、资源加载或页面跳转。

两处来源分别为：

- `node_modules/react-dom/cjs/react-dom.production.js:13`
- `node_modules/react-dom/cjs/react-dom-client.production.js:18`

请将这两处错误说明字符串与实际远程资源、接口调用区分，复核是否可以排除非批准域名请求的判定。

### 2. www.w3.org 标准命名空间

React DOM 使用 `http://www.w3.org/2000/svg` 等标准命名空间，通过 `createElementNS` 创建 SVG 元素，通过 `setAttributeNS` 设置带命名空间的属性。这些 URI 用于标识元素或属性的命名空间，不用于访问对应域名，也不产生网络请求。

源码示例：

```js
ownerDocument.createElementNS("http://www.w3.org/2000/svg", type);
```

来源：`node_modules/react-dom/cjs/react-dom-client.production.js:8476`。

将标准命名空间改成批准域名或相对路径，会使其不再属于正确的 SVG 命名空间，影响图标等元素的正常显示。请根据命名空间用途复核，排除远程资源或请求的判定。

### 3. HTML 解析入口

检测片段中的属性处理函数对应 React DOM 内部的通用属性分发逻辑。其中 `innerHTML` 写入分支用于支持 React 的 `dangerouslySetInnerHTML` 属性，并不表示业务代码已经传入可控 HTML。

相关内部写入位置：

- `node_modules/react-dom/cjs/react-dom-client.production.js:14524`
- `node_modules/react-dom/cjs/react-dom-client.production.js:14742`

本项目业务渲染代码没有使用 `dangerouslySetInnerHTML`，也没有直接将模板字符串赋值给 DOM 的 `innerHTML`。模板转换为 React 元素时采取以下限制：

- 标签使用明确白名单，不允许 `script` 等执行标签。
- 属性使用明确白名单，不允许 `dangerouslySetInnerHTML`、`innerHTML`、`srcdoc` 或 `on*` 行内事件属性。
- 文本作为 React 的字符串子节点渲染，不作为 HTML 注入。
- 图片 `src` 仅允许指定的本地资源路径或同源 Blob URL；样式解析拒绝 `url()`、`expression()` 和 `@import`。

业务源码依据：

- `src/react-screens.jsx:37`：标签白名单。
- `src/react-screens.jsx:38`：属性白名单。
- `src/react-screens.jsx:67`：属性过滤及图片来源限制。
- `src/react-screens.jsx:125`：通过 `createElement` 构造 React 元素，字符串作为文本子节点。

请结合上述业务数据路径复核，不仅依据框架中存在 HTML 写入 API 判定可控数据注入。

## 复核请求

请对上述具体框架用途进行人工复核或按调用上下文排除误报。申请范围仅限于错误说明字符串、标准命名空间以及业务未使用的框架 HTML 写入分支，不申请放行实际的非批准域名请求或未经处理的 HTML 注入。

## 旧版核查状态（历史记录）

本说明基于静态源码核查；本次未修改 React 依赖或业务代码，未隐藏、编码或拆分域名字符串。平台审核结果尚待确认，本文不代表已通过发布审核。

源码行号对应本次核查时安装的依赖与项目文件；压缩后的函数名及发布文件行号可能与源码不同。
