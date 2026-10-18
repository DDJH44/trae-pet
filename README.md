# TRAE 宝 · 桌面 AI 精灵

一个悬浮在 Windows 桌面上的 AI 伙伴：随时对话、待办提醒、状态陪伴。基于 Electron + React + TypeScript 构建。

## 体验方式

### 在线体验（无需安装）

打开 GitHub Pages 在线 Demo：

```
https://ddjh44.github.io/trae-pet/
```

浏览器里直接体验桌宠形象、动画、待办管理；AI 对话需在设置里填入自己的 OpenAI 兼容 API 配置（Base URL / Model / API Key，仅保存在你的浏览器本地）。

### 桌面版（完整体验）

```bash
git clone https://github.com/DDJH44/trae-pet.git
cd trae-pet
npm install
```

配置 API（复制模板后填入你的 Key）：

```bash
cp .env.example .env
```

```env
AI_BASE_URL=https://your-openai-compatible-api.com/v1
AI_API_KEY=sk-xxxx
AI_MODEL=your-model
```

启动：

```bash
npm run dev      # 开发模式（热更新）
npm run build    # 生产构建（out/）
```

## 功能

- **桌面常驻**：透明无边框置顶窗口，可拖动到任意位置，不占任务栏
- **AI 对话**：单击角色展开面板，连续上下文对话（主进程持有密钥，Renderer 零接触）
- **待办提醒**：自然语言添加（「提醒我半小时后休息」），AI 自动解析时间；双通道提醒（Windows 系统通知 + 桌宠头顶气泡）；面板内勾选/删除管理；本地 JSON 持久化
- **状态动画**：待机悬浮/自动眨眼/偶发歪头、思考时眼睛脉冲、回复中眼睛开合、出错红眼抖动、hover 弹起、按压 Q 弹、拖动时「被抓起」倾斜
- **主动搭话**：空闲时随机冒气泡问候

## 架构

```
Electron (Main)          持有 API Key、窗口管理、待办存储与提醒调度
  ├── preload            contextBridge 暴露受控 IPC 接口
  └── Renderer (React)   桌宠角色 + 聊天面板 + 待办视图
```

| 目录 | 说明 |
|---|---|
| `src/main` | 主进程：窗口、AI 请求（含待办指令协议）、待办 CRUD、提醒调度 |
| `src/preload` | 受控 IPC 桥 |
| `src/renderer` | React 界面（Pet / ChatPanel / useChat） |
| `docs` | GitHub Pages 在线 Demo（纯静态单文件） |

## 安全说明

API Key 只存在于本地 `.env`（已被 `.gitignore` 排除）或浏览器 localStorage，永不进入仓库与页面源码。在线 Demo 中体验者填入的配置仅保存在体验者自己的浏览器里。

## License

MIT
