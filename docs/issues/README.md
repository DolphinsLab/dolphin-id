# Dolphin ID Issue Backlog

本目录是 Dolphin ID 的 Issue 草稿库。每个文件对应一个可创建到远端 issue tracker 的工作项，开发时必须通过对应 MR/PR 合并。

## Issue 总览

| ID      | 标题                                                   | 里程碑 | 类型 | 依赖                                        |
| ------- | ------------------------------------------------------ | ------ | ---- | ------------------------------------------- |
| DID-000 | Bootstrap repository, CI, package layout               | v0.1   | AFK  | None                                        |
| DID-001 | Define core Adapter contracts and package boundaries   | v0.1   | AFK  | DID-000                                     |
| DID-002 | Implement typed error, event, and state model          | v0.1   | AFK  | DID-001                                     |
| DID-003 | Build Node server auth core with nonce and JWT session | v0.1   | AFK  | DID-001                                     |
| DID-004 | Implement EVM SIWE login slice                         | v0.1   | AFK  | DID-001, DID-003                            |
| DID-005 | Implement Sui personal message login slice             | v0.1   | AFK  | DID-001, DID-003                            |
| DID-006 | Build React Provider and headless hooks                | v0.1   | AFK  | DID-002, DID-004, DID-005                   |
| DID-007 | Build default Connect Wallet UI                        | v0.1   | AFK  | DID-006                                     |
| DID-008 | Create Next.js example and E2E login verification      | v0.1   | AFK  | DID-007                                     |
| DID-009 | Harden MVP security controls                           | v0.1   | HITL | DID-003, DID-004, DID-005                   |
| DID-010 | Publish MVP API docs and getting started guide         | v0.1   | AFK  | DID-008                                     |
| DID-011 | Cut v0.1 MVP release                                   | v0.1   | HITL | DID-009, DID-010                            |
| DID-012 | Add WalletConnect v2 and mobile deep link login        | v0.2   | AFK  | DID-011                                     |
| DID-013 | Implement Solana SIWS login slice                      | v0.2   | AFK  | DID-011                                     |
| DID-014 | Implement multi-wallet identity model                  | v0.2   | HITL | DID-011                                     |
| DID-015 | Add refresh token and server-side logout controls      | v0.2   | AFK  | DID-011                                     |
| DID-016 | Add theming, i18n, and responsive UI polish            | v0.2   | AFK  | DID-007                                     |
| DID-017 | Add Express and Fastify middleware                     | v0.2   | AFK  | DID-003                                     |
| DID-018 | Build CLI app scaffolder                               | v1.0   | AFK  | DID-010                                     |
| DID-019 | Add Bitcoin and Aptos adapters                         | v1.0   | AFK  | DID-001, DID-011                            |
| DID-020 | Ship Go, Rust, and Python server SDKs                  | v1.0   | HITL | DID-003, DID-009                            |
| DID-021 | Launch hosted nonce/session service                    | v1.0   | HITL | DID-003, DID-015                            |
| DID-022 | Build docs site and third-party Adapter spec           | v1.0   | AFK  | DID-010                                     |
| DID-023 | Complete security audit remediation                    | v1.0   | HITL | DID-021, DID-022                            |
| DID-024 | Cut v1.0 stable release                                | v1.0   | HITL | DID-018, DID-019, DID-020, DID-021, DID-023 |

## 使用方式

1. 按依赖顺序创建远端 Issue。
2. 每个 Issue 使用独立分支开发。
3. 每个 MR/PR 标题必须包含 Issue ID。
4. 合并 MR/PR 后关闭对应 Issue。
5. 安全、商业化、公共 API 和发布项标记为 HITL，需要人工确认。
