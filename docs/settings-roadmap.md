# Settings Roadmap

最后核对：2026-07-31

## 目标

设置页应是 NekoVirtOS 所有用户偏好的可信入口：修改立即生效、持久化结果可预期、备份范围明确、危险操作不误导，并在可调整大小的桌面窗口中保持可用。

本文只维护尚未完成或需要重新验证的工作。已稳定交付的控件不再逐项堆积历史记录；其实现以代码、测试和版本记录为准。

## 产品规则

- 设置默认立即生效；若无法持久化，必须提示“仅本次会话有效”，不能静默假装保存成功。
- 互斥选项使用 radio 语义，开关使用有可访问名称的 switch/checkbox 语义；不能只依赖颜色或 `.is-active` 表达状态。
- 文案保持简洁，但异步状态、失败原因、隐私影响和不可逆后果必须明确说明。
- “导入设置”必须明确采用覆盖还是合并语义；“清除站点数据”必须与实际删除范围一致。
- 网络与高熵设备探测按需执行，不应仅因打开设置页而联系第三方服务或采集额外设备信息。
- 响应式布局以设置窗口的容器宽度为准，而不是只看浏览器 viewport。
- VR 桌面保留在开发者分区；MMD VR 已迁移到独立准备页，不再属于设置页。

## 当前状态

| 分区 | 已交付能力 | 待完善状态 |
|------|------------|------------|
| 通用 | 语言、时间格式、自动锁屏、任务栏、小组件、桌面排列、辅助功能 | 控件语义、持久化失败反馈、设置深链 |
| 外观 | 主题、强调色、密度、亮/暗壁纸、适配和遮罩 | 共享响应式 theme store、壁纸竞态与缩略图成本 |
| 通知 | 免打扰、时段、横幅时长、类别开关 | 时段校验、等时刻语义、禁用态和测试 |
| 网络 | 在线状态、公网/本地地址、RTT、浏览器网络估计 | 改为按需诊断、显式 loading/error、取消和竞态治理 |
| 数据 | 存储估算、JSON v1 导入导出、缓存/文件/站点数据操作 | 备份 v2、完整 reset 边界、busy/partial failure |
| 开发者 | 动画质量、FPS、调试边框、VR 桌面与画质 | 不可用时禁用进入、诊断本地化、能力测试 |
| 关于 | 版本、设备信息、开源许可 | About 深链、重复实现清理、按需设备探测 |

## P0：数据安全与可信持久化

### 1. 统一站点数据清理

状态：基础修复已完成，待浏览器故障注入验证。

`siteDataReset.ts` 已统一执行 Cache Storage、MMD 工程、虚拟文件和应用偏好清理；localStorage 只删除 `neko-virt-os.` 命名空间，阶段失败会汇总并阻止虚假完成/reload。设置页已提供 busy 状态和部分失败反馈。

剩余工作：

- 将“重置设置”“重置虚拟文件”“删除 MMD 工程”“完整重置”定义为不同操作，或在完整重置确认中逐项列明范围。
- 将 Cache Storage 也纳入显式应用数据注册表，避免未来同源部署其他应用时误删其缓存。
- 浏览器集成测试覆盖真实 Dexie、Cache Storage 和受限存储环境。

验收：

- 自动测试证明每种 reset 只删除声明范围。
- 完整重置覆盖所有应用数据库和持久化 key。
- 模拟任一阶段失败时，用户能看到具体失败阶段，且不会收到虚假的完成提示。

### 2. 设置备份 v2

状态：核心实现已完成，待浏览器受限存储验证。

新导出已升级为严格校验的 JSON v2，覆盖语言、主题、通知、系统、辅助/开发者、小组件、桌面排列模式、工作区、VR 桌面与 MMD VR 偏好。v1 仍可导入，并用当前值补齐旧格式中不存在的字段。导入会先完成 schema 校验和规范化，写入失败时尝试恢复全部目标 key，成功写入后才应用 DOM 效果。

已完成：

- 使用运行时 schema 校验完整数据结构、未知字段、枚举和 DND 时间格式。
- v2 对声明范围采用完整快照；v1 迁移按当前值补齐缺失字段，UI 使用“合并偏好”说明兼容语义。
- 纳入语言、主题、通知、系统、辅助/开发者、小组件、桌面排列模式、工作区、VR 桌面与 MMD VR 偏好；MMD VR 的旧刷新率枚举（high/mid/low）与旧存储 key 在导入时归一化。
- 将窗口坐标与桌面图标位置作为可选的“包含布局”，不要默认混入偏好备份。
- 保留 v1 导入迁移；新导出只生成 v2。
- 导入前完成校验和规范化；写入失败时回滚原值并显示失败反馈。

剩余工作：

- 若未来增加“包含布局”，将窗口坐标和桌面图标位置作为显式可选项，不改变默认备份边界。
- 浏览器集成测试覆盖真实 quota、`SecurityError` 和回滚写入本身失败的极端情况。

验收：

- v2 export → 清空 → import 后，范围内设置 round-trip 相等。（已覆盖）
- 非法字段、未知字段、写入失败及 v1 迁移均有测试。（已覆盖）
- UI 明确列出备份包含与不包含的内容。（已完成）

### 3. 统一持久化失败策略

当前部分 store 会让 localStorage 异常冒泡，部分模块则吞掉异常并只在当前会话生效，行为不一致。

工作项：

- 为偏好存储提供统一读写接口和结构化结果。
- 内存状态仍可更新，但失败时只展示一次非骚扰式会话提示。
- 区分 storage unavailable、quota 和未知错误，避免每个控件自行处理。

验收：

- 在 `SecurityError`、quota 和损坏 JSON 下，设置页仍可操作且状态说明准确。

## P1：隐私、异步状态与可靠性

### 4. 按需网络和设备诊断

状态：核心实现已完成，待浏览器与隐私验证。

设置首页不再自动执行 storage estimate、高熵 UA、公网 IP 或 STUN/WebRTC 探测。存储与设备信息仅在首次进入对应分区时读取并在本次设置会话缓存；公网 IP 和 WebRTC 诊断必须由用户点击“运行诊断”，页面会事先说明第三方服务。网络请求使用 AbortSignal 和 generation，离开分区、连接变化或重复刷新会取消旧任务并忽略 stale completion。

已完成：

- 仅进入数据分区时读取 storage estimate。
- 仅进入关于分区时读取高熵设备信息。
- 网络基础状态进入网络分区后加载；公网 IP 和 WebRTC 探测改为用户触发的“运行诊断”。
- 在触发前说明会联系公网 IP/STUN 服务。
- 同一设置会话缓存结果，手动刷新时取消旧请求并忽略 stale completion。
- 使用 `idle/loading/ready/error` 状态，初次加载不能误显示为“离线”。

剩余工作：

- 浏览器验证 Chrome/Firefox/Safari 对 STUN、mDNS、AbortSignal 和权限策略的差异。
- 若产品需要完全无第三方诊断模式，将浏览器基础网络状态拆成不联系外部服务的独立操作。

验收：

- 未进入相应分区时没有网络诊断请求和高熵设备读取。（已完成）
- 重叠刷新、取消、构造 WebRTC 失败和第三方超时均不会产生未处理 rejection。（底层取消与构造失败已覆盖）
- 刷新完成和失败通过 `aria-live` 提供反馈。（已完成）

### 5. 异步操作状态

工作项：

- 为导入、导出、壁纸加载、缓存清理、文件重置和完整重置增加独立 busy/error 状态。
- 防止双击重复执行；错误提示区分格式错误、版本不支持、存储失败和网络资源失败。
- 壁纸选择使用 generation/abort 机制，保证最后一次选择获胜。
- “随机壁纸”放入亮色/暗色各自分区，避免目前默认只修改亮色壁纸的歧义。

## P1：可访问性与窗口适配

### 6. 控件语义

状态：核心实现已完成，待真实读屏和浏览器焦点验证。

已完成：

- `SettingsSwitch` 统一使用受控原生 checkbox + `role="switch"`，并要求传入可访问名称。
- `SettingsChoiceGroup` 统一使用 fieldset/legend/radio；语言、主题、密度、时间格式、自动锁屏、桌面排列、强调色、壁纸 fit/overlay、通知时长、动画质量及 VR 画质均已迁移。
- 壁纸缩略图改为原生 radio；颜色 swatch 和 pill 选项不再只依赖边框表达选中。
- 设置导航暴露 `aria-current="page"`，当前内容区域通过 `aria-labelledby` 关联分区标题。
- VR Desktop 独立应用与控制中心在 HTTPS/WebXR 不可用时禁用进入，并通过可访问说明暴露原因。
- “较大控件”模式将设置导航、开关、pill、swatch、壁纸和选择卡提升到至少 44px。
- 共享控件测试覆盖名称、checked 状态和状态变更。

剩余工作：

- 危险确认默认聚焦取消，dialog 限制焦点并在关闭后恢复触发点。
- 使用 NVDA/VoiceOver 验证导航、radio 方向键和 disabled reason 的实际播报。

验收：

- 组件测试保证所有交互元素有名称，选择状态可读，键盘可完整操作。
- 普通模式的实际点击区域不小于 36px；“较大控件”模式覆盖全部设置控件并达到 44px。

### 7. 以窗口为单位的响应式布局

状态：布局实现已完成，待尺寸矩阵视觉签字。

已完成：

- 设置窗口的 `.window-content` 建立 `settings-window` inline-size container，不再依赖 viewport。
- 宽窗口保留侧栏；680px 以下切换图标紧凑导航；480px 以下切换横向滚动导航和单列内容。
- `.settings-main` 是主要垂直滚动容器，shell 保持 hidden。
- 明确覆盖两列/三列选择组、键值表、split row 和 VR 画质细项。

剩余工作：

- 在 380/480/640/820px、中文/英文、全部辅助模式下完成截图或人工视觉签字。

验收：

- 在设置容器宽度 380、480、640、820px 下分别验证中英文。
- 同时覆盖高对比度、减少动态效果和较大控件模式。

## P1：结构治理

### 8. 拆分 SettingsApp

状态：共享控件与 VR 配置拆分已完成；七个设置分区仍待按行为域逐步拆分。

`SettingsApp.tsx` 仍承载七个分区、探测服务、导入导出和危险操作，但 VR 配置已迁移到独立 `VrDesktopSettingsApp`，共享控件已落在 `settings/components`。

目标结构：

```text
src/appModules/settings/
  SettingsApp.tsx
  SettingsNav.tsx
  settingsSections.ts
  components/
    SettingsSwitch.tsx
    SettingsChoiceGroup.tsx
    SettingsActionRow.tsx
  sections/
    GeneralSettings.tsx
    AppearanceSettings.tsx
    NotificationSettings.tsx
    NetworkSettings.tsx
    DataSettings.tsx
    DeveloperSettings.tsx
    AboutSettings.tsx
```

约束：

- 只在分区挂载时启动该分区的 effect。
- 不为拆分而复制 store selector、控件样式和状态逻辑。
- 先建立共享控件与测试，再逐区迁移，保持行为不变。

### 9. 消除重复和过期实现

工作项：

- About 启动已通过 `settingsNavigation.ts` 聚焦 Settings 的关于分区；独立 `AboutApp.tsx` 已删除。
- 将 theme 偏好迁到响应式共享 store，避免设置页和控制中心各持有一份可能过期的本地 state。
- 清理 `settings.css` 中当前页面不再使用的 hero、metric、preview、token 等旧选择器。
- 清理未使用的 Settings i18n key；系统模块返回结构化状态，最终文案在 UI 层本地化。

## P2：功能扩展

以下功能低于正确性和可访问性，不应提前实施：

| 功能 | 建议 |
|------|------|
| 工作区数量 | 支持 2/3/4 前先定义布局迁移和备份格式 |
| 新窗口位置 | 提供居中/级联/记忆，并明确多显示区域边界 |
| 可选布局备份 | 包含窗口和桌面图标位置，独立于默认偏好备份 |
| 壁纸离线策略 | 内置小型缩略图/默认集，远程图片按需加载 |
| 设置搜索 | 分区拆分且支持深链后再实现，搜索结果可直接定位控件 |

## 测试与发布门槛

### 单元测试

- 设置备份 schema、v1 → v2 迁移、round-trip 和写入失败。
- 数据清理范围、部分失败和重复提交。
- DND 同日/跨夜/等时刻/非法输入。
- 偏好规范化和持久化不可用。

### 组件测试

- 控件名称、checked/selected 状态、键盘操作和禁用原因。
- 分区按需 effect，网络 loading/error 和 stale refresh。
- 导入、危险操作和 dialog 焦点恢复。

### 浏览器测试

- 设置窗口容器宽度 380/480/640/820px，不只测试 viewport。
- 中英文、较大控件、高对比度和减少动态效果。
- Cache Storage、IndexedDB、localStorage 受限或失败。
- About 深链、Control Center 与设置页主题同步、VR 不可用状态。

## 推荐实施顺序

1. 完整数据清单与 reset service。
2. 设置备份 v2 和持久化失败契约。
3. 可访问的 SettingsSwitch/SettingsChoiceGroup 组件。
4. 分区拆分并将诊断改为按需执行。
5. container query 与窄窗口验证。
6. About 深链、共享 theme store 和旧代码清理。
7. 工作区、窗口位置和设置搜索等新增能力。

## 相关代码

- `src/appModules/SettingsApp.tsx`
- `src/styles/settings.css`
- `src/styles/responsive.css`
- `src/system/settingsBackup.ts`
- `src/system/networkInfo.ts`
- `src/system/systemInfo.ts`
- `src/system/theme.ts`
- `src/osUiStore.ts`
- `src/windowStore.ts`
- `src/vrDesktop/`
- `src/appModules/mmdStudio/mmdProjectDb.ts`
