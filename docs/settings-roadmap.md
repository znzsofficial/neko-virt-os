# Settings — 扩充计划

最后更新：2026-07-18

## 文案原则（macOS 式）

- 分区标题 + 控件标签即可，**不写说明段 / hint / 状态散文**
- 危险操作靠 **确认对话框**，不靠页面上的警告段落
- 网络 / 存储等「探测结果」只出现在对应分区，**关于页不重复**

## 当前分区

| 分区 | 状态 | 内容摘要 |
|------|------|----------|
| 通用 | 已有 | 语言 |
| 外观 | 已有 | 颜色模式、强调色、密度、壁纸 / 适配 / 遮罩 |
| 通知 | 已有 | 免打扰开关、时段 |
| 网络 | 已有 | 尽力探测（公网 IP、RTT、LAN/mDNS、浏览器估计） |
| 数据 | 已有 | 存储用量；清缓存 / 重置文件 / 清站点数据（均二次确认） |
| 开发者 | 已有 | 动画质量、FPS、调试边框 |
| 关于 | 已有 | 版本与设备信息（无网络 / 存储行）；开源包列表 |

## 优先落地（P0）

1. **通知按类别**  
   - 开关：系统 / 文件 / 应用 / 媒体  
   - 扩展 `notificationPrefs`，在 `notificationStore` 过滤  

2. **横幅时长**  
   - 短 / 标准 / 长 → 映射 toast 进度条 `duration`  

3. **闲置自动锁屏**  
   - 从不 / 5 / 15 / 30 分钟；指针与键盘活动重置计时  
   - 调用现有 `lockSession`  

4. **设置导入 / 导出**  
   - JSON 包：主题、语言、通知、开发者、工作区等  
   - 数据页：导出文件 / 从文件导入 + 确认  

5. **12h / 24h 时间**  
   - 任务栏时钟、锁屏、日历共用格式偏好  

## 次优先（P1）

### 桌面与任务栏

| 项 | 控件 | 备注 |
|----|------|------|
| 任务栏显示应用名 | 开关 | 现有任务栏可缩为图标 |
| 任务栏自动隐藏 | 开关 | 需 hover 露出 |
| 桌面小组件 | 开关 | 对接 `widgetsCollapsed` 或独立「显示小组件」 |
| 桌面图标排列 | 网格 / 自由 | 对接 `desktopLayoutMode` |

### 窗口与工作区

| 项 | 控件 | 备注 |
|----|------|------|
| 工作区数量 | 2 / 3 / 4 | 现固定 3 |
| 新窗口位置 | 居中 / 记忆 | 写 window layout |
| 关闭行为 | 仅关窗 / 清应用态 | 按 app 可选后期再做 |

### 辅助功能

| 项 | 控件 | 备注 |
|----|------|------|
| 减弱动态 | 开关 | 与开发者「省电」可共用 `data-motion` 或独立 |
| 更大点击目标 | 开关 | density 之上再加 padding token |
| 高对比边框 | 开关 | 全局 `--os-border-strong` 加粗 |

### 隐私（Web 可做）

| 项 | 控件 | 备注 |
|----|------|------|
| 剪贴板历史上限 | 数字 / 步进 | Clipboard 应用 |
| 权限只读 | 列表 | Notification / Clipboard / Mic（Permission API） |

### 存储

| 项 | 控件 | 备注 |
|----|------|------|
| 回收站自动清空 | 从不 / 30 天 | 需记录 deletedAt |
| 用量告警阈值 | 百分比 | 满阈值 toast 一次 |

## 可延后（P2）

- 任务栏位置（底 / 左）
- 启动器：分类 / 最近 / 仅固定
- 声音提示（Web Audio 轻 beep）
- 周起始日（日历）
- MMD 默认渲染档（全局偏好，写入 mmd store）
- 显示调试 FPS 图表（现为数字即可）

## 实现约定

- **持久化**：`localStorage` 分 key（与现有 `theme` / `notification-prefs` / `developer-prefs` 一致），避免单 blob 全量耦合  
- **应用时机**：`apply*` 写 `documentElement` 属性或 CSS 变量；设置页只改 store / prefs  
- **危险操作**：一律 `appConfirm`，`danger: true`  
- **关于页**：设备与版本信息；网络归网络、存储归数据  
- **文案**：`languageStore` 中英同步；设置 UI 不新增长 description key  

## 建议迭代顺序

```
Sprint A: 通知类别 + 横幅时长 + 清缓存确认（已完成部分）
Sprint B: 自动锁屏 + 12/24h
Sprint C: 设置导入导出
Sprint D: 任务栏 / 小组件 / 工作区数量
Sprint E: 辅助功能 + 权限只读
```

## 相关文件

- `src/appModules/SettingsApp.tsx` — 分区 UI  
- `src/theme.ts` / `src/developerPrefs.ts` / `src/osUiStore.ts` — 偏好  
- `src/networkInfo.ts` — 网络探测  
- `src/systemInfo.ts` — 关于页设备行  
- `src/languageStore.ts` — 文案  
