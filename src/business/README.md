# business

本项目业务层，依赖 `map-kit` 提供的地图能力，不可随 map-kit 一起迁移。

## 目录

| 目录 | 说明 |
|------|------|
| `map-shell/` | 地图页壳层：侧栏、底栏、清屏、弹框框架、动效 |
| `tutorial/` | 使用说明引导 |

## 样式约定（全项目统一）

**按 375 设计稿写 `px`，构建时 postcss 全部转 `vw`（含字号、字距）。**

- 不要手写 `vw` / `rem`
- 某条不想转时，用 `/* px-to-viewport-ignore */` 标注

## 原则

- 业务组件通过 `../../../map-kit/` 调用地图 API
- 新功能默认加在 `business/` 或 `pages/`，不要写回 `map-kit/`
- 品牌文案、POI 分类、导航结构等项目配置放这里
- **样式按组件独立维护**：改 loading 只动 `map-kit/MapLoadingOverlay.vue`，改侧栏只动 `map-shell/styles/side-menu*`，不要批量缩放整个目录
