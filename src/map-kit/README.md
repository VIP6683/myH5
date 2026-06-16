# map-kit

可独立迁移的 Mars3D 地图核心封装。

## 包含

- `core/` — Mars3D 实例、测距、定位、2D/3D、图层控制
- `config/` — 读取 `public/config.js`、`public/map-scene.js`
- `components/MarsMap.vue`、`MapContainer.vue` — 地图挂载与 overlay 插槽
- `composables/useMapContext.js`、`useMapEvent.js` — 地图实例与事件

## 不包含（在宿主项目的 `src/business/`）

- 侧栏、底栏、清屏按钮
- 教程引导、系统提示弹框
- 项目品牌文案与 POI 分类

## 样式

与宿主项目一致：**375 设计稿写 px，postcss 全部转 vw（含字号）**。迁移时一并带上 `postcss.config.js` 中的 `postcss-px-to-viewport-8-plugin` 配置。

## 迁移到其他项目

1. 拷贝 `src/map-kit/`
2. 拷贝 `public/lib/`（mars3d、Cesium、turf）
3. 拷贝 `public/config.js`、`public/map-scene.js` 并按项目修改
4. 在 `index.html` 中按顺序加载 Cesium → mars3d → 配置文件
5. 配置 postcss px→vw（`viewportWidth: 375`）
6. 在页面中组合 `MapContainer` + `MarsMap`，业务 UI 自行实现或从 `business/` 参考

```vue
<MapContainer>
  <MarsMap :map-options="getDefaultMapOptions()" @map-ready="setMapInstance" />
  <!-- 业务 overlay 放这里 -->
</MapContainer>
```
