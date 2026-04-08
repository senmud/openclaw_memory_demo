# Changelog

All notable changes to this project are documented in this file.

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
