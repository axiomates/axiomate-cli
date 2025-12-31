# CLAUDE.md

Claude Code 开发指南。保持精简，只记录架构和入口，细节查代码。

## 项目概述

axiomate - 基于 React 19 + Ink 6 的终端 AI 助手。

**技术栈**: React 19, Ink 6, TypeScript 5.7, Node.js >= 20, Vitest

## 常用命令

```bash
npm run build      # 编译
npm run dev        # 开发模式
npm start          # 运行
npm test           # 测试
npm run package    # 打包可执行文件 (需要 Bun)
```

## 目录结构

```
source/
├── cli.tsx                    # 入口
├── app.tsx                    # 主组件，状态管理中心
├── components/
│   ├── AutocompleteInput/     # 输入组件（模式、键盘、菜单）
│   ├── AskUserMenu.tsx        # AI 询问用户 UI
│   ├── MessageOutput.tsx      # 消息显示
│   └── StatusBar.tsx          # 状态栏
├── models/                    # 数据模型（InputInstance, UserInput）
├── constants/
│   ├── commands.ts            # 斜杠命令定义
│   └── models.ts              # 默认模型配置
├── services/
│   ├── commandHandler.ts      # 命令处理
│   ├── ai/                    # AI 服务（会话、流式、工具调用）
│   └── tools/                 # 工具系统
│       ├── discoverers/       # 工具发现器（每个工具一个文件）
│       └── executor.ts        # 工具执行
├── i18n/                      # 国际化 (en, zh-CN, ja)
└── utils/
    └── config.ts              # 用户配置 (~/.axiomate.json)
```

## 关键模块入口

| 功能 | 入口文件 |
|------|---------|
| 键盘处理 | `AutocompleteInput/hooks/useInputHandler.ts` |
| UI 模式切换 | `AutocompleteInput/reducer.ts` |
| 斜杠命令 | `constants/commands.ts` + `services/commandHandler.ts` |
| AI 会话 | `services/ai/service.ts` |
| 工具发现 | `services/tools/discoverers/index.ts` |
| 配置加载 | `utils/config.ts` |

## 配置文件

| 文件 | 用途 |
|------|------|
| `~/.axiomate.json` | 用户配置（模型、API） |
| `.env.local` | 开发环境变量（不提交） |
| `.env.local.example` | 环境变量模板 |

## 添加新功能

### 添加斜杠命令

1. `constants/commands.ts` - 添加命令定义
2. `services/commandHandler.ts` - 添加处理器

### 添加工具

1. `services/tools/discoverers/` - 创建发现器
2. `services/tools/discoverers/index.ts` - 注册

### 添加 i18n 文本

`i18n/locales/*.json` - 三个语言文件都要加

## 代码规范

- 用户可见文本必须用 i18n `t()` 函数
- 类型定义放 `models/` 或 `types/`
- 跨平台路径用 `constants/platform.ts` 的 `PATH_SEPARATOR`
