# Changelog

All notable changes to this project are documented in this file.

## 1.0.4 - 2026-04-08

- Add automatic session parameter fallback in session mode:
  `tool params -> plugin defaults -> environment defaults`.
- Add new plugin config fields:
  `defaultUserId`, `defaultChannelId`, `defaultThreadId`.
- Add optional environment defaults:
  `OPENCLAW_MARKDOWN_MEMORY_USER_ID`,
  `OPENCLAW_MARKDOWN_MEMORY_CHANNEL_ID`,
  `OPENCLAW_MARKDOWN_MEMORY_THREAD_ID`.
- Keep `threadId` final fallback as `default`.

## 1.0.3 - 2026-04-08

- Make `threadId` optional in session mode.
- Default missing `threadId` to `default`.
- Keep session file naming as `memory_{userId}:{channelId}:{threadId}.md`.
- Update README usage and parameter docs to match the new default behavior.

## 1.0.2 - 2026-04-08

- Fix plugin config resolution to read `api.pluginConfig` instead of `api.config`.
- Default memory mode to `session` when no explicit plugin config is provided.
- Add README guidance for avoiding conflicts with builtin `memory-core` experimental session-memory.

## 1.0.1 - 2026-04-08

- Upgrade to an active memory plugin shape (`kind: "memory"`).
- Add active memory tools `memory_search` and `memory_get`.
- Keep compatibility tools `markdown_memory_add` and `markdown_memory_read`.
- Add session-isolated markdown naming:
  `memory_{userId}:{channelId}:{threadId}.md`.
- Keep mutually exclusive memory mode switching (`global` vs `session`).
- Add minimal TypeScript project setup (`tsconfig.json`, dev dependencies).
- Document OpenClaw installation flow and post-install self-check script.

## 1.0.0 - 2026-04-08

- Initial markdown memory plugin implementation.
- Support global markdown storage and session-scoped storage.
- Add plugin manifest and README usage docs.
