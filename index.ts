import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

type MemoryMode = "global" | "session";

interface MarkdownMemoryConfig {
  memoryMode: MemoryMode;
  storageDir?: string;
  maxEntriesPerRead?: number;
}

interface WriteParams {
  userId?: string;
  channelId?: string;
  threadId?: string;
  /** Free-form text to append as a memory entry. */
  text: string;
}

interface ReadParams {
  userId?: string;
  channelId?: string;
  threadId?: string;
  query?: string;
}

type MemoryEntry = {
  timestamp: string;
  userId?: string;
  channelId?: string;
  threadId?: string;
  text: string;
};

function resolveStorageDir(rawDir: string | undefined): string {
  const base = rawDir ?? "~/.openclaw/markdown-memory";
  if (base.startsWith("~/")) {
    return path.join(os.homedir(), base.slice(2));
  }
  if (base === "~") {
    return os.homedir();
  }
  return base;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 128);
}

function resolveSessionFileName(params: ReadParams): string {
  if (!params.userId || !params.channelId || !params.threadId) {
    throw new Error(
      "userId, channelId and threadId are required when memoryMode is 'session'.",
    );
  }
  const userId = sanitizeSegment(params.userId);
  const channelId = sanitizeSegment(params.channelId);
  const threadId = sanitizeSegment(params.threadId);
  return `memory_${userId}:${channelId}:${threadId}.md`;
}

function resolveMarkdownPath(cfg: MarkdownMemoryConfig, params: ReadParams): string {
  const storageDir = resolveStorageDir(cfg.storageDir);

  if (cfg.memoryMode === "global") {
    return path.join(storageDir, "memory_global.md");
  }

  return path.join(storageDir, "sessions", resolveSessionFileName(params));
}

async function ensureDirForFile(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function appendMarkdownEntry(
  cfg: MarkdownMemoryConfig,
  params: WriteParams,
): Promise<MemoryEntry> {
  const filePath = resolveMarkdownPath(cfg, params);
  await ensureDirForFile(filePath);

  const now = new Date().toISOString();
  const entry: MemoryEntry = {
    timestamp: now,
    userId: cfg.memoryMode === "session" ? params.userId : undefined,
    channelId: cfg.memoryMode === "session" ? params.channelId : undefined,
    threadId: cfg.memoryMode === "session" ? params.threadId : undefined,
    text: params.text,
  };

  const headerLines: string[] = [
    "# Markdown Memory",
    "",
    "> Do not edit generated entries above this line unless you know what you are doing.",
    "",
    "---",
    "",
  ];

  let exists = false;
  try {
    await fs.access(filePath);
    exists = true;
  } catch {
    exists = false;
  }

  const blockLines: string[] = [
    `- ${entry.timestamp}` +
      (entry.userId && entry.channelId && entry.threadId
        ? ` [session: ${entry.userId}:${entry.channelId}:${entry.threadId}]`
        : "") +
      `: ${entry.text}`,
  ];

  if (!exists) {
    await fs.writeFile(filePath, [...headerLines, ...blockLines, ""].join("\n"), "utf8");
  } else {
    await fs.appendFile(filePath, blockLines.join("\n") + "\n", "utf8");
  }

  return entry;
}

async function readMarkdownEntries(
  cfg: MarkdownMemoryConfig,
  params: ReadParams,
): Promise<MemoryEntry[]> {
  const filePath = resolveMarkdownPath(cfg, params);

  let content: string;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (err: any) {
    if (err && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const lines = content.split(/\r?\n/);
  const entries: MemoryEntry[] = [];

  for (const line of lines) {
    if (!line.startsWith("- ")) continue;

    const match = /^- ([^[]+?)(?: \[session: ([^:\]]+):([^:\]]+):([^\]]+)\])?: (.*)$/.exec(line);
    if (!match) continue;

    const [, ts, userId, channelId, threadId, text] = match;
    entries.push({
      timestamp: ts.trim(),
      userId: userId?.trim() || undefined,
      channelId: channelId?.trim() || undefined,
      threadId: threadId?.trim() || undefined,
      text: text.trim(),
    });
  }

  const max = cfg.maxEntriesPerRead ?? 50;
  if (!Number.isFinite(max) || max <= 0) {
    return entries;
  }
  return entries.slice(-max);
}

export default definePluginEntry({
  id: "markdown-memory",
  name: "Markdown Memory",
  description: "Use Markdown files as a simple memory store, with optional per-session isolation.",
  kind: "memory",
  register(api) {
    const cfg = api.config as MarkdownMemoryConfig | undefined;
    const memoryMode: MemoryMode = cfg?.memoryMode ?? "global";

    const effectiveConfig: MarkdownMemoryConfig = {
      memoryMode,
      storageDir: cfg?.storageDir,
      maxEntriesPerRead: cfg?.maxEntriesPerRead ?? 50,
    };

    // Active memory tool: memory_search
    api.registerTool({
      name: "memory_search",
      label: "Memory Search",
      description:
        "Search markdown-backed memory entries from the active memory plugin. " +
        "In session mode, uses memory_{userId}:{channelId}:{threadId}.md naming.",
      parameters: Type.Object({
        query: Type.String({
          description: "Search keyword text. Matches case-insensitively against stored entries.",
          minLength: 1,
        }),
        userId: Type.Optional(Type.String()),
        channelId: Type.Optional(Type.String()),
        threadId: Type.Optional(Type.String()),
      }),
      async execute(_id, params: ReadParams) {
        const entries = await readMarkdownEntries(effectiveConfig, params);
        const q = (params.query ?? "").toLowerCase();
        const matched = entries.filter((entry) => entry.text.toLowerCase().includes(q));
        if (matched.length === 0) {
          return {
            details: {
              mode: effectiveConfig.memoryMode,
              count: 0,
            },
            content: [{ type: "text", text: "No memory matched the query." }],
          };
        }
        const lines = matched.map(
          (e) =>
            `- ${e.timestamp}` +
            (e.userId && e.channelId && e.threadId
              ? ` [session: ${e.userId}:${e.channelId}:${e.threadId}]`
              : "") +
            `: ${e.text}`,
        );
        return {
          details: {
            mode: effectiveConfig.memoryMode,
            count: matched.length,
          },
          content: [
            {
              type: "text",
              text: ["# memory_search results", "", ...lines].join("\n"),
            },
          ],
        };
      },
    });

    // Active memory tool: memory_get
    api.registerTool({
      name: "memory_get",
      label: "Memory Get",
      description:
        "Read recent markdown-backed memory entries from the active memory plugin. " +
        "In session mode, uses memory_{userId}:{channelId}:{threadId}.md naming.",
      parameters: Type.Object({
        userId: Type.Optional(Type.String()),
        channelId: Type.Optional(Type.String()),
        threadId: Type.Optional(Type.String()),
      }),
      async execute(_id, params: ReadParams) {
        const entries = await readMarkdownEntries(effectiveConfig, params);
        if (entries.length === 0) {
          return {
            details: {
              mode: effectiveConfig.memoryMode,
              count: 0,
            },
            content: [{ type: "text", text: "No memory entries found." }],
          };
        }
        const lines = entries.map(
          (e) =>
            `- ${e.timestamp}` +
            (e.userId && e.channelId && e.threadId
              ? ` [session: ${e.userId}:${e.channelId}:${e.threadId}]`
              : "") +
            `: ${e.text}`,
        );
        return {
          details: {
            mode: effectiveConfig.memoryMode,
            count: entries.length,
          },
          content: [
            {
              type: "text",
              text: ["# memory_get entries", "", ...lines].join("\n"),
            },
          ],
        };
      },
    });

    // Compatibility tool: markdown_memory_add
    api.registerTool({
      name: "markdown_memory_add",
      label: "Markdown Memory Add",
      description:
        "Append a memory entry to a Markdown file. " +
        "When configured for 'session' mode, userId/channelId/threadId are required and each session gets its own Markdown file. " +
        "When configured for 'global' mode, all entries are written to a single global Markdown file.",
      parameters: Type.Object({
        userId: Type.Optional(Type.String()),
        channelId: Type.Optional(Type.String()),
        threadId: Type.Optional(Type.String()),
        text: Type.String({
          description: "Free-form memory text to store.",
          minLength: 1,
        }),
      }),
      async execute(_id, params: WriteParams) {
        const entry = await appendMarkdownEntry(effectiveConfig, params);
        return {
          details: {
            mode: effectiveConfig.memoryMode,
            timestamp: entry.timestamp,
          },
          content: [
            {
              type: "text",
              text:
                `Stored memory entry in ${effectiveConfig.memoryMode} mode.\n` +
                `timestamp: ${entry.timestamp}\n` +
                (entry.userId && entry.channelId && entry.threadId
                  ? `session: ${entry.userId}:${entry.channelId}:${entry.threadId}\n`
                  : "") +
                `text: ${entry.text}`,
            },
          ],
        };
      },
    });

    // Tool: markdown_memory_read
    api.registerTool({
      name: "markdown_memory_read",
      label: "Markdown Memory Read",
      description:
        "Read recent memory entries from the Markdown store. " +
        "Respects the plugin's memoryMode: either global or per-session.",
      parameters: Type.Object({
        userId: Type.Optional(Type.String()),
        channelId: Type.Optional(Type.String()),
        threadId: Type.Optional(Type.String()),
      }),
      async execute(_id, params: ReadParams) {
        const entries = await readMarkdownEntries(effectiveConfig, params);

        if (entries.length === 0) {
          return {
            details: {
              mode: effectiveConfig.memoryMode,
              count: 0,
            },
            content: [
              {
                type: "text",
                text: "No stored markdown memory entries found for the current configuration.",
              },
            ],
          };
        }

        const bodyLines: string[] = [];
        bodyLines.push(`# Markdown memory (${effectiveConfig.memoryMode} mode)`);
        bodyLines.push("");
        for (const e of entries) {
          bodyLines.push(
            `- ${e.timestamp}` +
              (e.userId && e.channelId && e.threadId
                ? ` [session: ${e.userId}:${e.channelId}:${e.threadId}]`
                : "") +
              `: ${e.text}`,
          );
        }

        return {
          details: {
            mode: effectiveConfig.memoryMode,
            count: entries.length,
          },
          content: [
            {
              type: "text",
              text: bodyLines.join("\n"),
            },
          ],
        };
      },
    });
  },
});

