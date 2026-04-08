## Markdown Memory 插件说明

一个基于 Markdown 文件的 OpenClaw **active memory 插件**，支持：

- 当前版本：`1.0.3`

- **全局 memory 模式**：所有记忆写入同一个 `memory_global.md`
- **按 session 隔离的 memory 模式**：按 `userId/channelId/threadId` 三元组隔离（`threadId` 可选）
- **两种模式互斥**：通过插件配置 `memoryMode` 选择其一生效
- **session 命名规则**：`memory_{userId}:{channelId}:{threadId}.md`（未传 `threadId` 时默认 `default`）

### 安装

在插件目录下安装依赖：

```bash
pnpm install
```

或：

```bash
npm install
```

在 OpenClaw 环境安装插件（本地目录）：

```bash
openclaw plugins install /Users/liusen/demo_code/openclaw_memory_demo
```

开发阶段可用 link 模式：

```bash
openclaw plugins install -l /Users/liusen/demo_code/openclaw_memory_demo
```

### OpenClaw 配置示例

在你的 `openclaw.json` 中启用插件并配置模式（严格 JSON 示例）：

```json
{
  "plugins": {
    "entries": {
      "markdown-memory": {
        "enabled": true,
        "config": {
          "memoryMode": "session",
          "storageDir": "~/.openclaw/markdown-memory",
          "maxEntriesPerRead": 50
        }
      }
    },
    "slots": {
      "memory": "markdown-memory"
    }
  }
}
```

> 注意：插件读取的是 `plugins.entries.markdown-memory.config`（即 pluginConfig），不是全局根配置。

配置完成后重启网关：

```bash
openclaw gateway restart
```

- **全局模式**：`memoryMode: "global"`  
  - 所有写入进入：`<storageDir>/memory_global.md`
- **session 模式**：`memoryMode: "session"`  
  - 每个 session 写入：`<storageDir>/sessions/memory_{userId}:{channelId}:{threadId}.md`
  - `userId/channelId` 必填，`threadId` 可选（默认 `default`）

### Active memory 能力

插件声明为 `kind: "memory"`，并提供 active memory 工具：

- `memory_search`
- `memory_get`

这样它可以作为 OpenClaw 的 memory slot 插件工作，不只是普通辅助工具。

### 提供的工具

- **`markdown_memory_add`**
  - **作用**：写入一条 memory 到 Markdown 文件  
  - **参数**：
    - `text: string`（必填）：要存储的记忆文本
    - `userId?: string` / `channelId?: string` / `threadId?: string`：
      - 当 `memoryMode === "session"` 时 `userId/channelId` 必填
      - `threadId` 可选，未传时自动使用 `default`
      - 当 `memoryMode === "global"` 时会被忽略

- **`markdown_memory_read`**
  - **作用**：读取最近的若干条 memory
  - **参数**：
    - `userId?: string` / `channelId?: string` / `threadId?: string`：
      - 当 `memoryMode === "session"` 时 `userId/channelId` 必填
      - `threadId` 可选，未传时自动使用 `default`
      - 当 `memoryMode === "global"` 时会被忽略
  - 返回内容中包含当前模式和每条记忆的时间戳 / session / 文本。

- **`memory_search`（active memory）**
  - 作用：在当前 memory 文件中按关键字检索。
  - 参数：`query` +（session 模式下）`userId/channelId`；`threadId` 可选。

- **`memory_get`（active memory）**
  - 作用：读取当前作用域（global 或 session）的最近 memory 记录。
  - 参数：（session 模式下）`userId/channelId`；`threadId` 可选。

### 设计要点对应你的需求

- **严格遵循最新 SDK 导入规范**  
  - 使用 `definePluginEntry` 且只从精确子路径 `openclaw/plugin-sdk/plugin-entry` 导入。
- **Markdown 文件实现 session 级别存储**  
  - 使用 `~/.openclaw/markdown-memory/sessions/memory_{userId}:{channelId}:{threadId}.md` 作为 session 级文件（`threadId` 默认 `default`）。
- **通过选项切换全局 / session memory**  
  - `openclaw.plugin.json` 的 `configSchema.memoryMode` 限定为 `"global"` 或 `"session"`。
- **二者互斥**  
  - 插件内部根据 `memoryMode` 决定路径逻辑：
    - `global` 模式下所有写入固定到 `memory_global.md`
    - `session` 模式下要求 `userId/channelId`，`threadId` 缺省为 `default`，并写入对应文件  
  - 不存在同时激活两种模式的代码路径。

### 安装后自检脚本

下面脚本会完成：

1. 检查插件是否已安装/可见
2. 检查 memory slot 是否指向 `markdown-memory`
3. 写入并读取一条 session memory
4. 验证 session 文件是否按命名规则落盘

> 说明：默认存储目录为 `~/.openclaw/markdown-memory`。如果你在配置里改了 `storageDir`，请同步修改脚本里的 `BASE_DIR`。

```bash
#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ID="markdown-memory"
USER_ID="u_demo"
CHANNEL_ID="c_demo"
THREAD_ID="t_demo"
BASE_DIR="${HOME}/.openclaw/markdown-memory"
SESSION_FILE="${BASE_DIR}/sessions/memory_${USER_ID}:${CHANNEL_ID}:${THREAD_ID}.md"

echo "[1/6] 检查插件列表"
openclaw plugins list | rg "${PLUGIN_ID}" >/dev/null

echo "[2/6] 检查插件详情和 slot"
openclaw plugins inspect "${PLUGIN_ID}"

echo "[3/6] 写入一条测试 memory"
openclaw tool call markdown_memory_add "$(cat <<'JSON'
{
  "userId": "u_demo",
  "channelId": "c_demo",
  "threadId": "t_demo",
  "text": "self-check memory entry"
}
JSON
)"

echo "[4/6] 读取 memory_get"
openclaw tool call memory_get "$(cat <<'JSON'
{
  "userId": "u_demo",
  "channelId": "c_demo",
  "threadId": "t_demo"
}
JSON
)"

echo "[5/6] 验证 session 文件命名落盘"
test -f "${SESSION_FILE}"
echo "Found: ${SESSION_FILE}"

echo "[6/6] 验证内容包含测试文本"
rg "self-check memory entry" "${SESSION_FILE}" >/dev/null
echo "Self-check passed."
```

### 避免与内置 session-memory 冲突

本插件作为 `kind: "memory"` 且被设置到 `plugins.slots.memory` 后，会成为唯一 active memory 实现。建议不要同时启用内置 `memory-core` 的 experimental session-memory。

推荐配置策略（二选一）：

1. 使用本插件作为主 memory（推荐本仓库场景）
   - `plugins.slots.memory = "markdown-memory"`
   - 关闭 `agents.defaults.memorySearch.experimental.sessionMemory`

2. 使用内置 `memory-core` 的 session-memory
   - `plugins.slots.memory = "memory-core"`
   - 不要把本插件放到 memory slot（仅保留为普通工具插件）

