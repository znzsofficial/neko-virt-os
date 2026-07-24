# VR 桌面（WebXR）— 路线图

最后更新：2026-07-24  

> **状态：基线收尾 · 暂缓**  
> 不再新增 VR 桌面功能；维护级 bugfix 除外。  
> **当前产品重心 → [MMD VR 展示器](./mmd-vr-showcase-roadmap.md)**。

## 1. 产品定位

**NekoVirtOS VR** 是浏览器内的 **独立沉浸工作台**，不是 2D 桌面的镜像，也不是把 `react-rnd` 窗口像素流进头盔。

| | 2D 桌面 | VR 桌面 |
|--|---------|---------|
| 渲染 | DOM + CSS | WebGL + WebXR（`@react-three/xr`） |
| 应用 | 完整 app 模块 | **仅 VR 原生表面**（当前：浏览器、便签预览） |
| 启动耦合 | — | **禁止** `openApp` / 因点应用而 `endSession` |
| 退出 | — | 用户主动「退出」或锁屏 |

与 **MMD Studio**：分会话；禁止 VR 内接 MMD WebGPU TSL / 全量 postprocessing。

### 1.1 成片原则

1. **Stay in VR** — 除退出与锁屏外，交互不得把用户踢回 2D。  
2. **VR-native only** — 启动台只列有 VR 实现的能力；未实现则状态提示，不打开 2D 窗。  
3. **HTTPS 真源** — 会话成败以 click 内 `requestSession` 为准，不以 `isSessionSupported === false` 锁死入口。  
4. **轻量画布 UI** — 面板 = Canvas 贴图 + 射线；不用 uikit/troika（除非 canvas 交互成本过高再评估）。  
5. **可动可记** — 主面板可拖拽，位姿本地持久化，可一键重置。

### 1.2 非目标（刻意不做）

- 整桌面 / 全窗口像素流进 VR  
- 离屏 DOM → 纹理跑完整 2D app  
- 进 VR 前说明 dialog（打断 WebXR 用户手势）  
- Safari / Firefox 默认可用承诺  
- WebGPU 作为 VR 渲染后端  
- VR 内 postprocessing 全栈  

---

## 2. 当前基线（v1 — 已交付）

### 2.1 能力清单

| 模块 | 状态 | 说明 |
|------|------|------|
| 进入 / 退出 immersive-vr | ✅ | 设置 + 控制中心；Quest 手势同步 `requestSession` |
| 能力探测 | ✅ | HTTPS 硬门槛；`isSessionSupported` 仅记 true |
| 主屏 | ✅ | 时钟 12/24h、日期、窗口数 pill、status 行 |
| 应用屏 | ✅ | VR 独立启动台（空间：浏览器 / 便签） |
| 便签预览 | ✅ | 读 `shared` 便签存储，不打开 2D 便签板 |
| VR 浏览器 | ✅ | canvas 导航 + Html iframe；**书签目前用默认目录**（不读 2D 用户书签） |
| 拖拽布局 | ✅ | 主屏 / 应用 / 便签 / 浏览器；边框与顶条拖拽 |
| 布局持久化 | ✅ | `vrLayoutStore` → localStorage |
| 重置布局 | ✅ | 场景钮 + 设置；回默认位姿 + 视角归零 |
| Snap turn | ✅ | 30°，无连续平移 |
| 画质档 | ✅ | 预设高/均衡/低 + **细项**（DPR / 面板分辨率 / 目标帧率 / AA） |
| 显示帧率 | ✅ | 可选 in-scene FPS 徽章 |
| 柔化边缘 | ✅ | 可选；低画质强制关 |
| 锁屏 / idle | ✅ | VR 中不计 idle；锁屏结束 XR |
| 包体 | ✅ | Scene lazy load |
| 与 MMD 展示互斥 | ✅ | `requestImmersiveEnter` 互斥；独立 XR store |

### 2.2 工程结构

```
src/xr/                     # 共用 WebXR 核心（分会话实例）
  createProductXrSession · qualityAxes · createXrSceneMountGuard
  requestImmersiveEnter · AttachPendingXrSession · pendingSessionSlot …

src/shared/                 # 2D + VR 业务域（无 React UI）
  sticky/ · browser/ · panelTexture.ts · localPrefs.ts

src/appModules/*App.tsx     # 仅 2D 壳

src/vrDesktop/              # VR 桌面表面（薄包装 + 业务）
  requestVrEnter.ts · vrSession.ts   # → createProductXrSession
  vrDesktopStore · vrQuality · vrLayout* · vrLauncher
  vrPanelTexture.ts         # 桌面专用 paint；原语 re-export shared
  usePanelTexture.ts · VrDesktopScene.tsx · components/
```

依赖：`three` · `@react-three/fiber` · `@react-three/xr` · `zustand` · `@react-three/drei`（Html iframe）

### 2.3 会话流

```
设置 / 控制中心 onClick
  → requestImmersiveEnter
      · 互斥检查（MMD 展示占用则失败）
      · openOverlay + preload Scene   # 与 requestSession 并行暖 Canvas
      · beginFromClick → requestSession（手势栈内同步启动）
  → AttachPendingXrSession：gl.xr.setSession(pending)（可重试）
  → phase active；使用（拖拽 / 浏览器 / …）
  → 退出钮 | sessionend | lockSession
  → endVrDesktopSession + closeOverlay
```

---

## 3. 阶段规划（已冻结）

**自 2026-07-24 起：v1.1+ / v1.2 / v2 桌面新功能一律搁置。**  
仅保留：崩溃级 / 进不了会话 / 安全相关修复。  
产品推进见 [mmd-vr-showcase-roadmap.md](./mmd-vr-showcase-roadmap.md)。

### 3.1 基线已交付（冻结清单）

| 能力 | 状态 |
|------|------|
| 独立 immersive-vr 会话 + click 内 `requestSession` | ✅ |
| 与 MMD 展示器会话互斥 | ✅ |
| 主屏 / 启动台 / 便签预览 / VR 浏览器 | ✅ |
| 拖拽布局 + 持久化 + 重置 | ✅ |
| 画质预设 + 细项（DPR / 面板 / 帧率 / AA） | ✅ |
| 首次进 VR 挂载竞态修复 | ✅ |
| 设置 / 控制中心入口 | ✅ |

### 3.2 原 v1.1–v2  backlog（不执行，仅归档）

| ID | 原任务 | 备注 |
|----|--------|------|
| A1–A6 | 帧率签字、拖拽手感、浏览器文案、书签统一… | 搁置 |
| B1–B5 | 时钟增强、便签编辑、计算器、设置片… | 搁置 |
| C1–C4 | 双柄缩放、吸附、手部、空间音频 | 搁置 |
| D1 | MMD 独立展示器 | **已拆出** → mmd-vr-showcase；**当前重心** |
| D2–D4 | AR / uikit / 离屏 DOM | 仍非目标或搁置 |

---

## 4. 明确不做的路线（更新）

| 想法 | 决定 |
|------|------|
| 点 VR 应用 → 退会话开 2D 窗 | **已废弃** |
| 后台 `openApp` 假装联动 | **已废弃** |
| 2D 整桌面像素流 | **不做**（非目标） |
| 进 VR 前系统 intro dialog | **不做**（手势） |

---

## 5. WebXR / 性能备忘

### 检测

| 层级 | 规则 |
|------|------|
| 硬门槛 | `isSecureContext` |
| API | click 时 `navigator.xr` |
| 建议探测 | `isSessionSupported` 只吸收 **true** |
| 真源 | 同步 `requestSession` |

### 性能

- 禁止热路径 React `setState`  
- 贴图：`generateMipmaps = false`；面板 `FrontSide`  
- 时钟 / hover：原地 canvas + `needsUpdate`  
- `frameloop = always`（会话中）  
- dpr / AA / 贴图缩放 / 目标帧率 → `vrQuality` 预设 + 细项覆盖  
- 默认不开 hand-tracking optional  
- 首次进入：`openOverlay` 与 `requestSession` 并行；overlay 仍开时不因 remount 杀会话  
- 会话核心在 `src/xr`；桌面 / MMD 各持独立 store + pending slot  

### 画质档（手测表）

| 档位 | 意图 | 手测记录 |
|------|------|----------|
| 高 | 清晰优先 |  |
| 均衡（默认） | ≥50–72 FPS 可玩 |  |
| 低 | 稳帧优先 |  |

---

## 6. 风险

| 风险 | 对策 |
|------|------|
| 手势链断裂 | 进入路径无 await dialog / 无 await probe |
| iframe 被拒 | 文案 + 书签切换；不退 VR |
| 拖拽 vs 点击 | 边框/顶条拖；内容面点击；位移阈值 |
| 晕动 | 仅 snap turn；少加速 |
| 包体 | Scene lazy；不引 uikit |

---

## 7. 近期建议顺序（执行）

**VR 桌面：无。** 仅维护。

**全项目优先（MMD VR）：** 见 [mmd-vr-showcase-roadmap.md](./mmd-vr-showcase-roadmap.md) §7。

---

## 8. 参考

- [Immersive Web](https://immersiveweb.dev/)  
- [three.js WebXR](https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content)  
- [@react-three/xr](https://docs.pmnd.rs/xr)  
- [R3F pitfalls](https://docs.pmnd.rs/react-three-fiber/advanced/pitfalls)  
- `docs/mmd-studio.md` · `docs/settings-roadmap.md` · `docs/README.md`  
