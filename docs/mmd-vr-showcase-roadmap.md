# MMD VR 展示器 — 路线图

最后更新：2026-07-27

> **当前产品重心**（VR 桌面已基线收尾并搁置，见 [vr-desktop-roadmap.md](./vr-desktop-roadmap.md)）

相关：[mmd-studio.md](./mmd-studio.md) · [vr-desktop-roadmap.md](./vr-desktop-roadmap.md) · [README.md](./README.md)

---

## 1. 产品定位

**MMD VR Showcase** 是浏览器内的 **独立 WebGL + WebXR 展示会话**：在头盔里导入有限数量的模型与动作，**行走查看**，播放预览；**不是** MMD Studio 进 VR，也 **不是** VR 桌面里的嵌套应用。

| | MMD Studio（2D） | VR 桌面 | MMD VR 展示器 |
|--|------------------|---------|----------------|
| 会话 | 桌面 Canvas | 独立 immersive-vr 工作台 | **另一套** immersive-vr 舞台会话 |
| 渲染 | WebGL 成片；WebGPU TSL 实验 | WebGL + WebXR | **仅 WebGL + WebXR** |
| UI | 完整 DOM 侧栏 / 时间轴 / 工程 | canvas 面板 + 射线 | **极简 canvas HUD** + 射线 |
| 目标 | 制作 / 导出 | 工作台 | **观看 / 简单摆放** |

### 1.1 成片原则

1. **独立会话** — 与 VR 桌面、与 Studio WebGPU **不同时**共用同一 XR / 渲染后端；进展示器 = 新 `requestSession`（或明确结束当前会话后再进）。  
2. **WebGL only** — 禁止 WebGPU TSL、禁止 Studio 全量 `postprocessing` 栈。  
3. **有限场景** — 模型 / 动作数量有硬上限；默认关物理。  
4. **可走可看** — 支持在舞台空间内 **平滑移动（行走）+ 转向** 观察模型；注意晕动预算。  
5. **复用 runtime，不复用 Studio UI** — 加载 / 动画步进走 `mmdRuntime`（或抽出的 shared 子集）；控件全部 XR 原生重做。  
6. **后续可加轻量视觉** — 仅廉价、可关、进画质档的效果；不为「像 Studio」堆特效。

### 1.2 非目标（刻意不做）

| 非目标 | 原因 |
|--------|------|
| 完整 Studio 迁入 VR / VR 桌面嵌 Studio | DOM UI、后处理、Gizmo、工程库与 XR 模型冲突 |
| WebGPU / TSL 作展示后端 | 与 WebXR 成片路径冲突；文档已禁 |
| 全量后处理（bloom/SSR/DoF/…） | 立体 + Quest 预算；后续仅允许 **白名单轻量** 项 |
| 项目 DB / WebCodecs 导出 / 实时录制 | 展示器范围外 |
| 桌面 Gizmo / Orbit 直接复用 | 指针模型不同；改用行走 + 可选简单 TRS |
| 无限模型 / 文件夹批导入 UX | 头盔输入与内存；见上限表 |
| 把展示器做成 VR 桌面启动台「假窗」 | 产品分会话；可从 2D/设置 **入口跳转**，不嵌入面板 |

---

## 1.3 实现状态（代码）

| 项 | 状态 | 路径 |
|----|------|------|
| 独立会话 / overlay | ✅ | `src/mmdVrShowcase/*` + `src/xr` |
| 设置入口 + 画质细项 / FPS | ✅ | `SettingsApp` 开发者区 |
| 独立准备页导入模型 | ✅ | `mmd-vr.html` → pending assets |
| 舞台 + WebGL runtime | ✅ | `MmdVrStage` + `createMmdRuntimeHandle` |
| 播放 / 循环 / 重置视角 / 退出 | ✅ | `MmdVrHud` |
| 进度条 seek | ✅ | `mmdVrClock` + HUD（热路径不写 React） |
| 灯光预设 6 套 | ✅ | stage / soft / daylight / warm / rim / contrast |
| 模型显隐（≤3） | ✅ | visibility 队列 |
| 平滑行走 + snap 转向 | ✅ | `useXRControllerLocomotion` |
| 与 VR 桌面互斥 | ✅ | `requestImmersiveEnter` |
| 点地放置模型 (M13) | ✅ | placeMode + 地面射线 |
| 模型连续缩放 / 旋转 / 复位 | ✅ | 每模型 HUD；复位恢复初始队列位置 |
| 用户身高补偿 | ✅ | -2m–+20m HUD 滑条 + 右摇杆纵轴连续调节 |
| VR 内快速设置 | ✅ | 行走速度 / FPS / 主题色 |
| HUD 空间拖动 | ✅ | 沿控制器射线调整三维位置 |
| 空态 / 错误态文案 (M14) | ✅ | emptyNoAssets / loadFailed |
| 渐变天空穹顶 (V3) | ✅ | StageSky 随灯光预设 |
| face 动作单轨 (M11) | ✅ | 准备页选择，加载后与 body 合并 |
| XR 内导入 / 多动作列表 | ❌ | v0.1 余下 |
| 角色 / 场景资产类型 | ❌ | v0.3；当前 PMX 使用同一模型槽位 |
| 轻量视觉白名单其余 | 部分 | V1 exposure 已实现；其余 v1.1 |

---

## 2. 范围边界（v0 约定）

### 2.1 资源上限（初值，可手测后调）

| 项 | 初值上限 | 说明 |
|----|----------|------|
| 同时加载模型 | **1–3** | 默认 1；UI 明确「已达上限」 |
| 每模型 body 动作 | **1** 主轨（可换） | 不设多轨混叠时间轴 |
| face / morph 动作 | **0–1** 可选 | v0 可仅 body |
| camera 动作 | **不做**（v0） | 相机以用户行走为准 |
| 贴图分辨率 | 随画质档降采样可选 | 低档优先稳帧 |
| Bullet 物理 | **默认关** | 后续可选实验，不进默认 |

### 2.2 交互（目标体验）

| 能力 | v0 | 后续 |
|------|----|------|
| 进入 / 退出 XR | ✅ | — |
| 平滑行走（摇杆/拇指） | ✅ | 速度档、晕动选项 |
| Snap 或平滑转向 | ✅ 至少一种 | 与 VR 桌面策略对齐可调 |
| 播放 / 暂停 / 重播 / 循环 | ✅ | 简易进度条 |
| 导入模型（PMX 等） | ✅ 有限；优先 2D 预选再进 VR，或 XR 内文件选择（能力因平台） | 最近使用列表 |
| 导入 / 切换动作（VMD 等） | ✅ 单 body + 单 face | 每模型动作配置、多动作列表 |
| 模型位姿微调 | ✅ 点地位置、Y 轴旋转、连续缩放、复位 | 轴约束拖动 |
| 舞台地面 / 简单灯光 | ✅ | 天空 / IBL 轻量 |
| 画质档 | ✅ 高/均衡/低 | 与视觉开关绑定 |
| 轻量视觉效果 | ❌ v0 | 见 §4 v1.1 |

### 2.3 入口（产品流）

推荐顺序（可并存）：

```
2D MMD Studio 或 设置 / 控制中心
  →「VR 展示」/ requestMmdVrEnter（click 内）
      · 可选：Studio 写入 pending assets
      · openOverlay + preload + requestSession（并行）
  → AttachPending：gl.xr.setSession(pending)
  → 加载 session assets → 行走 / 播放 / HUD
  → 退出 → 回 2D（不自动进 VR 桌面）
```

- **不**从 VR 桌面 `openApp` 嵌展示器。  
- 若用户已在 VR 桌面：须 **先结束 VR 桌面会话** 再进展示（或入口禁用并提示）。  
- HTTPS / 手势规则与 [vr-desktop-roadmap.md](./vr-desktop-roadmap.md) §5 一致。

---

## 3. 工程结构（当前）

```
src/xr/                      # 与 VR 桌面共用的 WebXR 核心
  createProductXrSession · qualityAxes · createXrSceneMountGuard …

src/shared/panelTexture.ts   # createPanelTexture / secondary btn / FPS（无 React）

src/mmdVrShowcase/
  requestMmdVrEnter.ts       # → requestImmersiveEnter + assets 握手
  mmdVrSession.ts            # → createProductXrSession（独立实例）
  mmdVrStore.ts · mmdVrQuality.ts · mmdVrAssets.ts · mmdVrClock.ts
  MmdVrOverlay.tsx · MmdVrScene.tsx
  components/                # Stage / Hud / PlayerRig / SessionBridge
```

**复用**

| 复用 | 不复用 |
|------|--------|
| `src/xr` 进入 / attach / quality 轴 / lifecycle | 与 VR 桌面**分会话实例** |
| `shared/panelTexture` HUD 按钮 | 不依赖 `vrDesktop/*` |
| `mmdRuntime` 加载与 per-frame 更新（WebGL） | `MmdSidePanel` / 完整 Studio store UI |
| loader / 材质 WebGL 路径 | `mmdTslPipeline` / WebGPU bridge |
| 画质预设 + 细项（共用轴 + 本产品 knobs） | Studio `MmdPostFx` 全栈 |

依赖：已有 `three` · `@react-three/fiber` · `@react-three/xr` · `@yohawing/three-mmd-loader`；**不**为展示器新增 WebGPU 路径。

---

## 4. 阶段规划

### v0 — 可玩展示（MVP）

目标：Quest 上能进、能走、能播 1 个模型 + 1 个动作。

| ID | 任务 | 优先级 | 验收 |
|----|------|--------|------|
| M0 | 独立入口 + lazy Scene + 会话进入/退出 | P0 | ✅ 设置 / Studio；`src/mmdVrShowcase` |
| M1 | 舞台：地面、基础方向光、环境光、参考网格（可关） | P0 | ✅ `MmdVrStage` |
| M2 | 加载 1 模型（WebGL runtime）并显示 | P0 | ✅ pending assets → `addModel` |
| M3 | 加载 1 body 动作；播放/暂停/循环 | P0 | ✅ HUD；face 可选随清单 |
| M4 | 行走 locomotion + 转向 | P0 | ✅ 平滑走 + snap 30° |
| M5 | 画质三档（dpr / 阴影 / 网格） | P1 | ✅ prefs + `mmdVrQuality` |
| M6 | 有限导入：第 2–3 模型或换动作（达上限提示） | P1 | 部分：Studio 最多送 3；XR 内导入未做 |
| M7 | 2D 预选清单 → VR 读取（推荐路径） | P1 | ✅ 独立准备页 |
| M8 | Quest 手测记录（机型 / 档 / 模型复杂度） | P0 | 部分：已确认进入、加载与 HUD；型号/FPS/复杂度矩阵待记录 |

### v0.1 — 导入与清单打磨

| ID | 任务 | 说明 |
|----|------|------|
| M10 | 最近使用 / 会话清单持久化（localStorage） | 体积与权限注意；只存句柄元数据时需设计 |
| M11 | face/morph 动作可选一条 | ✅ 准备页可选一条 face VMD；无完整 morph 浏览器 |
| M12 | 模型列表：显隐 / 移除 / 切换当前动作 | 部分：显隐、目标选择、缩放、旋转、复位已做；移除/换动作未做 |
| M13 | 简单模型位姿（射线点地放置或轴约束拖） | ✅ 点地放置、Y 轴 15° 旋转、连续缩放和整模型复位；不做完整 Gizmo |
| M14 | 空态 / 错误态文案（中英若项目已有 i18n） | ✅ 无资产 / 加载中 / 失败 |

### v0.2 — Quest 稳定性签字（当前）

| ID | 任务 | 状态 / 验收 |
|----|------|-------------|
| S1 | Quest 会话可靠进入 | ✅ 不在 renderer attach 阶段调用 framebuffer scale / foveation API |
| S2 | 角色材质正确性 | ✅ 不强制 DoubleSide；只禁用动画模型视锥剔除 |
| S3 | 双眼 HUD 与滑条 | 部分：透明排序已修；待 Quest 复测可见性与可读性 |
| S4 | 真机性能矩阵 | ⬜ 记录设备、系统、模型复杂度、1/2/3 模型和高/均衡/低档 FPS |
| S5 | 设置真实性 | ✅ 准备页不再展示当前会话不会应用的 framebuffer scale / foveation 控件 |

### v1 — 观看体验

| ID | 任务 | 说明 |
|----|------|------|
| M20 | 固定观赏点 / 重置视角 | ✅ 重置视角 |
| M21 | 简易进度条（时间或帧） | ✅ HUD 进度条可点 seek |
| M22 | 灯光预设 2–3 套 | ✅ 扩展为 6 套：stage / soft / daylight / warm / rim / contrast |
| M23 | 可选地面阴影（map，低成本） | ✅ 画质细项 shadows |
| M24 | 与 Studio 资源握手（可选） | ⛔ 已取消；保持页面/renderer 隔离 |
| M12 | 模型列表显隐 | ✅ 最多 3 条 HUD 切换 |

### v0.3 — 资产与观看闭环（下一阶段）

| ID | 任务 | 说明 |
|----|------|------|
| A1 | 角色 / 场景资产类型 | 准备页显式指定；场景不计入角色动作逻辑，材质面策略分离 |
| A2 | 每模型动作配置 | 每个角色独立选择 body / face，不再把同一动作应用到全部模型 |
| A3 | VR 内移除模型 | ✅ 模型卡片内移除；释放 runtime、材质、贴图、动作和独立 Bullet world |
| A4 | 模型级完整复位 | ✅ 初始位置、旋转和缩放已实现；真机确认交互文案 |
| A5 | 加载预算提示 | 准备页显示文件体积；能可靠读取时再增加顶点/贴图提示 |

### v0.4 — 舒适性

| ID | 任务 | 说明 |
|----|------|------|
| C1 | Snap turn 角度 | ✅ VR 内 15° / 30° / 45° 循环；默认 30° |
| C2 | 移动方向 | 头部朝向 / 左手控制器朝向 |
| C3 | 坐姿 / 站姿预设 | 复用现有身高补偿，不引入第二套高度状态 |
| C4 | 移动暗角 | 仅在 M8 表明有必要时实现；必须可关 |

### v1.1 — 轻量视觉效果（白名单）

原则：**默认关或随「高」档**；每项可单独关；禁止引入 Studio 级 EffectComposer 全家桶。

| ID | 候选效果 | 条件 |
|----|----------|------|
| V1 | 简单色调 / exposure | ✅ VR 内 0.7–1.3 调节；持久化偏好 |
| V2 | 轻 bloom 或仅 emissive 增强 | 仅高档；有开关；掉帧则砍 |
| V3 | 简单天空色 / 渐变背景 | ✅ StageSky 穹顶 + 灯光预设色 |
| V4 | 可选 HDR/IBL（低分辨率 PMREM） | 手测后；低档关 |
| V5 | 雾 / 暗角 | 已有雾；暗角未做 |

**明确延后**：SSR、DoF、体积光、复杂 LUT 链、TSL toon 专用路径。

### v2 — 可选进阶（低优先级）

| ID | 任务 | 说明 |
|----|------|------|
| X1 | Bullet 物理开关（实验） | ✅ 会话内默认关；左右控制器 grip 各注入一个 8cm 静态球形刚体；Quest 真机碰撞与性能待验收 |
| X2 | 双柄缩放舞台或模型 | 晕动与误触 |
| X3 | 手部追踪实验 | 默认关 |
| X4 | 从 VR 桌面「切换会话」引导 | 仍分会话，只做流程文案 |
| X5 | camera 动作轨道（可选） | 与用户行走互斥策略要先定 |

---

## 5. 与其它模块关系

```
                    ┌─────────────────┐
                    │  2D 桌面 / 设置  │
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
   ┌───────────────┐  ┌─────────────┐  ┌──────────────────┐
   │ MMD Studio    │  │ VR 桌面     │  │ MMD VR 展示器    │
   │ WebGL (+TSL)  │  │ WebGL XR    │  │ WebGL XR 舞台    │
   └───────┬───────┘  └─────────────┘  └────────▲─────────┘
           │     runtime 子集 / 临时清单          │
           └────────────────────────────────────┘
```

| 关系 | 约定 |
|------|------|
| vs Studio | 展示器 **消费** 加载能力；不反向把 XR UI 塞进 Studio |
| vs VR 桌面 | **分会话**；能力不合并进 `vrLauncher` 嵌面板 |
| vs shared | 若多端要共用「最近模型元数据」，再进 `src/shared`；二进制资源不进 localStorage |
| 文档 | VR 桌面 roadmap **D1** 由本文件承接细化 |

---

## 6. 性能与验收

### 6.1 预算（初值）

| 档位 | 意图 | 建议 |
|------|------|------|
| 高 | 清晰 | 阴影可开；轻量效果可开 |
| 均衡（默认） | Quest 可玩 | 目标 **≥50 FPS** 立体；1 中等模型 + 动作 |
| 低 | 稳帧 | 无阴影、无额外效果、更低 dpr |

禁止：热路径 React `setState` 刷骨骼；每帧 new 材质/光；未限数量的并行解码。

### 6.2 手测记录表

| 日期 | 设备 | 画质 | 模型规模 | 动作 | 行走 | FPS 观感 | 备注 |
|------|------|------|----------|------|------|----------|------|
|  |  |  |  |  |  |  |  |

### 6.3 风险

| 风险 | 对策 |
|------|------|
| 晕动（平滑行走） | 速度上限；可选瞬移/减少加速；设置项后续 |
| 模型过大 OOM / 掉帧 | 上限 + 低档 + 加载前体积/顶点数提示（能做则做） |
| 角色与房间 PMX 材质需求冲突 | 增加显式资产类型；禁止对所有模型统一强制 DoubleSide |
| Quest attach 阶段画质 API 卡会话 | MMD VR 暂不应用 framebuffer scale / foveation；无真机回归不得恢复 |
| 文件选择在 VR 内难用 | **2D 预选再进 VR** 作主路径 |
| 与 VR 桌面会话冲突 | 入口互斥；文档与 UI 写清 |
| 误把 Studio 后处理拷进 XR | Code review + 本非目标表 |
| 包体 | Showcase Scene lazy；MMD vendor 已分包则保持 |

---

## 7. 近期建议顺序（执行）

> 全项目 VR 人力优先本文件；勿回流做 VR 桌面新 app。

1. **S3 / S4 / M8**：Quest 双眼 HUD 复测与性能矩阵签字（记 §6 表）
2. **A1**：区分角色与场景资产，解决房间内表面与角色材质策略冲突
3. **A2**：每模型动作配置，完成资产清单闭环；A3 已完成
4. **C2**：移动方向；C1 已完成，再依据真机反馈决定 C3 / C4
5. **V4**：只有性能矩阵留有预算时评估 IBL；V1 已完成，bloom 继续延后

**已完成可跳过：** M0–M5、M7、M11、M13、M14、M20–M23、V3，以及模型缩放/旋转/复位、身高补偿和 VR 内快速设置。X1 已完成实验实现，但必须通过 Quest 真机碰撞与性能验收后才能视为稳定能力。

---

## 8. 决策记录（摘要）

| 决策 | 选择 |
|------|------|
| 完整 Studio 进 VR？ | **否** |
| 嵌进 VR 桌面面板？ | **否** |
| 渲染 | **WebGL + WebXR only** |
| 物理默认 | **关** |
| 控制器物理碰撞 | **实验性**；左右 grip 以 8cm 静态球形刚体进入每个启用物理的模型 Bullet world；tracking 丢失时移出场景 |
| 相机动作 v0 | **不做**（用户行走） |
| 视觉效果 | **后续白名单**，非 Studio 全栈 |
| 导入主路径 | **2D 预选 → VR**；XR 内导入为辅 |
| Quest framebuffer scale / foveation | attach 阶段暂不应用；稳定性优先于暴露无效设置 |
| PMX 角色与场景 | 下一阶段显式分类，不再依赖材质启发式判断 |

---

## 9. 参考

- [mmd-studio.md](./mmd-studio.md) — Studio 能力与 runtime 约定  
- [vr-desktop-roadmap.md](./vr-desktop-roadmap.md) — WebXR 进入/性能/非目标；**D1**  
- [Immersive Web](https://immersiveweb.dev/)  
- [three.js WebXR](https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content)  
- [@react-three/xr](https://docs.pmnd.rs/xr)  
- [R3F pitfalls](https://docs.pmnd.rs/react-three-fiber/advanced/pitfalls)  
