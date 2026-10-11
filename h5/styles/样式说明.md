# 样式分工

- `tailwind.input.css`：Tailwind 3.4 构建入口，只生成 utilities，不引入 Preflight。
- `tailwind.css`：由 `npm run css:build` 生成，禁止手改。
- Tailwind utility：用于一次性的布局、间距和显示状态，例如页面挂载容器与简单网格。
- 其他 CSS：用于可复用组件、主题、卡牌、球场、商店、图鉴、动画和响应式细节。

开发样式时运行 `npm run css:watch`，交付前运行 `npm run css:build`。
