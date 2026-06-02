# Implementation Plan

## Overview

本任务清单基于 design.md 与 requirements.md 派生，按"地基 → 共享包 → 主应用框架 → 业务示例 → 工程化与部署 → 测试"的依赖顺序推进。

每个任务都映射到 requirements.md 中的具体条款，可独立验收。标注约定：

- `[PBT]`：需要使用 fast-check 编写属性测试的任务
- 子任务编号 `X.Y` 形式与父任务一一对应
- 末尾的 `_Requirements: ..._` 行声明该任务对应的 EARS 条款

执行建议：

- 优先完成第 1、2 节，把仓库与共享包发布机制跑通
- 第 3~8 节按依赖关系串行：types/utils → http → auth → i18n → theme → ui
- 第 9 节起以并行方式推进：主应用骨架、Mock、Vite 工程化、Docker/CI/CD 可分给不同成员
- 测试基础设施（第 15 节）建议在 4、5、8、9 节实现的同时穿插补齐 PBT，避免后期堆积

## Tasks

- [x] 1. 搭建 Monorepo 基础骨架与工具链
  - 创建 `pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`、`.npmrc`、`.editorconfig`、根级 `package.json` 与脚本编排
  - 在根目录配置 Husky + lint-staged + Commitlint，绑定 `pre-commit`、`commit-msg` hook
  - 在 `packages/eslint-config` 沉淀统一 ESLint / Prettier / TS 配置并导出 `index.js` / `react.js` / `node.js`
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 16.1, 16.2, 16.3, 16.4_

- [x] 1.1 验证 Turborepo 任务编排
  - 运行 `pnpm turbo run lint typecheck test build` 并校验顺序
  - 在 CI 中加入 turbo 缓存命中率断言
  - _Requirements: 1.3, 14.5_

- [x] 1.2 [PBT] 包间依赖图无环属性测试
  - 用 fast-check 随机生成包依赖图，断言"存在拓扑序"等价于"无环"，作为后续添加包时的验证基线
  - 在 CI 中以脚本形式扫描 `packages/*/package.json` 的实际 deps，断言不存在循环
  - _Requirements: 1.4_

- [x] 2. 搭建共享包发布基础设施
  - 在每个 `packages/*` 中提供统一 `package.json` 模板（type=module、exports、files、publishConfig、peerDeps）
  - 接入 `tsup` 输出 ESM + CJS + DTS 三形态，验证 `sideEffects: false` 与 tree-shaking
  - 接入 Changesets：`pnpm changeset` 流程、PR 校验、Version Packages Bot
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 2.1 跨包消费验证
  - 在仓库内通过 `tsconfig paths + workspace:*` 验证免 build 联调
  - 在仓库外用临时新仓库 `pnpm add @keel/<pkg>` 验证拉取与类型引用
  - _Requirements: 2.5, 2.6_

- [x] 3. 实现 `@keel/types` 与 `@keel/utils`
  - `@keel/types`：定义 `ApiEnvelope`、`UserInfo`、`MenuNode`、`Tenant`、`TabItem`、`PageResult` 等共享类型，无运行时代码
  - `@keel/utils`：实现 `storage`（适配器）、`logger`、`eventBus`、`debounce`、`stableHash` 等通用工具
  - _Requirements: 1.5, 2.6, 5.6_

- [x] 4. 实现 `@keel/http`：HTTP 工厂、拦截器、Token 管理、防重复提交
  - 实现 `createHttp(options)` 工厂返回 Axios 实例并装配请求/响应拦截器
  - 实现 `createTokenManager`：access/refresh 持久化、单飞刷新、等待队列、`onAuthExpired` 回调
  - 实现 `dedupe` 拦截器：基于指纹（method + url + sorted(params) + stableHash(body)）的去重，自动清理 map
  - 实现业务信封拦截器：`code===0` 解开 `data`，否则抛 `BizError(code, message, traceId)`
  - 实现 `Authorization` / `X-Tenant-Id` / `Accept-Language` 三头自动注入（强制注入，业务不可覆盖）
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 18.4_

- [x] 4.1 [PBT] Token 单飞刷新属性测试
  - fast-check 随机生成 N 个并发 401 请求，断言 `api.refresh` 调用次数 ≤ 1
  - 断言所有等待请求最终被同一次刷新结果 resolve 或同时 reject
  - _Requirements: 5.2, 5.3_

- [x] 4.2 [PBT] 信封透明属性测试
  - fast-check 随机生成 envelope，断言 `code===0` 时 `request<T>` 返回 `envelope.data`
  - 断言 `code !== 0` 时必抛 `BizError`，且错误对象包含原始 `code/message/traceId`
  - _Requirements: 5.4_

- [x] 4.3 [PBT] 防重复指纹去重属性测试
  - fast-check 随机生成请求集合：指纹两两不同时全部发出；存在相同指纹时仅一个发出，其余被 `CanceledError` 拒绝
  - 断言响应/错误后指纹 map 完全清空（无泄漏）
  - _Requirements: 5.6, 5.7_

- [x] 4.4 头注入与多环境单测
  - 例子化用例：mock 三类环境变量切换，断言 baseURL、tenant 头等正确
  - _Requirements: 5.8, 5.9_

- [x] 5. 实现 `@keel/auth`：权限机制（机制与数据严格解耦）
  - 实现 `createAuth(adapter)` 工厂，导出绑定 adapter 后的 `usePermission`、`Auth`、`AuthGuard`、`buildRoutes`
  - `usePermission().has(code, mode)`：支持单/数组、`every/some` 语义；无参时默认放行
  - `<Auth>` 组件：`code` 不持有时渲染 `fallback`（默认 null/隐藏）
  - `buildRoutes(menus, ctx)`：递归生成 React Router v6 RouteObject，含懒加载、AuthGuard 包裹、redirect 处理、hidden 节点保留路由
  - 适配器无 / null 时 `usePermission.has` 静默返回 false
  - 预留 `PermissionContext.predicate` 钩子用于 ABAC 扩展
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 4.2, 4.6, 4.7_

- [x] 5.1 [PBT] usePermission 语义属性测试
  - 单值：`has(c) ↔ permissions.has(c)`
  - 数组 + some：任一命中为真；数组 + every：全部命中为真；空数组退化为 true
  - 单调性：`P1 ⊆ P2 ⟹ ∀ c, has_{P1}(c) ⟹ has_{P2}(c)`
  - _Requirements: 3.4_

- [x] 5.2 [PBT] buildRoutes 权限闭包属性测试
  - fast-check 随机生成菜单森林（含 redirect、hidden、permissionCodes）与权限集合
  - 断言所有可达叶子节点要么 `permissionCodes` 为空，要么至少有一个码在 `userPermissions` 中
  - 断言静态兜底（`/login`、`/exception/403`、`/exception/404`、`*`）始终存在
  - 断言相同输入多次构建结构等价（确定性）
  - _Requirements: 3.5, 4.2, 4.6, 4.7, 4.8_

- [x] 6. 实现 `@keel/i18n`：国际化工厂与公共词条
  - 实现 `createI18n` 工厂、`I18nProvider`、`useT(namespace)` Hook
  - 装配 `i18next-http-backend` + `i18next-browser-languagedetector`，检测顺序：query > localStorage > navigator
  - 提供 `common` 公共命名空间词条（按钮、表单校验、错误码、网络错误兜底）
  - 提供 `changeLanguage` 流程：i18next + dayjs + AntD ConfigProvider 同步切换
  - 离线兜底：HTTP 失败时回退到 localStorage 缓存
  - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_

- [x] 6.1 命名空间懒加载验证
  - 例子化用例：模拟路由切换时 `loadNamespaces` 仅在进入新模块时被调用
  - _Requirements: 8.2_

- [x] 7. 实现 `@keel/theme`：类 iOS 主题
  - 导出 `tokens`、`darkTokens`、`themeConfig`，包含主色 #0A84FF、底色 #F2F2F7、圆角 12/16/20、毛玻璃、阴影、字体栈
  - 提供组件级 overrides（Button / Card / Modal / Table / Input / Menu / Tabs / Tag / Tooltip）
  - 提供全局样式片段（Header / Modal Mask 毛玻璃、卡片阴影、滚动条），由主应用 import
  - 暗色模式：`theme.algorithm = darkAlgorithm` + `darkTokens`，运行时切换不刷新页面
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 8. 实现 `@keel/ui`：业务组件薄封装
  - `PageContainer`：注入面包屑、标题、tab 状态
  - `SearchForm`：基于 ProForm 的查询表单封装
  - `KeelTable`：基于 ProTable 的表格封装，注入主题、i18n、列权限过滤、默认能力强制开启（分页/密度/刷新/列设置）
  - `KeelForm` / `KeelDescriptions` / `KeelCard`：基于 pro-components 的薄封装
  - `Auth` 组件 re-export 自 `@keel/auth`（避免业务侧重复 createAuth）
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 8.1 [PBT] KeelTable 列权限过滤属性测试
  - fast-check 随机生成列定义（含/不含 `permission`）与权限集合
  - 断言：列 `permission` 不存在时必渲染；存在时当且仅当权限命中时渲染
  - _Requirements: 10.2_

- [x] 9. 搭建 `apps/admin` 主应用骨架
  - 初始化 Vite + React 18 + TS 工程，引入 `@keel/*` 全部 workspace 依赖
  - 创建 `app/providers.tsx`：装配 ConfigProvider（注入 themeConfig）+ AntdApp + I18nProvider + 全局 ErrorBoundary
  - 创建 `app/bootstrap.ts`：恢复 token、拉取 user/menus/permissions、写入 stores、调用 buildRoutes 生成路由表
  - 创建 `main.tsx`：调用 bootstrap、createBrowserRouter、render 根节点
  - 创建 `auth.ts`：调用 `createAuth(adapter)` 注入 userStore selector，导出业务侧 `usePermission/Auth/AuthGuard/buildRoutes`
  - _Requirements: 4.1, 4.2, 4.5, 17.1, 18.1_

- [x] 9.1 实现 Zustand stores
  - `userStore`：userInfo / menus / permissions(Set) / roles，含 `setUser/setMenus/setPermissions/reset`
  - `tenantStore`：current / list / `switchTenant(id)`（重新拉取菜单与权限并重建路由）
  - `appStore`：collapsed / theme / locale / tabs，含切换方法；通过 persist 中间件持久化「折叠态/主题/语言」（tabs 不持久化）
  - 业务示例 store：`stores/modules/order.store.ts`
  - _Requirements: 4.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 9.2 [PBT] reset 幂等属性测试
  - fast-check 随机生成 store 状态，断言 `reset^n(state) === reset(state)`，n ≥ 1
  - _Requirements: 6.3_

- [x] 9.3 实现 BasicLayout 与多页签
  - `BasicLayout`：Sider（菜单树）+ Header（用户菜单/租户切换/语言/主题）+ Breadcrumb + Tabs + Outlet
  - 路由变化监听：自动维护 tabs 栈，`affix:true` 不可关闭
  - 语言切换：菜单/Breadcrumb/Tabs 标题同步刷新
  - 主题切换：通过 ConfigProvider 即时切换无刷新
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 9.4 实现登录页与异常页
  - `pages/login`：表单 + 提交 → 调 `/auth/login` → setTokens → 拉用户/菜单/权限 → 跳转首页
  - `pages/exception/403` 与 `pages/exception/404`
  - `pages/_async.ts`：基于 `import.meta.glob('/src/pages/**/*.tsx')` 的懒加载工厂
  - _Requirements: 4.1, 4.3, 4.8, 17.3_

- [x] 9.5 实现业务权限字典与 services
  - `apps/admin/src/config/permissions.ts`：业务权限码常量字典（PERMISSIONS.ORDER.* 等）
  - `services/auth.service.ts` / `user.service.ts` / `menu.service.ts` / `order.service.ts`
  - _Requirements: 3.2, 4.1, 5.4_

- [x] 10. 实现典型 CRUD 示例：用户管理
  - `pages/system/user/index.tsx`：搜索表单 + KeelTable + 分页 + 列设置 + 新建/编辑/删除按钮
  - 各操作按钮被 `<Auth code="user:xxx" />` 包裹
  - 演示 `useTable` Hook、stale-while-revalidate 缓存
  - _Requirements: 4.4, 10.1, 10.2, 19.3, 20.1, 20.2, 20.3_

- [x] 11. 配置 Mock 层
  - 实现 `mock/_utils.ts` 的 `wrap()` 工具强制信封化
  - 实现 `auth.ts`、`user.ts`、`menu.ts`、`order.ts` 全套 mock，1:1 复刻信封
  - 通过 `VITE_USE_MOCK` 环境变量开关；生产构建禁用
  - 在 CI 中加入 mock schema 校验
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 12. 配置 Vite 插件体系与多环境
  - 装配 `@vitejs/plugin-react`、`vite-plugin-mock`、`vite-plugin-checker`、`vite-plugin-svg-icons`、`vite-plugin-compression`、`rollup-plugin-visualizer`
  - 自研 `tooling/vite-plugins/env-validator`：启动期校验必填 VITE_ 变量，缺失时**先打印列表再中断**
  - 自研 `tooling/vite-plugins/build-info`：注入版本/commit/build time 到 `window.__BUILD_INFO__`
  - 配置 4 份 `.env.{,development,staging,production}` 与 `manualChunks`（react / antd / pro-components / zustand / business）
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 12.1 单 chunk gzip 大小验证
  - 例子化：构建后扫描 dist，断言 gzip 后任意 chunk < 250KB
  - _Requirements: 19.4_

- [x] 13. Docker 与 Nginx 部署配置
  - 编写 `docker/Dockerfile`：多阶段（node:20-alpine + pnpm 构建 → nginx:1.27-alpine 运行）
  - 编写 `docker/nginx.conf`：gzip、SPA fallback、安全头、`/assets/` 长缓存、`index.html` 不缓存、`/health` 端点、HEALTHCHECK 指令
  - 编写 `docker/docker-compose.yml`：本地一键起 admin + mock-api
  - 通过 `docker buildx` 输出 amd64 + arm64 双架构镜像
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

- [x] 14. CI/CD 流水线
  - `.github/workflows/ci.yml`：install / lint / typecheck / unit / build，使用 pnpm + turbo 缓存
  - `.github/workflows/e2e.yml`：安装 Playwright 浏览器、跑 E2E、失败时上传 trace **与** HTML 报告（两者必须同时上传）
  - `.github/workflows/release.yml`：tag 触发，复用 build artifact，docker buildx 推送多架构镜像
  - 接入 Changesets Action：合并 Version PR 后自动 `pnpm release` 发布 `@keel/*`
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 15.4_

- [x] 15. 测试基础设施
  - 安装 Vitest + @testing-library/react + jsdom，配置 coverage 阈值（行 ≥80%、关键分支 ≥90%）
  - 安装 fast-check 并把 4.1/4.2/4.3/5.1/5.2/8.1/9.2 等 PBT 任务接入
  - 安装 Playwright，编写：登录成功/失败、Token 过期自动刷新、用户管理 CRUD、按钮级权限可见性、租户切换刷新菜单
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 20.4_

- [x] 16. 安全与加固
  - 实现 Token 存储适配器（localStorage/sessionStorage/memory），由 `VITE_AUTH_STORAGE` 切换
  - 引入 DOMPurify 用于富文本清洗，并在 ESLint 规则中禁止裸 `dangerouslySetInnerHTML`
  - 在请求拦截器读取 `csrf-token` cookie 并写入请求头
  - CI 加入 `npm audit --omit=dev`
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 17. 性能优化
  - 路由懒加载 + Suspense + LoadingPlaceholder
  - 表格 >200 行强制虚拟滚动（不可关闭）
  - 实现 `useRequest` 的 stale-while-revalidate 缓存
  - 主题切换走 AntD 5 运行时 token，不重复打包 less
  - _Requirements: 19.1, 19.2, 19.3, 19.5_

- [x] 18. 文档与脚手架
  - 主应用 README：快速开始、目录速查、二次开发指南
  - 各 `packages/*` README：API、用法、Changelog 摘要
  - 预留 `tooling/scripts/create-app`：fork apps/admin 骨架的脚本接口
  - _Requirements: 1.2, 2.5_

## Task Dependency Graph

下图描述任务之间的强制依赖关系（"A → B" 表示 A 必须先完成）。无连线的任务可并行推进。

```json
{
  "waves": [
    {
      "wave": 1,
      "description": "仓库地基与共享发布机制",
      "tasks": ["1", "1.1", "1.2", "2", "2.1"]
    },
    {
      "wave": 2,
      "description": "共享类型与工具",
      "tasks": ["3"]
    },
    {
      "wave": 3,
      "description": "核心共享包并行实现（依赖 wave 2）",
      "tasks": ["4", "4.1", "4.2", "4.3", "4.4", "5", "5.1", "5.2", "6", "6.1", "7"]
    },
    {
      "wave": 4,
      "description": "UI 业务组件（依赖 5/6/7）",
      "tasks": ["8", "8.1"]
    },
    {
      "wave": 5,
      "description": "主应用骨架与基础页面（依赖 4/5/6/7/8）",
      "tasks": ["9", "9.1", "9.2", "9.3", "9.4", "9.5"]
    },
    {
      "wave": 6,
      "description": "业务示例与基础设施（依赖 wave 5）",
      "tasks": ["10", "11", "12", "12.1", "16", "17", "18"]
    },
    {
      "wave": 7,
      "description": "部署与流水线（依赖 wave 6）",
      "tasks": ["13", "14"]
    },
    {
      "wave": 8,
      "description": "测试基础设施（贯穿，最终收口）",
      "tasks": ["15"]
    }
  ]
}
```

```mermaid
graph TD
    T1[1. Monorepo 骨架] --> T2[2. 共享包发布基础]
    T2 --> T3[3. types & utils]
    T3 --> T4[4. http]
    T3 --> T5[5. auth]
    T3 --> T6[6. i18n]
    T3 --> T7[7. theme]
    T5 --> T8[8. ui]
    T6 --> T8
    T7 --> T8
    T4 --> T9[9. apps/admin 骨架]
    T5 --> T9
    T6 --> T9
    T7 --> T9
    T8 --> T9
    T9 --> T9_1[9.1 stores]
    T9 --> T9_3[9.3 BasicLayout]
    T9 --> T9_4[9.4 登录与异常页]
    T9 --> T9_5[9.5 权限字典与 services]
    T9_3 --> T10[10. 用户管理 CRUD 示例]
    T9_5 --> T10
    T8 --> T10
    T9 --> T11[11. Mock 层]
    T1 --> T12[12. Vite 插件与多环境]
    T9 --> T12
    T12 --> T13[13. Docker 与 Nginx]
    T1 --> T14[14. CI/CD]
    T13 --> T14
    T2 --> T14
    T1 --> T15[15. 测试基础设施]
    T4 --> T15
    T5 --> T15
    T8 --> T15
    T9_1 --> T15
    T10 --> T15
    T9 --> T16[16. 安全加固]
    T9 --> T17[17. 性能优化]
    T9 --> T18[18. 文档与脚手架]
    T2 --> T18
```

**关键路径**（最长依赖链，决定整体交付时间）：

`1 → 2 → 3 → {4, 5, 6, 7} → 8 → 9 → 9.3/9.5 → 10 → 15`

**可并行批次**：

- Batch A（依赖 T3）：T4、T5、T6、T7 可同时推进
- Batch B（依赖 T9）：T11、T16、T17、T18 可同时推进
- Batch C（依赖 T9.5 / T8）：T10 与 T15 内部 PBT 可穿插
- Batch D（依赖 T1）：T12、T14 可与共享包工作并行（不阻塞主线）

## Notes

### 验收策略

- 每个父任务（顶级编号）完成时，需对应跑通其所有子任务
- 标 `[PBT]` 的任务必须使用 fast-check 验证（不能用例子化测试替代，对应 Requirement 15.2）
- 所有任务在 PR 合并前必须通过 CI 五大阶段：lint / typecheck / unit / build / e2e

### 风险点

- **共享包发布权限**：在执行任务 2 前需要预先配置好私有 Registry（GHCR 或 Verdaccio）与 token 注入到 GitHub Secrets，否则 Changesets 自动发布会失败
- **Pro-Components 主题嫁接**：任务 8 的视觉一致性依赖任务 7 的 token 设计，建议先完成 7 再启动 8
- **E2E 稳定性**：任务 15 的 Playwright 用例需要 mock 层（任务 11）作为前置条件，避免依赖真实后端导致 CI flaky
- **Monorepo 类型路径解析**：任务 1 的 `tsconfig paths` 配置错误会导致 IDE 与构建解析不一致，需在 1.1 阶段验证

### 与 Design 的对照

- 共享包结构：design.md 的 "Shared Packages" 章节
- 权限机制 vs 数据：design.md 的 "关于 `@keel/auth` 的边界" 章节
- 类 iOS 主题：design.md 的 "类 iOS 主题（抛弃 AntD 默认风格）" 章节
- Docker 与 CI/CD：design.md 的 "Docker 部署与 CI/CD" 章节
- 关键算法：design.md 的 "Algorithmic Pseudocode" 章节（Bootstrap、buildRoutes、单飞刷新、防重复、信封拦截）

### 测试命令约定

- 单测：`pnpm turbo run test`（CI 默认 `--run` 模式）
- PBT 单独跑：`pnpm --filter @keel/<pkg> test --run path/to/*.pbt.test.ts`
- E2E：`pnpm --filter @keel/admin exec playwright test`
- 构建大小检查：`pnpm --filter @keel/admin run build && node tooling/scripts/check-chunk-size.mjs`

### 后续可选增强（不在当前 spec 范围）

- WebSocket 实时通道封装（消息中心、推送）
- 离线 PWA / Service Worker 缓存
- Feature Flag / 灰度开关基础设施
- 大文件分片上传组件
- 监控埋点 SDK 统一接入
