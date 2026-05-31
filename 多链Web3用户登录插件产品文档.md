# 多链 Web3 用户登录插件产品文档

| 项目     | 内容                         |
| -------- | ---------------------------- |
| 产品代号 | Dolphin ID                   |
| 文档版本 | v1.1                         |
| 文档状态 | 待评审                       |
| 最后更新 | 2026-05-30                   |
| 适用阶段 | MVP 立项、研发排期、方案评审 |

## 1. 产品定位

Dolphin ID 是面向 React 生态的多链 Web3 登录基础设施。它通过统一的前端 React API、链适配器、SIWX 登录消息抽象和后端验签 SDK，帮助 dApp 在同一套代码中支持 EVM、Sui、Solana 等多条链的钱包连接、签名登录、会话管理和多钱包身份绑定。

产品不做钱包托管、不管理私钥、不构造交易，也不替代 wagmi、Sui dApp Kit、Solana Wallet Adapter 等链上业务 SDK。它专注解决“用户如何安全、快速、跨链地登录 dApp”。

**一句话价值：让 dApp 用 30 分钟接入多链登录，而不是用数周维护多套钱包连接和验签逻辑。**

## 2. 背景与问题

Web3 应用正在从单链走向多链，但登录层仍高度碎片化：

- EVM、Sui、Solana、Bitcoin 等生态的钱包发现、地址格式、签名消息、验签方式差异明显。
- 现有工具通常绑定单一生态，例如 RainbowKit/wagmi 偏 EVM，Sui dApp Kit 偏 Sui，Solana Wallet Adapter 偏 Solana。
- 跨链 dApp 需要重复维护多套连接 UI、登录状态、错误处理和后端验签逻辑。
- Sign-In With Ethereum、Sign-In With Solana、Sui Personal Message 等登录标准不统一，后端身份系统难以复用。
- SaaS 化跨链登录方案可能带来供应商锁定，且对非 EVM 链覆盖、Headless 集成和自有后端接入不一定友好。
- “一个用户绑定多个链上钱包”的身份模型缺乏轻量、开源、可落地的参考实现。

因此，市场需要一个轻量、可扩展、开源友好的多链登录层，把链差异隔离到 Adapter 中，把应用开发者面对的登录体验统一起来。

## 3. 产品目标

### 3.1 业务目标

- 降低跨链 dApp 接入钱包登录的研发成本。
- 为 EVM 与非 EVM 链提供一致的登录体验。
- 建立“地址即用户”和“一人多钱包”两种身份模型的标准实现。
- 形成可扩展的 Adapter 生态，允许第三方贡献新链支持。

### 3.2 产品目标

- 提供统一的 React Provider、Hooks 和 UI 组件。
- 提供链无关的 SIWX 登录消息构造与验签接口。
- 提供 Node.js/TypeScript 后端 SDK，覆盖 nonce、验签、会话、用户绑定等关键链路。
- 支持 Headless 模式，允许产品完全自定义 UI。
- 核心包保持轻量，链能力按需引入。

### 3.3 非目标

- 不生成、托管或恢复用户私钥。
- 不提供交易构造、合约调用、资产转账等链上业务能力。
- 不提供 KYC、合规审查或真实身份认证。
- 不做链上数据索引、余额聚合、NFT 聚合等数据服务。
- 不内置完整用户资料系统，例如头像、社交关系、积分体系。
- 不引入 Passkey/WebAuthn 作为非钱包兜底登录方式，产品登录主路径保持钱包签名。

### 3.4 商业模式

Dolphin ID 采用“开源核心 + 增值服务”的商业模式。

开源核心包括前端 SDK、链 Adapter、默认 UI、Headless Hooks、后端验签 SDK、基础示例和自托管认证参考实现。增值服务包括托管 nonce/session 服务、企业级 SLA、团队管理、审计日志、高级风控、私有化部署支持和优先链适配支持。

开源版本必须保持完整可用，开发者不接入任何中心化服务也能完成多链登录闭环；增值服务只用于降低运维成本、增强企业能力和提供托管便利。

## 4. 目标用户与核心场景

| 用户类型            | 典型特征                      | 核心诉求                               |
| ------------------- | ----------------------------- | -------------------------------------- |
| DeFi 协议前端开发者 | 已有单链 dApp，希望扩展到新链 | 尽量复用现有登录代码和状态管理         |
| 跨链聚合器开发者    | 必须同时支持 3 条以上链       | 统一钱包连接、签名登录与错误处理       |
| C 端 Web3 产品团队  | 重视登录转化率和用户体验      | 提供简单、稳定、移动端友好的连接流程   |
| 多链协议团队        | 协议部署在 EVM 与非 EVM 链    | 让一个用户身份关联多个链上账户         |
| 开源 SDK 开发者     | 需要扩展链支持或自定义 UI     | 需要稳定的 Adapter 规范和 Headless API |

核心使用场景：

- 跨链 DEX 聚合器：用户在同一界面连接 EVM 与 Sui 钱包，并基于当前链完成登录。
- 多链 NFT 市场：一个用户身份绑定多个链上钱包，统一管理收藏、订单和权限。
- 跨链借贷协议：用户用 EVM 钱包登录和抵押，用 Sui 钱包接收或管理资产。
- AI Agent 平台：用户登录后授权 Agent 管理不同链的钱包上下文。
- GameFi 产品：玩家使用统一账号访问多条链上的资产和游戏进度。

## 5. 产品范围

### 5.1 MVP 范围

MVP 只解决“多链登录闭环”：

- 支持 EVM 与 Sui。
- 支持浏览器钱包发现、连接、断开、账户变化监听。
- 支持 SIWE 与 Sui Personal Message 登录。
- 支持后端 nonce 下发、验签、JWT 会话。
- 支持“地址即用户”身份模型。
- 提供 React Provider、Hooks、Connect Wallet 按钮和钱包选择弹窗。
- 提供 Next.js 示例和 Node.js 后端参考实现。

### 5.2 MVP 暂不包含

- Solana、Bitcoin、Aptos、TON 等更多链。
- 一人多钱包绑定管理 UI。
- Refresh Token、Token 黑名单、强制注销。
- 硬件钱包。
- Debug Panel。
- CLI 脚手架。
- 托管认证服务。

## 6. 核心概念

| 概念             | 说明                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------- |
| ChainAdapter     | 单条链的能力适配器，负责钱包发现、连接、签名、地址规范化和事件监听                    |
| Wallet           | 一个可连接的钱包实例，例如 MetaMask、Phantom、Slush                                   |
| Account          | 已连接的钱包账户，包含链类型、地址、公钥、钱包来源等信息                              |
| SIWX             | Sign-In With X 的通用抽象，用统一接口覆盖 SIWE、SIWS、Sui Personal Message 等登录消息 |
| Identity         | 产品内的用户身份，可以是单地址身份，也可以绑定多个不同链上的账户                      |
| Session          | 登录会话，MVP 默认使用 JWT                                                            |
| Adapter Registry | 应用启用的链适配器集合，用于钱包列表展示、连接和能力路由                              |

## 7. 产品架构

产品由前端 SDK、链 Adapter、UI 组件、后端 SDK 和示例工程组成。

```text
dApp
  ├─ React Provider / Hooks
  ├─ UI Components
  ├─ Adapter Registry
  │   ├─ EVM Adapter
  │   ├─ Sui Adapter
  │   └─ Future Adapters
  └─ Auth Client

Backend
  ├─ Nonce Service
  ├─ SIWX Verify Service
  ├─ User Repository
  └─ Session Service
```

建议包结构：

| 包名                      | 说明                                        |
| ------------------------- | ------------------------------------------- |
| `@dolphin-id/core`        | 核心类型、Adapter 接口、SIWX 抽象、错误模型 |
| `@dolphin-id/react`       | React Provider、Hooks、状态管理             |
| `@dolphin-id/ui`          | 默认按钮、钱包弹窗、账户状态组件            |
| `@dolphin-id/adapter-evm` | EVM 钱包发现、连接、SIWE 消息适配           |
| `@dolphin-id/adapter-sui` | Sui 钱包发现、连接、Personal Message 适配   |
| `@dolphin-id/server`      | Node.js 验签、nonce、session、用户仓储接口  |
| `@dolphin-id/examples`    | Next.js、Vite、多链示例                     |

## 8. 关键用户流程

### 8.1 开发者接入流程

1. 安装核心包、React 包、UI 包和所需链 Adapter。
2. 在应用根节点配置 `DolphinProvider`。
3. 注册启用的 Adapter，例如 EVM 与 Sui。
4. 配置认证端点，例如 `/auth/nonce`、`/auth/verify`、`/auth/me`。
5. 使用默认 `ConnectButton`，或通过 Hooks 自定义钱包连接 UI。
6. 后端接入 `@dolphin-id/server` 完成 nonce 管理、验签和 session 签发。

### 8.2 用户登录流程

1. 用户点击 Connect Wallet。
2. 前端展示按链分组的钱包列表。
3. 用户选择钱包并确认连接。
4. 前端向后端请求 nonce。
5. 前端构造 SIWX 消息并调用钱包签名。
6. 前端提交地址、链类型、消息和签名到后端。
7. 后端校验 domain、address、chainId、nonce、过期时间和签名有效性。
8. 后端销毁 nonce，创建或查询用户身份，签发 session。
9. 前端保存 session 并更新登录状态。

### 8.3 断线重连流程

1. 页面刷新后，SDK 读取持久化的钱包连接状态和 session。
2. SDK 尝试恢复钱包连接状态。
3. SDK 调用 `/auth/me` 校验 session 是否仍有效。
4. 若钱包仍连接且 session 有效，则恢复登录状态。
5. 若钱包连接失败或 session 过期，则进入未登录状态，并给出可恢复的错误信息。

### 8.4 多钱包绑定流程

该流程属于 P1。

1. 用户已通过主钱包登录。
2. 用户选择绑定新钱包。
3. 新钱包完成连接。
4. 后端下发绑定用途 nonce。
5. 新钱包完成 SIWX 所有权签名。
6. 后端校验签名，并确认该地址未绑定其他用户。
7. 后端将新 Account 绑定到当前 Identity。

多钱包模式下，敏感操作默认允许当前 Identity 下任意已绑定钱包完成签名授权。业务方如需更高安全级别，可在应用层配置只允许主钱包签名或要求特定链钱包签名，但产品默认策略为任意绑定钱包签名。

## 9. 功能需求

### 9.1 链支持

| 编号  | 需求                      | 优先级 | 验收标准                                                            |
| ----- | ------------------------- | ------ | ------------------------------------------------------------------- |
| CS-01 | 支持 EVM 全系链登录       | P0     | 可通过配置 chainId 支持 Ethereum、Polygon、Base、Arbitrum 等 EVM 链 |
| CS-02 | 支持 Sui 主网和测试网登录 | P0     | 可发现 Sui 钱包、连接账户并完成 Personal Message 签名               |
| CS-03 | 同一应用可同时启用多条链  | P0     | 钱包弹窗能按链展示，Hooks 能区分链类型和账户                        |
| CS-04 | 提供 Adapter 开发接口     | P1     | 第三方可按文档实现新链的钱包发现、连接、签名和地址规范化            |
| CS-05 | 支持 Solana               | P1     | 可通过 Solana 钱包完成 SIWS 登录                                    |
| CS-06 | 支持 Bitcoin、Aptos、TON  | P2     | 按 Adapter 规范逐步扩展                                             |

### 9.2 钱包连接

| 编号  | 需求               | 优先级 | 验收标准                                     |
| ----- | ------------------ | ------ | -------------------------------------------- |
| WC-01 | 自动发现浏览器钱包 | P0     | EVM 支持 EIP-6963，Sui 支持 Wallet Standard  |
| WC-02 | 钱包列表 API       | P0     | 可按链类型、安装状态、钱包名称筛选           |
| WC-03 | 钱包连接与断开     | P0     | Hooks 能返回连接中、已连接、失败、断开等状态 |
| WC-04 | 钱包事件监听       | P0     | 能监听账户切换、链切换、断开连接             |
| WC-05 | 刷新页面后恢复状态 | P0     | 用户刷新后可恢复已连接钱包和有效 session     |
| WC-06 | 支持自定义 RPC     | P0     | EVM 和 Sui Adapter 均可配置 RPC 节点         |
| WC-07 | WalletConnect v2   | P0     | 移动端钱包可通过 WalletConnect 登录 EVM      |
| WC-08 | 钱包未安装引导     | P1     | 未安装钱包时展示官方下载入口                 |
| WC-09 | 移动端深链唤起     | P1     | 手机浏览器中可直接唤起钱包 App               |
| WC-10 | 硬件钱包           | P2     | 支持 Ledger/Trezor 连接路径                  |

### 9.3 登录认证

| 编号  | 需求                      | 优先级 | 验收标准                                                           |
| ----- | ------------------------- | ------ | ------------------------------------------------------------------ |
| AU-01 | SIWX 消息构造器           | P0     | 相同输入可生成链适配后的标准登录消息                               |
| AU-02 | 兼容 EIP-4361 SIWE        | P0     | EVM 登录消息符合 SIWE 标准，并可通过标准验签                       |
| AU-03 | 支持 Sui Personal Message | P0     | Sui 钱包可签名，后端可验证签名归属                                 |
| AU-04 | nonce 后端下发            | P0     | 前端不能自造 nonce，nonce 必须来自后端接口                         |
| AU-05 | 消息字段完整              | P0     | 消息包含 domain、address、chainId、nonce、issuedAt、expirationTime |
| AU-06 | 后端验签 SDK              | P0     | Node.js SDK 能验证 EVM 与 Sui 登录签名                             |
| AU-07 | nonce 单次有效            | P0     | 验签成功或过期后 nonce 不可再次使用                                |
| AU-08 | Solana SIWS               | P1     | Solana 登录消息符合生态规范                                        |
| AU-09 | EIP-1271 合约钱包         | P1     | 合约钱包签名可通过链上 `isValidSignature` 校验                     |

### 9.4 用户身份

| 编号  | 需求             | 优先级 | 验收标准                                         |
| ----- | ---------------- | ------ | ------------------------------------------------ |
| ID-01 | 地址即用户       | P0     | 用户首次登录时基于链类型与地址创建身份           |
| ID-02 | 地址全局唯一     | P0     | 同一链同一地址不可属于多个用户                   |
| ID-03 | 地址规范化       | P0     | EVM 地址小写化，Sui 地址补齐 `0x` 前缀并统一格式 |
| ID-04 | 一人多钱包       | P1     | 一个 Identity 可绑定多个 Account                 |
| ID-05 | 绑定新钱包需签名 | P1     | 新钱包必须完成所有权签名才能绑定                 |
| ID-06 | 解绑钱包         | P1     | 用户可解绑非最后一个钱包                         |
| ID-07 | 主钱包设置       | P1     | 多钱包身份可设置 Primary Account                 |

### 9.5 会话管理

| 编号  | 需求                 | 优先级 | 验收标准                                      |
| ----- | -------------------- | ------ | --------------------------------------------- |
| SE-01 | JWT 会话             | P0     | 验签成功后后端签发 JWT                        |
| SE-02 | Token 过期时间可配置 | P0     | 默认 7 天，可由应用配置覆盖                   |
| SE-03 | Token 存储可配置     | P0     | 支持 localStorage 和 cookie 两种模式          |
| SE-04 | 登录状态 Hook        | P0     | React Hook 能返回当前用户、session 和加载状态 |
| SE-05 | Refresh Token        | P1     | session 可在有效刷新窗口内续期                |
| SE-06 | 服务端强制注销       | P1     | 后端可通过黑名单或版本号使 token 失效         |
| SE-07 | 钱包断开自动注销策略 | P1     | 应用可配置钱包断开后是否清理 session          |

### 9.6 UI 组件

| 编号  | 需求                | 优先级 | 验收标准                                     |
| ----- | ------------------- | ------ | -------------------------------------------- |
| UI-01 | Connect Wallet 按钮 | P0     | 显示未连接、连接中、已连接状态               |
| UI-02 | 钱包选择弹窗        | P0     | 钱包按链分组，展示安装状态和连接状态         |
| UI-03 | 账户状态组件        | P0     | 显示地址缩写、链标识、断开入口               |
| UI-04 | 深色与浅色主题      | P0     | 可跟随系统主题或手动指定                     |
| UI-05 | Headless 模式       | P0     | 不使用 UI 包时，Hooks 能覆盖完整连接登录链路 |
| UI-06 | 响应式布局          | P0     | 移动端弹窗可用，不出现内容溢出               |
| UI-07 | 主题定制            | P1     | 支持主题色、字体、圆角等基础变量             |
| UI-08 | 中英文 i18n         | P1     | 默认提供 `zh-CN` 与 `en-US`                  |
| UI-09 | 多钱包管理 UI       | P2     | 支持绑定、解绑、设置主钱包                   |

### 9.7 开发者体验

| 编号  | 需求                 | 优先级 | 验收标准                                             |
| ----- | -------------------- | ------ | ---------------------------------------------------- |
| DX-01 | 完整 TypeScript 类型 | P0     | 对外 API 无隐式 `any`                                |
| DX-02 | API 文档             | P0     | 覆盖 Provider、Hooks、组件、后端 SDK 和 Adapter 接口 |
| DX-03 | 示例工程             | P0     | 至少包含 Next.js、Vite、纯 EVM、纯 Sui、多链示例     |
| DX-04 | 可读错误信息         | P0     | 错误包含阶段、链类型、钱包名称和可行动建议           |
| DX-05 | SSR 支持             | P0     | Next.js App Router 下无 hydration 错误               |
| DX-06 | 不依赖中心化后端     | P0     | 用户可完全自托管认证后端；托管服务只是可选增值能力   |
| DX-07 | CLI 脚手架           | P1     | 可一键生成示例应用                                   |
| DX-08 | Debug Panel          | P2     | 开发模式展示连接状态、事件日志和 session 信息        |

### 9.8 后端 SDK

| 编号  | 需求                       | 优先级 | 验收标准                                            |
| ----- | -------------------------- | ------ | --------------------------------------------------- |
| BE-01 | Node.js 验签 SDK           | P0     | 支持 EVM 与 Sui 验签                                |
| BE-02 | nonce 管理工具             | P0     | 默认支持 Redis，同时提供内存实现用于开发            |
| BE-03 | 参考认证接口               | P0     | 提供 `/auth/nonce`、`/auth/verify`、`/auth/me` 示例 |
| BE-04 | 自定义 User Repository     | P0     | 应用可接入自有数据库                                |
| BE-05 | Next.js Route Handler 示例 | P0     | 可直接运行并完成登录闭环                            |
| BE-06 | Express/Fastify 中间件     | P1     | 可快速接入常见 Node Web 框架                        |
| BE-07 | Go/Rust/Python 后端 SDK    | P1     | v1.0 前提供核心验签与 nonce 校验能力                |
| BE-08 | 托管 nonce/session 服务    | P1     | 作为可选增值服务提供，不影响自托管使用              |

## 10. 核心 API 草案

### 10.1 前端 Provider

```tsx
<DolphinProvider
  adapters={[evmAdapter(), suiAdapter()]}
  auth={{
    nonceUrl: "/auth/nonce",
    verifyUrl: "/auth/verify",
    meUrl: "/auth/me",
    tokenStorage: "cookie"
  }}
>
  <App />
</DolphinProvider>
```

### 10.2 React Hooks

| Hook                 | 用途                    |
| -------------------- | ----------------------- |
| `useWallets()`       | 获取可用钱包列表        |
| `useConnect()`       | 连接指定钱包            |
| `useDisconnect()`    | 断开钱包                |
| `useAccounts()`      | 获取当前连接账户        |
| `useSignIn()`        | 发起 SIWX 签名登录      |
| `useSession()`       | 读取 session 与用户身份 |
| `useChainAdapters()` | 读取当前启用的链能力    |

### 10.3 后端接口

| 接口                     | 方法     | 说明                                             |
| ------------------------ | -------- | ------------------------------------------------ |
| `/auth/nonce`            | `POST`   | 根据 domain、chainType、address 下发一次性 nonce |
| `/auth/verify`           | `POST`   | 校验 SIWX 消息和签名，签发 session               |
| `/auth/me`               | `GET`    | 获取当前登录用户                                 |
| `/auth/logout`           | `POST`   | 注销当前 session                                 |
| `/identity/accounts`     | `GET`    | P1，查询用户绑定的钱包账户                       |
| `/identity/accounts`     | `POST`   | P1，绑定新钱包                                   |
| `/identity/accounts/:id` | `DELETE` | P1，解绑钱包                                     |

## 11. 数据模型草案

### 11.1 Account

```ts
type ChainType = "evm" | "sui" | "solana" | "bitcoin" | "aptos" | "ton";

type Account = {
  id: string;
  identityId: string;
  chainType: ChainType;
  chainId?: string | number;
  address: string;
  publicKey?: string;
  walletName?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### 11.2 Identity

```ts
type Identity = {
  id: string;
  primaryAccountId: string;
  accounts: Account[];
  createdAt: string;
  updatedAt: string;
};
```

### 11.3 SIWX Message

```ts
type SIWXMessage = {
  domain: string;
  address: string;
  chainType: ChainType;
  chainId?: string | number;
  uri: string;
  version: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  statement?: string;
};
```

## 12. 安全要求

- 签名消息必须包含 domain，后端必须校验 domain 与当前服务一致。
- nonce 必须由后端生成，具备随机性、过期时间和单次使用约束。
- 验签必须校验 address、chainId、domain、nonce、issuedAt、expirationTime 和签名有效性。
- nonce 验签成功后必须立即销毁，验签失败次数应可限制。
- JWT 签名密钥必须满足强度要求，弱密钥在启动时抛出错误或强告警。
- cookie 模式必须支持 HttpOnly、Secure、SameSite，并在需要时启用 CSRF 防护。
- 本地开发可允许 HTTP，生产环境默认要求 HTTPS。
- 地址规范化必须在服务端再次执行，不能只信任前端。
- 所有认证错误默认不泄露敏感细节，但开发模式可提供调试信息。
- 发布 v1.0 前应完成安全审计或至少完成第三方代码审查。

## 13. 非功能性要求

| 类别            | 指标                                                 |
| --------------- | ---------------------------------------------------- |
| 核心包体积      | gzip 后不超过 30 KB，不包含任何 Adapter              |
| 单 Adapter 体积 | gzip 后不超过 50 KB                                  |
| 钱包弹窗响应    | 用户点击后 300ms 内展示弹窗                          |
| 登录完成耗时    | 用户签名后 1.5s 内建立 session，正常网络条件下       |
| React 支持      | React 18+ 与 React 19                                |
| 框架支持        | Next.js、Vite、Remix、TanStack Start                 |
| 浏览器支持      | Chrome、Safari、Firefox、Edge 最近 2 个大版本        |
| 移动端支持      | iOS Safari 15+，Android Chrome 最近 2 个大版本       |
| Node.js 支持    | Node.js 18+                                          |
| 测试覆盖率      | 核心包单元测试覆盖率不低于 80%                       |
| 版本兼容        | 公共 API 遵循 SemVer，Breaking Change 需提供迁移说明 |

## 14. MVP 验收标准

MVP 完成时，应满足以下端到端验收：

- Next.js 示例应用中可同时启用 EVM 与 Sui。
- 用户可通过 EVM 钱包完成连接、签名、验签、JWT 登录和刷新恢复。
- 用户可通过 Sui 钱包完成连接、签名、验签、JWT 登录和刷新恢复。
- 后端 nonce 具备过期与单次使用能力。
- 前端能处理用户拒签、钱包未安装、账户切换、钱包断开、session 过期等常见状态。
- 默认 UI 在桌面端与移动端可用，支持深色和浅色主题。
- Headless Hooks 能在不使用默认 UI 的情况下完成相同登录流程。
- 文档中包含完整接入步骤、API 说明、安全注意事项和示例代码。

## 15. 版本规划

### v0.1 MVP，预计 4 周

- EVM Adapter。
- Sui Adapter。
- ChainAdapter 抽象。
- SIWX 消息构造。
- Node.js 后端验签 SDK。
- React Provider 与核心 Hooks。
- Connect Wallet 按钮与钱包选择弹窗。
- 地址即用户身份模型。
- JWT session。
- Next.js 接入示例。

### v0.2 Beta，预计 8 周

- Solana Adapter。
- WalletConnect v2 完整支持。
- 移动端深链唤起。
- 浅色主题与主题变量。
- 一人多钱包身份模型。
- Refresh Token。
- Express/Fastify 中间件。

### v1.0 Stable，预计 16 周

- Bitcoin 与 Aptos Adapter。
- 完整 i18n。
- CLI 脚手架。
- 文档站。
- 第三方 Adapter 开发规范。
- Go、Rust、Python 后端 SDK。
- 可选托管 nonce/session 服务。
- 安全审计。
- 生产级错误码与迁移指南。

### v1.x 后续方向

- TON、Cosmos、NEAR Adapter。
- EIP-1271 合约钱包支持。
- 硬件钱包支持。
- Debug Panel。
- Auth.js、Clerk 等主流 Auth 系统集成插件。

## 16. 成功指标

| 指标             | 目标                                                  |
| ---------------- | ----------------------------------------------------- |
| 首次接入时间     | 开发者 30 分钟内完成示例登录                          |
| 示例运行成功率   | 新用户按文档操作成功率不低于 90%                      |
| 登录成功率       | 正常钱包环境下不低于 95%                              |
| 文档覆盖度       | P0 API 与流程 100% 有示例                             |
| Adapter 扩展成本 | 新增一条链不需要改动核心包主流程                      |
| 增值服务转化     | 托管 nonce/session 服务具备可独立开通、计费和关闭能力 |
| 包体积           | 达成非功能性体积要求                                  |

## 17. 风险与应对

| 风险                         | 影响                          | 应对方案                                                           |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| 各链钱包标准差异大           | Adapter 复杂度上升            | 核心层只定义最小能力接口，链细节隔离在 Adapter 内                  |
| WalletConnect 或钱包标准变化 | 移动端连接不稳定              | 锁定大版本，维护兼容测试矩阵                                       |
| SSR 下钱包注入时序不一致     | 首屏状态闪烁或 hydration 问题 | Provider 默认延迟访问浏览器 API，文档提供 SSR 指南                 |
| 与成熟 SaaS 方案差异化不足   | 获取开发者困难                | 聚焦开源核心、自托管、非 EVM 覆盖、Headless 能力和可选托管增值服务 |
| 多钱包身份模型过早复杂化     | MVP 交付延期                  | MVP 只做地址即用户，多钱包绑定放入 v0.2                            |
| 验签安全细节容易遗漏         | 可能造成重放或钓鱼风险        | 后端 SDK 默认强校验，提供安全测试用例和审计清单                    |

## 18. 已决策问题

| 问题                                               | 决策                | 影响                                          |
| -------------------------------------------------- | ------------------- | --------------------------------------------- |
| 是否在 v1.0 前提供 Go、Rust 或 Python 后端 SDK？   | 提供                | v1.0 范围增加多语言后端 SDK                   |
| 是否提供可选的托管 nonce/session 服务？            | 提供                | 作为增值服务，不影响自托管能力                |
| 多钱包模式下敏感操作如何签名？                     | 任意已绑定钱包签名  | 默认授权策略为 Identity 下任意 Account 可签名 |
| 是否引入 Passkey/WebAuthn 作为非钱包兜底登录方式？ | 不引入              | 登录主路径保持钱包签名                        |
| 商业模式采用哪种？                                 | 开源核心 + 增值服务 | 开源 SDK 保持完整可用，托管与企业能力商业化   |
| 产品名称与包名是否确定？                           | 确定                | 产品名为 Dolphin ID，包名使用 `@dolphin-id/*` |
