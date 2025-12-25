# Reasoning Content 支持方案

## 目标

支持 DeepSeek-R1、QwQ 等模型的思考模式（`reasoning_content`），实现：

1. **不简单合并**：`reasoning_content` 和 `content` 分开处理
2. **保留完整思考**：所有 `reasoning_content` 内容都保留
3. **视觉区分**：思考内容用更暗的颜色显示（如 dimColor）
4. **可折叠**：思考内容可以单独折叠/展开
5. **自动折叠**：思考完成后自动折叠思考部分

---

## 数据流设计

```
OpenAI Client (openai.ts)
    │
    ├── 分离 reasoning_content 和 content
    │   └── AIStreamChunk.delta.reasoning_content (新增)
    │
    ↓
Service (service.ts)
    │
    ├── 分别累积 reasoning 和 content
    │   └── 回调携带两部分内容
    │
    ↓
MessageQueue (messageQueue.ts)
    │
    ├── 扩展 StreamingCallbacks
    │   └── onStreamChunk(id, { reasoning, content })
    │
    ↓
App.tsx
    │
    ├── Message 类型扩展
    │   └── reasoning?: string
    │
    ↓
MessageOutput.tsx
    │
    └── 渲染思考块 + 正式内容
        ├── 思考块：dimColor，可折叠
        └── 正式内容：正常颜色
```

---

## 实现计划

### Phase 1: 类型定义扩展

**文件**: `services/ai/types.ts`

```typescript
// 扩展 AIStreamChunk
export type AIStreamChunk = {
  delta: Partial<ChatMessage> & {
    reasoning_content?: string;  // 新增：思考内容
  };
  finish_reason?: FinishReason;
};

// 新增：流式内容结构
export type StreamContent = {
  reasoning: string;  // 思考内容（累积）
  content: string;    // 正式内容（累积）
};
```

**文件**: `components/MessageOutput.tsx`

```typescript
export type Message = {
  content: string;
  reasoning?: string;           // 新增：思考内容
  reasoningCollapsed?: boolean; // 新增：思考是否折叠
  type?: "user" | "system";
  streaming?: boolean;
  // ... 其他字段
};
```

### Phase 2: OpenAI Client 修改

**文件**: `services/ai/clients/openai.ts`

修改 `streamChat` 方法，分离 `reasoning_content`：

```typescript
// 构建 AIStreamChunk
const streamChunk: AIStreamChunk = {
  delta: {
    content: delta.content || "",
    reasoning_content: delta.reasoning_content || "",  // 分离
  },
};
```

### Phase 3: Service 层修改

**文件**: `services/ai/service.ts`

修改 `streamChatWithTools` 方法：

```typescript
// 分别累积
let reasoningContent = "";
let fullContent = "";

for await (const chunk of this.client.streamChat(...)) {
  // 累积思考内容
  if (chunk.delta.reasoning_content) {
    reasoningContent += chunk.delta.reasoning_content;
  }
  // 累积正式内容
  if (chunk.delta.content) {
    fullContent += chunk.delta.content;
  }

  // 回调携带两部分
  callbacks?.onChunk?.({ reasoning: reasoningContent, content: fullContent });
}
```

### Phase 4: 回调类型扩展

**文件**: `services/ai/messageQueue.ts`

```typescript
// 新的流式内容类型
export type StreamContent = {
  reasoning: string;
  content: string;
};

export type StreamingCallbacks = {
  onStreamStart?: (id: string) => void;
  // 修改：content 变为 StreamContent
  onStreamChunk?: (id: string, content: StreamContent) => void;
  onStreamEnd?: (id: string, finalContent: StreamContent) => void;
};
```

### Phase 5: App.tsx 修改

**文件**: `app.tsx`

```typescript
onStreamChunk: (id, { reasoning, content }) => {
  setMessages((prev) => {
    const streamingIndex = prev.findIndex((msg) => msg.streaming);
    if (streamingIndex === -1) return prev;

    const newMessages = [...prev];
    newMessages[streamingIndex] = {
      ...newMessages[streamingIndex],
      reasoning,           // 更新思考内容
      content,             // 更新正式内容
      reasoningCollapsed: false,  // 流式中不折叠
    };
    return newMessages;
  });
},

onStreamEnd: (id, { reasoning, content }) => {
  setMessages((prev) => {
    const streamingIndex = prev.findIndex((msg) => msg.streaming);
    if (streamingIndex === -1) return prev;

    const newMessages = [...prev];
    newMessages[streamingIndex] = {
      ...newMessages[streamingIndex],
      reasoning,
      content,
      streaming: false,
      reasoningCollapsed: reasoning.length > 0,  // 有思考内容时自动折叠
    };
    return newMessages;
  });
},
```

### Phase 6: MessageOutput 渲染

**文件**: `components/MessageOutput.tsx`

#### 6.1 思考块折叠组件

```typescript
// 思考块标题（可点击展开/折叠）
function ReasoningHeader({
  collapsed,
  lineCount,
  onToggle
}: {
  collapsed: boolean;
  lineCount: number;
  onToggle: () => void;
}) {
  const symbol = collapsed ? "▶" : "▼";
  return (
    <Box>
      <Text dimColor>
        {symbol} 思考过程 {collapsed ? `(${lineCount} 行)` : ""}
      </Text>
    </Box>
  );
}
```

#### 6.2 渲染逻辑

```typescript
function renderMessageContent(msg: Message, width: number): RenderedLine[] {
  const lines: RenderedLine[] = [];

  // 1. 渲染思考内容（如果有）
  if (msg.reasoning && msg.reasoning.length > 0) {
    if (msg.reasoningCollapsed) {
      // 折叠状态：只显示标题
      lines.push({
        text: `▶ 思考过程 (${countLines(msg.reasoning)} 行)`,
        isReasoning: true,
        isHeader: true,
      });
    } else {
      // 展开状态：显示标题 + 内容
      lines.push({
        text: `▼ 思考过程`,
        isReasoning: true,
        isHeader: true,
      });
      // 思考内容（dimColor）
      const reasoningLines = wrapText(msg.reasoning, width);
      for (const line of reasoningLines) {
        lines.push({
          text: line,
          isReasoning: true,
          isHeader: false,
        });
      }
    }
  }

  // 2. 渲染正式内容
  if (msg.content) {
    const contentLines = renderMarkdown(msg.content, width);
    for (const line of contentLines) {
      lines.push({
        text: line,
        isReasoning: false,
        isHeader: false,
      });
    }
  }

  return lines;
}
```

#### 6.3 颜色区分

```typescript
// 渲染行
function renderLine(line: RenderedLine) {
  if (line.isReasoning) {
    // 思考内容：暗色
    return <Text dimColor>{line.text}</Text>;
  }
  // 正式内容：正常颜色
  return <Text>{line.text}</Text>;
}
```

### Phase 7: 键盘交互

在 Browse 模式下，当光标在思考块标题行时：

- **Enter**：切换该消息的 `reasoningCollapsed` 状态
- 复用现有的折叠逻辑模式

---

## 文件修改清单

| 文件 | 修改内容 |
|------|---------|
| `services/ai/types.ts` | 添加 `reasoning_content` 到 `AIStreamChunk.delta` |
| `services/ai/clients/openai.ts` | 分离 `reasoning_content` 和 `content` |
| `services/ai/service.ts` | 分别累积，扩展回调参数 |
| `services/ai/messageQueue.ts` | 扩展 `StreamContent` 类型和回调签名 |
| `components/MessageOutput.tsx` | 添加 `reasoning` 字段，实现折叠渲染 |
| `app.tsx` | 处理新的回调格式，管理折叠状态 |
| `i18n/locales/en.json` | 添加 "Thinking process" |
| `i18n/locales/zh-CN.json` | 添加 "思考过程" |

---

## UI 示例

### 思考中（流式输出）

```
▼ 思考过程
  让我分析一下这个问题...
  首先需要考虑...
  ⠋  ← spinner

（正式内容还未开始）
```

### 思考完成（自动折叠）

```
▶ 思考过程 (15 行)

这是正式的回答内容，用正常颜色显示。
代码示例：
```python
def hello():
    print("Hello, World!")
```
```

### 展开思考

```
▼ 思考过程
  让我分析一下这个问题...
  首先需要考虑文件结构...
  然后检查依赖关系...
  （更多思考内容，dimColor 显示）

这是正式的回答内容，用正常颜色显示。
```

---

## 边界情况处理

1. **只有 reasoning，没有 content**：正常显示思考，不自动折叠
2. **只有 content，没有 reasoning**：和现在一样，无思考块
3. **API 不支持 reasoning_content**：降级为现有行为
4. **中途停止**：保留已收到的内容，不折叠
5. **思考块很长**：折叠后显示行数提示

---

## 兼容性

- **向后兼容**：不影响不支持 `reasoning_content` 的模型
- **渐进增强**：有 `reasoning_content` 时启用新功能
- **现有功能保留**：消息组折叠、滚动等功能不受影响
