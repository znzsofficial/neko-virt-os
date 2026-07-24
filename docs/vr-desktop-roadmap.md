# VR 桌面（WebXR）— 规划与依赖

最后更新：2026-07-24  

UI 分期（U0–U3）已交付并归档删除；视觉结论见下文「已交付 UI」。

## 定位

在 **浏览器 + WebXR** 里提供 NekoVirtOS 的 **沉浸式入口**：Three.js / R3F **空间壳 + 虚拟屏 + 启动台**，不是把 HTML 桌面原样塞进头盔。

| 路径 | 说明 |
|------|------|
| **成片桌面** | 2D DOM |
| **VR 模式** | 独立 WebGL Canvas + `immersive-vr` |
| **与 MMD** | 分会话；禁止 VR 内 MMD WebGPU TSL / 全量 postprocessing |

### 非目标（当前）

- 不把 `react-rnd` 窗口树映射为 XR DOM  
- 不在 VR 内跑完整 postprocessing  
- 不承诺 Safari / Firefox 默认可用  
- **WebGPU 不作为 VR 渲染后端**

---

## WebXR 检测策略（成片）

| 层级 | 条件 | 用途 |
|------|------|------|
| **硬门槛** | `isSecureContext`（HTTPS / localhost） | 唯一预检拦截；HTTP 内网失败 |
| **API** | `navigator.xr` | 点击时确认 |
| **建议探测** | `isSessionSupported` 仅记 **true** | false 不禁用进入 |
| **真源** | click 内 `requestSession` → 挂 Canvas → `gl.xr.setSession` | 权限与成败 |

---

## 已交付形态

1. 地面圆盘 + 淡环 + 远雾  
2. **主屏**：时钟（12/24h）、日期、窗口数 pill  
3. **应用屏**：常用 / 系统分页；射线 hover；点选 → 退 VR + `openApp`  
4. **便签预览屏**：读 `stickyBoardStorage`，点按打开便签板  
5. **退出 / 重置布局**：左下次要钮；重置回默认面板位姿 + 视角归零  
6. Snap turn 30°；VR 画质档；可选 FPS 徽章；锁屏结束 XR；idle 在 VR 中不计  

### 已交付 UI 结论

| 项 | 状态 |
|----|------|
| 色板 / 主屏 / 应用 tint / 左下退出 | 已做 |
| hover + 打开/退出 status | 已做 |
| 柔化边缘开关 | 已做 |
| 常用/系统分页 | 已做 |
| 便签预览（canvas 纹理） | 已做 |
| uikit / troika | **不引入** |
| 离屏 DOM → 纹理 | **未做**（P2） |
| 进 VR 前 intro dialog | **不做**（断手势） |

---

## 架构

```
设置 / 控制中心 click
  → requestSession (gesture) → openOverlay
  → VrDesktopScene: setSession + Home / Apps / Sticky / Exit
  → sessionend / lock → end + closeOverlay
```

```
src/vrDesktop/
  vrDesktopStore.ts · vrSession.ts · requestVrEnter.ts
  VrDesktopOverlay.tsx · VrDesktopScene.tsx
  vrPanelTexture.ts · vrTheme.ts
```

---

## 分阶段进度

### P0 — 能进能看能点 ✅

探测、手势 enter/end、虚拟屏、射线/按钮退出、开发者开关、失败通知、HTTPS 门槛。

### P1 — 可用工作台

| 项 | 状态 |
|----|------|
| 启动台 + 分页 openApp | ✅ |
| 多屏（主屏 / 应用 / 便签 / 退出 / 重置） | ✅ |
| Snap turn / dpr / 12·24h / 锁屏 idle / 控制中心 | ✅ |
| Canvas 屏内容（非像素流） | ✅ 部分（有意不为全窗流） |
| **布局可重置** | ✅ `VR_DEFAULT_LAYOUT` + 场景「重置布局」+ 设置入口（回正视角） |
| **帧率手测支持** | ✅ VR 设置「显示帧率」+ 画质档；**真机签字验收**仍靠人工 |

### P2 — 深化（未做）

| 项 | 说明 |
|----|------|
| 抓取移屏 | 空间里拖动面板（重置已做） |
| 2D 应用像素流 / 离屏 DOM 纹理 | 真窗口进 VR |
| 手部追踪 | 现关闭 `handTracking` |
| AR（`immersive-ar`） | 未做 |
| MMD 独立 WebGL XR 预览 | 与成片桌面分会话 |
| 空间音频 | 未做 |
| uikit / troika | 仅当 canvas 不够再评估 |

---

## 会话与安全

1. Click → `beginVrSessionFromClick` + `openOverlay`（勿在 requestSession 前 await 弹窗）  
2. 失败 → `failEnter` + 通知 + 诊断串  
3. `sessionend` / unmount / `lockSession` → `endVrDesktopSession` + `closeOverlay`  
4. `is-vr-desktop`：`pointer-events: none`（overlay 除外）  
5. VR 中刷新 idle activity  

---

## 依赖

| 包 | 用途 |
|----|------|
| `three` / `@react-three/fiber` / `@react-three/xr` | WebGL + XR |
| `zustand` | store |

**明确不用**：VR+MMD WebGPU TSL；VR 内 postprocessing 全栈；WebXR–WebGPU Binding 成片。

---

## R3F 性能约定

禁止热路径 `setState`；时钟/hover **原地** canvas + `needsUpdate`；会话中 `frameloop=always`；dpr 跟省电档。

---

## 未完成任务清单（可执行）

### P1 收尾

1. ~~布局可重置~~ **已做**  
2. ~~帧率观测~~ **已做**（显示帧率 + 画质档）；Quest 手测签字：高/均衡/低下可读 FPS，目标 ≥50 可玩  

### P2（按产品优先级，均未开工）

3. 抓取移动虚拟屏  
4. 应用像素流 / 离屏 DOM 纹理  
5. 手部追踪  
6. AR 模式  
7. MMD WebGL-only XR 预览会话  
8. 空间音频  

### 验收清单（手测）

| 画质 | 目标 | 记录 |
|------|------|------|
| 高 | 清晰优先，帧率可降 | Quest 上手测 |
| 均衡 | 默认，约 ≥50–72 FPS |  |
| 低 | 优先稳帧 |  |

---

## 参考

- [Immersive Web](https://immersiveweb.dev/) · [three.js WebXR](https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content) · [@react-three/xr](https://docs.pmnd.rs/xr)  
- [R3F pitfalls](https://docs.pmnd.rs/react-three-fiber/advanced/pitfalls)  
- `docs/mmd-studio.md` · `docs/settings-roadmap.md`  
