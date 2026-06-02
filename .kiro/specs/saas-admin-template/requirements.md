# Requirements Document

## Introduction

`saas-admin-template`（仓库名 `keel-admin`）是一套面向企业级 SaaS 中后台业务的 React 前端模板工程，目标是让上层业务团队 fork 仓库后只关心"页面 + 业务 store + 业务 API"三件事，其余横切关注点（鉴权、权限、网络、状态、布局、Mock、测试、规范、国际化、主题、部署）由模板默认提供。

工程采用 pnpm workspaces + Turborepo 的 Monorepo 结构，把通用能力沉淀到 `packages/*` 形成可独立发布的共享包，业务主应用 `apps/admin` 通过 `workspace:*` 引用，外部业务项目通过私有 npm Registry 拉取。视觉上抛弃 AntD 默认风格，采用类 iOS 设计语言（低饱和度、大圆角、毛玻璃、轻量阴影）；`@ant-design/pro-components` 以薄封装方式融入 `@keel/ui`，保持视觉与权限/i18n 一致。

本需求文档以 Design 文档为输入，反向推导出可验证的功能与质量要求，用于驱动后续任务拆分与验收。

## Requirements

### Requirement 1: Monorepo 仓库结构与工具链

**User Story:** 作为模板维护者，我希望仓库采用 Monorepo 结构并把通用能力沉淀为可独立发布的包，以便后续多个业务项目能直接复用。

#### Acceptance Criteria

1. WHEN 开发者克隆仓库并执行 `pnpm install` THEN 系统 SHALL 安装 `apps/admin` 与所有 `packages/*` 的依赖且不报错
2. WHEN 仓库初始化完成 THEN 系统 SHALL 在根目录提供 `pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`、`.npmrc`、`commitlint.config.cjs` 等编排文件
3. WHEN 开发者运行 `pnpm turbo run lint typecheck test build` THEN 系统 SHALL 按依赖图顺序执行所有工作区任务并使用 Turbo 缓存命中已构建产物
4. WHILE 仓库存在 IF 任意 `packages/*` 之间出现循环依赖 THEN 系统 SHALL 在 CI 中检测并阻止合并
5. WHEN 主应用 `apps/admin` 通过 `@keel/*` 引用任意共享包 THEN 系统 SHALL 通过 `tsconfig.base.json` 的 `paths` 直接解析到源码以支持免构建联调

### Requirement 2: 共享包独立可发布

**User Story:** 作为另一个 SaaS 子产品的开发者，我希望能像安装第三方库一样安装 `@keel/*` 包，以便复用模板的核心能力而无需 fork 整个仓库。

#### Acceptance Criteria

1. WHEN 任一 `packages/*` 完成构建 THEN 系统 SHALL 同时输出 ESM、CJS、TypeScript Declaration（DTS）三种产物
2. WHEN 包被 tree-shake THEN 系统 SHALL 通过 `sideEffects: false` 与精确 `exports` 字段确保未使用代码被移除
3. WHEN 任意 PR 修改 `packages/*` 源码 THEN 系统 SHALL 要求 PR 包含 `changeset` 文件，否则 CI 阻止合并
4. WHEN 维护者合并 Changesets 生成的 "Version Packages" PR 到 main THEN 系统 SHALL 自动通过 CI 把受影响包以独立版本号发布到私有 Registry
5. WHEN 外部业务项目在 `.npmrc` 配置了 `@keel` scope 与认证 token THEN 系统 SHALL 允许通过 `pnpm add @keel/<pkg>` 正常安装与使用
6. WHERE 第三方依赖（react、antd、axios、react-router-dom 等）出现在 `packages/*` 中 THE 系统 SHALL 把它们声明为 `peerDependencies` 而非 `dependencies`

### Requirement 3: 权限机制与数据的边界

**User Story:** 作为业务开发者，我希望权限机制（判定、路由组装）由共享包提供，而权限数据（具体权限码、菜单、角色）保留在业务应用，以便每个 SaaS 子产品定义自己的权限模型。

#### Acceptance Criteria

1. WHERE 权限相关代码 THE `@keel/auth` 包 SHALL 仅包含与具体业务无关的机制：`usePermission`、`<Auth />`、`<AuthGuard />`、`buildRoutes`、菜单到路由的转换算法
2. WHERE 业务权限码、角色清单、菜单种子 THE 系统 SHALL 把它们留在 `apps/admin/src/config/permissions.ts` 与后端菜单接口，不出现在 `packages/*`
3. WHEN 业务应用初始化 THEN 系统 SHALL 通过 `createAuth(adapter)` 工厂注入业务侧的 `useContext` 适配器，使 `@keel/auth` 能从业务 store 读取 `permissions: Set<string>` 与 `roles: Set<string>`；IF `createAuth()` 在未传入 adapter 或传入 null 时被调用 THEN 系统 SHALL 仍允许创建实例，但所有 `usePermission().has(...)` 与 `<Auth />` 判定 SHALL 静默返回 `false`
4. WHEN 调用 `usePermission().has(code)` THEN 系统 SHALL 在 `code` 为字符串时返回 `permissions.has(code)`，在 `code` 为字符串数组且 `mode='some'` 时任一命中为真，在 `mode='every'` 时全部命中为真；IF 调用方未传 `code`（即未显式发起权限校验） THEN 系统 SHALL 默认放行（返回 `true`）
5. WHEN 路由配置中存在 `permissionCodes` THEN 系统 SHALL 在 `buildRoutes` 阶段过滤掉无任一命中权限码的节点
6. WHERE 业务需要扩展为 ABAC 或数据级权限 THE 系统 SHALL 通过 `PermissionContext.predicate` 钩子允许业务侧注入自定义判定逻辑

### Requirement 4: 动态路由与按钮级权限

**User Story:** 作为登录用户，我希望菜单与可访问页面与我的权限严格匹配，以便看不到不应看到的页面与按钮。

#### Acceptance Criteria

1. WHEN 用户登录成功并加载完用户信息 THEN 系统 SHALL 调用 `/user/menus` 与 `/user/permissions`，并把结果写入 `userStore`
2. WHEN `userStore` 拿到菜单树 THEN 系统 SHALL 通过 `buildRoutes` 把菜单树转换为 React Router v6 的 `RouteObject[]`
3. WHEN 路由发生变化 IF 当前路由的 `permissionCodes` 非空且用户未持有任一对应权限码 THEN 系统 SHALL 重定向到 `/exception/403`
4. WHEN 业务页面渲染按钮 IF 该按钮被 `<Auth code="xxx">` 包裹且用户不持有该权限 THEN 系统 SHALL 渲染 `fallback`（默认隐藏）
5. WHEN 用户切换租户成功 THEN 系统 SHALL 重新拉取菜单与权限并重建路由表
6. IF 后端菜单树包含 `redirect` THEN 系统 SHALL 渲染 `<Navigate to=redirect replace>` 而非加载组件
7. IF 菜单节点的 `hidden` 为 `true` THEN 系统 SHALL 不在侧边栏渲染该节点但仍生成对应路由
8. WHILE 用户处于已登录状态 THE 系统 SHALL 始终保留 `/login`、`/exception/403`、`/exception/404`、`*` 兜底路由

### Requirement 5: HTTP 网络层

**User Story:** 作为业务开发者，我希望 HTTP 调用具备多环境切换、无感刷新 Token、防重复提交、统一业务错误拦截能力，以便专注业务而非基础设施。

#### Acceptance Criteria

1. WHEN `createHttp(options)` 被调用 THEN 系统 SHALL 返回一个已注册请求/响应拦截器的 Axios 实例
2. WHEN 任意请求收到 HTTP 401 IF 当前未在刷新 Token THEN 系统 SHALL 调用 refresh 接口获取新 Token，刷新成功后复放原请求；IF 当前正在刷新 THEN 系统 SHALL 把原请求加入等待队列
3. WHILE 同一刷新窗口内存在多个 401 请求 THE 系统 SHALL 保证 `api.refresh` 至多被调用一次
4. WHEN 响应信封 `code === 0` THEN 系统 SHALL 把 `envelope.data` 作为 `request<T>` 的解析结果返回；WHEN `code !== 0` THEN 系统 SHALL 抛 `BizError(code, message, traceId)`
5. WHEN 请求发生业务错误 IF 调用方未传 `silent: true` THEN 系统 SHALL 通过统一渠道（如 `message.error`）展示错误文案
6. WHEN 同一指纹（method + url + sorted(params) + stableHash(body)）的请求在飞行中 IF 未传 `allowConcurrent: true` THEN 系统 SHALL 取消后到的重复请求并抛 `CanceledError`
7. WHEN 请求完成（无论成败） THEN 系统 SHALL 从防重复指纹 map 中移除该请求
8. WHEN 业务环境切换（dev / staging / production） THEN 系统 SHALL 通过 `import.meta.env` 自动选择 `VITE_API_BASE_URL` 等配置，无需修改源码
9. WHEN HTTP 请求发出 THEN 系统 SHALL 自动注入 `Authorization`（若有 token）、`X-Tenant-Id`、`Accept-Language` 三个头

### Requirement 6: 状态管理（Zustand）

**User Story:** 作为业务开发者，我希望状态按业务域切片管理且登出时统一清理，以便避免单一全局 store 膨胀和状态泄漏。

#### Acceptance Criteria

1. WHERE 状态管理 THE 系统 SHALL 至少提供 `userStore`、`tenantStore`、`appStore` 三个核心切片，业务模块切片放在 `stores/modules/`
2. WHEN 用户登出 THEN 系统 SHALL 调用所有切片的 `reset()` 方法，使 store 状态回到初始值
3. WHEN 调用 `userStore.reset()` 多次 THEN 最终状态 SHALL 与调用一次等价（幂等）
4. WHERE `userStore.permissions` THE 系统 SHALL 以 `Set<string>` 形态存储以保证 O(1) 命中判断
5. WHERE `userStore` 与 `tenantStore` THE 系统 SHALL 通过 `zustand/middleware/persist` 持久化到 localStorage
6. WHERE `appStore` THE 系统 SHALL 仅持久化「折叠态、主题、语言」，不持久化多页签栈

### Requirement 7: 布局壳与多页签

**User Story:** 作为登录用户，我希望进入受保护区后能看到稳定的左侧菜单、顶部 Header、面包屑、多页签，以便高效在多个页面间切换。

#### Acceptance Criteria

1. WHEN 用户访问受保护路由 THEN 系统 SHALL 渲染 `BasicLayout`，包含 Sider、Header、Breadcrumb、Tabs、Outlet 五个区域
2. WHEN 用户首次访问某个路由 THEN 系统 SHALL 在多页签栈中追加该页签
3. WHEN 用户关闭某个页签 IF 页签 `affix` 为 `true` THEN 系统 SHALL 阻止关闭
4. WHEN 用户切换语言 THEN 系统 SHALL 同步更新 Sider 菜单文案、Header 控件、Breadcrumb 与多页签标题
5. WHEN 用户切换主题（light/dark） THEN 系统 SHALL 通过 ConfigProvider 即时切换且不刷新页面
6. WHEN 路由变化 THEN 系统 SHALL 同步更新当前激活页签与面包屑路径

### Requirement 8: 国际化（i18n）

**User Story:** 作为最终用户，我希望应用支持中英文切换且首屏不被语言包加载阻塞，以便低延迟使用。

#### Acceptance Criteria

1. WHERE 国际化能力 THE `@keel/i18n` 包 SHALL 基于 `react-i18next` + `i18next` + `i18next-http-backend` + `i18next-browser-languagedetector`
2. WHEN 应用首屏加载 THEN 系统 SHALL 仅同步加载 `common` 命名空间，其它业务命名空间在进入对应路由前懒加载
3. WHEN 用户切换语言 THEN 系统 SHALL 调用 `i18next.changeLanguage(locale)`、`dayjs.locale(locale)` 并更新 `<ConfigProvider locale=...>`，整个过程不刷新页面
4. WHEN HTTP 请求发出 THEN 系统 SHALL 自动注入 `Accept-Language` 请求头与当前 locale 一致
5. WHILE 网络异常 IF 语言包请求失败 THEN 系统 SHALL 回退到 `localStorage` 缓存的同语言包
6. WHERE 业务语言资源 THE 系统 SHALL 放在 `apps/admin/src/locales/{lang}/{module}.json`，与 `@keel/i18n` 中的公共词条用命名空间隔离

### Requirement 9: 类 iOS 主题

**User Story:** 作为视觉负责人，我希望应用整体抛弃 AntD 默认风格，呈现"类 iOS"设计语言，以便品牌差异化。

#### Acceptance Criteria

1. WHERE 主题配置 THE 系统 SHALL 通过 `<ConfigProvider theme={themeConfig}>` 注入由 `@keel/theme` 导出的 token，不直接修改 less 变量
2. WHERE 视觉规范 THE 系统 SHALL 满足以下默认值：主色 `#0A84FF`、底色 `#F2F2F7`、按钮/输入框圆角 ≥ 12px、卡片/弹窗圆角 ≥ 16px、字体栈包含 SF Pro / PingFang SC / Inter
3. WHERE Header 与 Modal 蒙层 THE 系统 SHALL 应用 `backdrop-filter: blur(...)` 实现毛玻璃效果
4. WHERE 阴影 THE 系统 SHALL 使用「轻投影 + 弱外阴影」组合，避免 AntD 默认蓝色边框
5. WHEN 切换为暗色模式 THEN 系统 SHALL 通过 `theme.algorithm = darkAlgorithm` 与 `darkTokens` 映射切换，且不刷新页面（该规则仅在切换至暗色模式的瞬间生效）
6. WHEN `@keel/theme` 升级 THEN 业务方 SHALL 仅通过升级 npm 包获得视觉刷新，无需修改业务代码

### Requirement 10: Pro-Components 封装策略

**User Story:** 作为业务开发者，我希望复杂的列表页与表单基于 `@ant-design/pro-components` 但已注入主题、i18n、权限默认值，以便少写样板。

#### Acceptance Criteria

1. WHERE 跨产品复用的业务组件 THE `@keel/ui` 包 SHALL 提供 `KeelTable`、`KeelForm`、`KeelDescriptions`、`KeelCard`、`PageContainer` 等基于 pro-components 的薄封装
2. WHEN `KeelTable` 接收的 `columns[i].permission` 不为空 IF 当前用户不持有该权限 THEN 系统 SHALL 在渲染前过滤掉该列
3. WHERE 默认表格行为 THE 系统 SHALL 默认开启分页、密度切换、刷新、列设置，并禁用全屏切换的浮夸动效；即使开发者显式传入自定义 `options`，系统 SHALL 始终保留这四项默认能力开启（无法被禁用）
4. WHERE 视觉一致性 THE 系统 SHALL 通过 `ConfigProvider` 让 pro-components 与 AntD 共享同一套 token，并在 `@keel/theme` 中维护 pro-components 专用 overrides；IF overrides 与共享 token 视觉冲突 THEN 系统 SHALL 允许覆盖（不强制保持视觉一致）
5. WHERE ProLayout THE 系统 SHALL 不直接使用，而是自实现 `BasicLayout`（避免与多租户/多页签耦合冲突）

### Requirement 11: 本地 Mock

**User Story:** 作为前端开发者，我希望在没有后端的情况下也能本地跑通登录与典型 CRUD，以便前后端解耦开发。

#### Acceptance Criteria

1. WHEN `VITE_USE_MOCK=true` 且开发服务器启动 THEN 系统 SHALL 通过 `vite-plugin-mock` 拦截匹配的 API 请求并返回 mock 数据
2. WHERE 生产构建 THE 系统 SHALL 默认禁用 mock，构建产物中不包含 mock 代码
3. WHERE Mock 响应 THE 系统 SHALL 严格遵循后端信封 `{code, data, message}`，确保切换到真实 API 时业务代码无需修改
4. WHERE Mock 范围 THE 系统 SHALL 至少覆盖：登录、Token 刷新、用户信息、菜单树、权限码、典型 CRUD（用户管理示例）
5. WHEN Mock 返回非法信封 THEN 系统 SHALL 在 CI 中通过 schema 校验报错并阻止合并

### Requirement 12: 多环境与 Vite 工程化

**User Story:** 作为部署工程师，我希望应用支持 dev / staging / production 三环境构建且环境变量在启动期被校验，以便避免上线后才发现配置缺失。

#### Acceptance Criteria

1. WHERE 环境变量 THE 系统 SHALL 通过 `.env`、`.env.development`、`.env.staging`、`.env.production` 四份文件管理
2. WHEN 应用启动或构建 THEN 系统 SHALL 通过自研 `env-validator` Vite 插件校验所有 `VITE_` 必填变量；IF 任意必填项缺失 THEN 系统 SHALL **先打印缺失变量列表，再中断启动**
3. WHEN `pnpm build:staging` 被执行 THEN 系统 SHALL 使用 `--mode staging` 与对应 `.env.staging` 构建产物
4. WHEN 生产构建 THEN 系统 SHALL 启用 `vite-plugin-compression` 输出 gzip/br 预压缩资源，并通过 `manualChunks` 切分 `react`、`antd`、`pro-components`、`zustand`、业务等 chunk
5. WHERE 构建元信息（版本号、commit、构建时间） THE 系统 SHALL 通过自研 `build-info` 插件注入到 `window.__BUILD_INFO__`

### Requirement 13: Docker 部署

**User Story:** 作为部署工程师，我希望应用通过多阶段 Dockerfile 打包到 Nginx 镜像，以便在任意容器平台一键部署。

#### Acceptance Criteria

1. WHEN `docker build` 被执行 THEN 系统 SHALL 使用多阶段构建：第一阶段 node:20-alpine + pnpm 构建产物，第二阶段 nginx:1.27-alpine 提供静态服务
2. WHERE Nginx 配置 THE 系统 SHALL 启用 gzip、设置安全响应头（X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy）、为 `/assets/` 设置长缓存、为 `index.html` 禁用缓存；IF 仅部分 nginx 能力配置完成 THEN 镜像构建 SHALL 仍然成功（缺失项作为告警而非阻断）
3. WHERE SPA 路由 THE Nginx SHALL 通过 `try_files $uri $uri/ /index.html` 实现 fallback
4. WHERE 健康检查 THE 镜像 SHOULD 提供 `/health` 端点并配置 `HEALTHCHECK` 指令；IF 镜像未实现健康检查 THEN 构建 SHALL 仍然视为有效
5. WHEN `docker buildx` 构建 THEN 系统 SHALL 输出 `linux/amd64` 与 `linux/arm64` 双架构镜像
6. WHEN 构建参数 `MODE` 被指定（development/staging/production） THEN Dockerfile SHALL 透传给 `vite build --mode`

### Requirement 14: CI/CD 流水线

**User Story:** 作为模板维护者，我希望每次 PR 与发布都自动跑 lint、单测、E2E、构建、镜像发布，以便保证质量与发布效率。

#### Acceptance Criteria

1. WHEN PR 被创建或推送 THEN GitHub Actions SHALL 触发 `ci.yml` 顺序执行 install、lint、typecheck、unit、build
2. WHEN PR 被创建或推送 THEN GitHub Actions SHALL 触发 `e2e.yml` 安装 Playwright 浏览器并执行 E2E 测试，失败时上传 `playwright-report` 与 trace
3. WHEN tag `v*` 被推送 THEN GitHub Actions SHALL 触发 `release.yml` 复用 build artifact 构建并推送 Docker 镜像到 Registry
4. WHEN Changesets 自动 PR 被合并 THEN 系统 SHALL 自动调用 `pnpm release` 发布所有受影响的 `@keel/*` 包到私有 npm Registry
5. WHERE CI 缓存 THE 系统 SHALL 使用 pnpm store 缓存与 Turbo 远程缓存，提升二次构建速度
6. IF lint、typecheck、unit、build、E2E 任一阶段失败 THEN 系统 SHALL 阻止 PR 合并

### Requirement 15: 测试策略

**User Story:** 作为质量负责人，我希望模板自带单测、属性测试、E2E 三层测试基础设施，以便开箱即用地保证关键路径质量。

#### Acceptance Criteria

1. WHERE 单元测试 THE 系统 SHALL 使用 Vitest + @testing-library/react，关键模块（`buildRoutes`、`tokenManager`、`dedupe`、`bizErrorInterceptor`、`usePermission`）行覆盖率 ≥ 80%、关键分支覆盖率 ≥ 90%
2. WHERE 属性测试（PBT） THE 系统 SHALL **特定使用** fast-check 对至少以下属性进行验证（不允许通过其它库或手写循环替代）：路由权限闭包、登出幂等、Token 刷新单飞、防重复不丢请求、信封透明、菜单到路由确定性、权限单调性
3. WHERE E2E 测试 THE 系统 SHALL 使用 Playwright 至少覆盖：登录成功/失败、Token 过期自动刷新、用户管理 CRUD 全流程、按钮级权限可见性、租户切换刷新菜单
4. WHEN E2E 失败 THEN 系统 SHALL 在 CI 上传 trace **与** HTML 报告作为失败附件（两者必须同时上传，缺一即视为 CI 步骤失败）
5. WHERE 测试运行命令 THE 系统 SHALL 在 CI 中默认使用单次执行模式（如 `vitest --run`、`playwright test`），避免 watch 阻塞

### Requirement 16: 代码规范与提交规范

**User Story:** 作为维护者，我希望仓库自带 ESLint + Prettier + Husky + Commitlint 规范化基础设施，以便团队风格一致与提交可追溯。

#### Acceptance Criteria

1. WHERE 代码规范 THE 系统 SHALL 通过 `@keel/eslint-config` 统一收敛 ESLint、Prettier、TypeScript 配置，并被所有工作区继承
2. WHEN 提交代码 THEN Husky pre-commit hook SHALL 通过 lint-staged 仅对暂存文件执行 ESLint + Prettier 修复
3. WHEN 提交代码 THEN Husky commit-msg hook SHALL 通过 Commitlint 校验 message 满足 `@commitlint/config-conventional` 规范，否则拒绝提交
4. WHERE 编辑器配置 THE 系统 SHALL 提供 `.editorconfig` 与 `.vscode/extensions.json` 推荐扩展
5. WHEN PR 被创建 THEN CI SHALL 在仓库层执行 `turbo run lint`，无视本地是否跳过 hook

### Requirement 17: 错误处理与全局错误边界

**User Story:** 作为最终用户，我希望应用出错时能看到友好提示而非白屏，以便继续使用其它功能。

#### Acceptance Criteria

1. WHERE 应用根 THE 系统 SHALL 提供全局 ErrorBoundary 组件，捕获子树渲染错误并展示降级 UI
2. WHEN 后端返回 HTTP 401 或业务码 `40100/40101` THEN 系统 SHALL 触发无感刷新；IF 刷新失败 THEN 系统 SHALL 清空 token、重置 store、跳转 `/login`
3. WHEN 后端返回业务码 `40300` THEN 系统 SHALL 跳转 `/exception/403`
4. WHEN 网络超时或非 2xx 且无业务信封 THEN 系统 SHALL 弹出"网络异常"提示并允许重试
5. WHEN 重复提交被去重器拦截 THEN 系统 SHALL 抛 `CanceledError` 而不弹出错误提示

### Requirement 18: 安全与多租户

**User Story:** 作为安全负责人，我希望模板在 Token 存储、XSS、CSRF、多租户隔离、依赖审计等方面提供合理默认值，以便降低安全债。

#### Acceptance Criteria

1. WHERE Token 存储 THE 系统 SHALL 默认使用 localStorage，并通过 `VITE_AUTH_STORAGE` 切换为 sessionStorage 或内存
2. WHERE 富文本渲染 THE 系统 SHALL 通过 DOMPurify 清洗，禁止使用 `dangerouslySetInnerHTML` 直接渲染未清洗内容
3. WHEN 后端要求 CSRF THEN 系统 SHALL 在请求拦截器读取 `csrf-token` cookie 并写入请求头
4. WHEN HTTP 请求发出 THEN 系统 SHALL 强制注入 `X-Tenant-Id` 头，业务代码不得覆盖；该规则适用于**所有出站请求**（包括内部服务间调用与第三方外部 API），不存在豁免清单
5. WHERE 依赖审计 THE CI SHALL 执行 `npm audit --omit=dev` 或等价命令，发现高危漏洞时告警

### Requirement 19: 性能

**User Story:** 作为最终用户，我希望应用首屏快、切换流畅、表格大数据时不卡，以便高效完成中后台操作。

#### Acceptance Criteria

1. WHERE 路由 THE 系统 SHALL 通过 `React.lazy + import.meta.glob` 实现页面级懒加载，配合 `<Suspense>` 与 `LoadingPlaceholder`
2. WHERE 表格 THE 当数据行数 > 200 时系统 SHALL **强制**启用虚拟滚动以保持滚动 FPS（开发者无法关闭，即便业务场景需要拖拽等可能与虚拟滚动冲突的能力）
3. WHERE 列表页 THE 系统 SHALL 通过 `useRequest` 提供 stale-while-revalidate 缓存，切回时优先显示缓存
4. WHERE 构建产物 THE 系统 SHALL 通过 `manualChunks` 让单个 chunk gzip 后 < 250KB
5. WHERE 主题切换 THE 系统 SHALL 使用 AntD 5 的运行时 token，不重复打包 less

### Requirement 20: 典型 CRUD 页面示例

**User Story:** 作为业务开发者，我希望模板自带一个完整的 CRUD 页面示例，以便照葫芦画瓢快速开发新模块。

#### Acceptance Criteria

1. WHERE 页面示例 THE 系统 SHALL 在 `apps/admin/src/pages/system/user` 下提供完整的"用户管理"CRUD 示例
2. WHERE 该示例 THE 系统 SHALL 演示：搜索表单、列表（含分页/列设置）、新建/编辑/删除按钮、按钮级权限（`<Auth />`）、`useTable` Hook、`KeelTable` 组件
3. WHEN 在 mock 模式下访问该页面 THEN 系统 SHALL 跑通完整 CRUD 流程而无需真实后端
4. WHERE 该示例 THE 系统 SHALL 同时被 Playwright E2E 用例覆盖


### Requirement 21: 登录页视觉完善

**User Story:** 作为访问系统的用户，我希望登录页具备完整的 SaaS 品牌感与类 iOS 视觉体验，以便在第一印象上建立对产品的信任感。

#### Acceptance Criteria

1. Login_Page SHALL 在表单卡片顶部展示品牌 Logo 图标（或占位 SVG，高度固定 48px）与系统名称（默认 "Keel Admin"），Logo 区容器高度 80px，Logo 图标与名称水平居中对齐
2. WHEN Login_Page 初次渲染 THEN Login_Page SHALL 显示用户名输入框（前缀图标 UserOutlined）、密码输入框（前缀图标 LockOutlined、类型 password）、"记住我"Checkbox 与"登录"按钮四个核心表单元素，且四个元素均在视口中可见
3. IF 用户点击"登录"按钮时用户名或密码为空 THEN Login_Form SHALL 在对应字段下方展示内联错误文案，且不发起任何网络请求
4. WHILE 登录请求正在进行中 THE Login_Button SHALL 呈现 loading 旋转图标，且整个表单（所有输入框、Checkbox、按钮）SHALL 处于禁用态（`disabled={true}`），以防重复提交
5. WHEN 后端返回认证失败（业务码 40100 或 HTTP 401） THEN Login_Page SHALL 在表单上方展示 AntD `Alert` 组件（type="error"）形式的内联错误提示，文案优先取后端响应的 `message` 字段，回退为 i18n 键 `auth.login.error` 的默认值；WHEN 用户再次发起登录请求时 THEN Login_Page SHALL 清除上次的 Alert 提示
6. WHEN 登录成功 THEN Login_Page SHALL 以 `navigate(target, { replace: true })` 导航到目标路由，其中 target 优先取 URL query 参数 `?redirect`（仅接受以 `/` 开头的相对路径，拒绝 `http(s)://` 开头的绝对 URL），回退到 `/`
7. Login_Page 背景 SHALL 渲染低饱和度渐变（CSS 值：`linear-gradient(135deg, rgba(10,132,255,0.08), rgba(94,200,250,0.06))`），背景铺满 `100vw × 100vh`
8. Login_Card SHALL 应用毛玻璃样式（`backdrop-filter: blur(20px) saturate(180%)`）、`borderRadius` ≥ 16px、AntD Card `bordered={false}`；卡片宽度在视口宽度 ≥ 768px 时固定为 400px，在视口宽度 < 768px 时宽度为 `calc(100vw - 32px)`（左右各留 16px 边距）
9. WHEN 用户在密码输入框按下 Enter 键 THEN Login_Form SHALL 触发与点击"登录"按钮完全相同的提交逻辑（包含字段校验）
10. WHEN 用户勾选"记住我"并登录成功 THEN Login_Page SHALL 以键名 `keel_remembered_username`、过期时间 30 天将用户名写入 localStorage；WHEN 用户下次访问 Login_Page THEN Login_Page SHALL 读取该键并将用户名预填到用户名输入框，同时勾选"记住我"
11. IF 页面在视口宽度 < 768px 的移动端渲染 THEN Login_Page SHALL 保持单列布局，所有可交互表单元素的 touch target 高度 ≥ 44px、宽度 ≥ 44px，且相邻元素间的垂直间距 ≥ 8px

### Requirement 22: BasicLayout 首页框架完善（含 Dashboard 页）

**User Story:** 作为登录后的用户，我希望进入主界面后看到功能完整的框架布局与欢迎仪表盘，以便快速定位各功能入口并了解系统概要。

#### Acceptance Criteria

1. WHEN 用户登录成功后进入受保护路由 THEN BasicLayout SHALL 渲染完整的三区域框架：左侧可折叠 Sider（宽度 240px，折叠后 80px）、右侧顶部 Header（高度固定 56px）、以及内容区（含 Tabs + Outlet）
2. WHEN 用户点击 Header 中的菜单折叠按钮 THEN Sider SHALL 在 240px 与 80px 之间以 CSS `transition: width 200ms ease` 平滑过渡（不超过 300ms），并同步将 `appStore.collapsed` 状态取反
3. WHEN 浏览器视口宽度首次低于 1024px（lg 断点）时 THEN Sider SHALL 自动设置 `collapsed: true` 并触发与手动折叠相同的过渡效果；WHEN 视口宽度重新超过 1024px 时 THEN Sider SHALL 恢复为折叠前的 `collapsed` 状态
4. WHEN 路由路径变化 THEN Breadcrumb SHALL 在 200ms 内更新为当前路由的祖先路径链（基于 `userStore.menus` 树解析），根节点为首页，格式为"一级菜单 / 二级菜单"；IF 当前路由在菜单树中不存在对应节点 THEN Breadcrumb SHALL 仅显示首页节点
5. WHEN 用户首次访问某个路由 IF 该路由在 Tabs_Bar 中不存在对应页签 THEN Tabs_Bar SHALL 在末尾追加该路由的页签并将其设为激活态；IF 该路由已存在对应页签 THEN Tabs_Bar SHALL 直接激活已有页签，不追加重复项
6. WHEN 用户点击 Tabs_Bar 中的关闭按钮 IF 页签的 `affix` 属性为 `true` THEN Tabs_Bar SHALL 不渲染该页签的关闭按钮；IF `affix` 为 `false` THEN Tabs_Bar SHALL 关闭该页签并优先激活其右侧相邻页签，若不存在右侧页签则激活左侧相邻页签，若关闭后 Tabs_Bar 为空则跳转到 `/`
7. Header 右侧操作区 SHALL 从左到右依次渲染：租户切换 Dropdown（仅当 `tenantStore.list.length > 0` 时显示）、语言切换 Dropdown（选项 zh-CN / en-US）、明暗主题切换 Button、用户 Dropdown（展示 `userInfo.displayName`，菜单项含"个人信息"与"退出登录"）
8. WHEN 用户点击"退出登录" THEN Logout_Flow SHALL 依次执行：调用 `authService.logout()`（失败时仍继续后续步骤，不阻断流程）、调用所有 store 切片的 `reset()`、调用 `tokenManager.clear()`，最后以 `navigate('/login', { replace: true })` 跳转
9. WHEN 用户访问 `/dashboard` 路由 THEN Dashboard_Page SHALL 渲染欢迎标题（格式：当 locale 为 zh-CN 时 `你好，{userInfo.displayName}！`，当 locale 为 en-US 时 `Hello, {userInfo.displayName}!`）与当前日期（格式：zh-CN 用 `YYYY年MM月DD日`，en-US 用 `MMMM D, YYYY`），欢迎区使用 `PageContainer` 或等价容器组件
10. Dashboard_Page 统计卡片区 SHALL 展示恰好 4 张统计卡片（今日用户数、在线租户数、待处理工单数、系统状态），卡片数据由前端静态 Mock 数值提供，每张卡片 `borderRadius` ≥ 16px、`boxShadow` 使用轻量外阴影（`0 2px 8px rgba(0,0,0,0.06)`）、`bordered={false}`
11. WHEN 用户切换语言（调用 `i18next.changeLanguage`） THEN Sider 菜单文案、Header 控件标签、Breadcrumb 路径名称、Tabs_Bar 页签标题 SHALL 在同一渲染周期内（不超过一次 React 更新批次）同步更新，无需刷新页面
12. WHEN 用户切换主题（light ↔ dark） THEN ConfigProvider 的 `theme` prop SHALL 在同一渲染周期内更新为对应 token 集，BasicLayout 及其所有子组件 SHALL 在 100ms 内完成重绘，不触发页面 `window.location.reload()`
13. IF `userStore.menus` 为空数组 THEN Sider 菜单区域 SHALL 渲染文案"暂无菜单"（zh-CN）/ "No menu"（en-US）的占位提示，不抛出 JavaScript 异常
14. Content 区域 SHALL 设置 `overflow: auto` 实现独立滚动，Sider（`position: sticky` 或 AntD Layout 固定模式）与 Header（`position: sticky, top: 0`）SHALL 在内容区滚动时保持可见，不随内容区一同滚动

### Requirement 23: 用户管理 CRUD 页面 Pro-Components 重构

**User Story:** 作为系统管理员，我希望用户管理页面基于 `@ant-design/pro-components` 的 ProTable + ProForm 重构，以便获得开箱即用的搜索、列设置、密度切换与表单校验能力。

#### Acceptance Criteria

1. WHEN 用户访问 `/system/user` THEN UserManagement_Page SHALL 渲染基于 `ProTable<UserInfo>` 的用户列表，默认显示列：用户名（dataIndex: username）、显示名（dataIndex: displayName）、邮箱（dataIndex: email）、角色（dataIndex: roles，渲染为 Tag 列表）、操作列（含编辑/删除按钮）
2. UserManagement_Page ProTable 工具栏 SHALL 默认开启以下四项 toolbar option 且对业务开发者不可禁用：列设置（`setting: true`）、刷新（`reload: true`）、密度切换（`density: true`）、全屏切换（`fullScreen: true`）
3. WHEN 用户在 ProTable 顶部搜索区提交搜索 THEN Search_Form SHALL 收集字段名为 `keyword`（字符串，模糊匹配用户名/显示名）与 `status`（枚举 `'active' | 'disabled' | undefined`）的值，并将这两个参数透传给 `userService.list` 的查询参数
4. WHEN `userService.list` 返回分页数据 THEN ProTable SHALL 渲染分页器，`defaultPageSize` 为 10，并在分页器左侧展示总记录数（格式 zh-CN：`共 N 条`，格式 en-US：`Total N items`）
5. WHILE 用户持有 `user:create` 权限码 WHEN 用户点击工具栏"新建用户"按钮 THEN Create_Modal SHALL 打开包含以下 ProFormItem 的表单：用户名（必填，maxLength 64，submit 时如与已有用户名重复则在字段下方显示"用户名已存在"提示）、显示名（必填，maxLength 64）、邮箱（选填，HTML5 email 格式校验）、初始密码（必填，minLength 6，maxLength 128）、角色（多选 Select，选项：admin / editor / viewer）
6. WHILE 用户持有 `user:update` 权限码 WHEN 用户点击列表行编辑按钮 THEN Edit_Modal SHALL 打开预填当前行数据的 ProForm，用户名字段 SHALL 设置 `disabled={true}` 不可修改，密码字段 SHALL 不渲染，其余字段（显示名、邮箱、角色）可编辑
7. WHEN ProForm 提交时所有字段校验通过 THEN Modal_Form SHALL 进入 `confirmLoading` 状态，调用对应 service 方法；WHEN 调用成功 THEN Modal SHALL 关闭并调用 ProTable 的 `reload` 刷新列表，同时展示 `message.success`（zh-CN：`操作成功`，en-US：`Success`）；IF 调用失败 THEN Modal SHALL 保持打开状态，在 Modal 内 Form 顶部通过 AntD Alert（type="error"）展示 `BizError.message`，回退为 i18n 键 `common.error.unknown`
8. WHILE 用户持有 `user:delete` 权限码 WHEN 用户点击删除按钮 THEN Popconfirm SHALL 弹出二次确认，确认文案格式为 zh-CN：`确定删除用户 "{displayName}" 吗？`，确认后调用 `userService.remove(id)`，成功后刷新表格并展示 `message.success`
9. WHEN 用户不持有对应权限码 THEN `<Auth code=...>` 包裹的"新建"、"编辑"、"删除"按钮 SHALL 从 DOM 中移除（`display: none` 或不渲染），不渲染禁用态占位，且不影响页面其他元素的布局
10. 邮箱列（dataIndex: email）的 column 定义中 SHALL 挂载 `permission: 'user:list'`，当用户不持有 `user:list` 权限码时 `filterColumnsByPermission` 过滤函数 SHALL 从 columns 数组中移除该列，ProTable 不渲染该列
11. WHEN 在 `VITE_USE_MOCK=true` 模式下访问 UserManagement_Page THEN 系统 SHALL 通过现有 `mock/user.ts` handlers 完整支持搜索（GET `/api/users?keyword=...&status=...`）、新建（POST `/api/users`）、编辑（PUT `/api/users/:id`）、删除（DELETE `/api/users/:id`）四个流程，不需要真实后端
12. WHEN `@ant-design/pro-components` 在项目依赖中未找到（`import` 解析失败）时项目启动 THEN Vite 构建工具 SHALL 输出包含安装命令 `pnpm add @ant-design/pro-components --filter @keel/admin` 的错误信息并中断构建，不静默降级
13. UserManagement_Page ProTable 的数据加载 SHALL 通过 ProTable `request` prop 直接驱动，`request` 函数返回类型为 `{ data: UserInfo[]; success: boolean; total: number }`，不使用已有的 `useTable` hook
14. WHEN 用户点击 ProTable 搜索表单的"重置"按钮 THEN Search_Form SHALL 将 `keyword` 和 `status` 字段值清空为 `undefined`，并以 `{ current: 1, pageSize: 10 }` 的分页参数重新调用 `userService.list`

## Glossary

- **Monorepo**：单仓库多包项目结构，本工程使用 `pnpm workspaces + Turborepo` 实现。
- **Turborepo**：Vercel 出品的高性能任务编排器，提供本地缓存与远程缓存能力。
- **`@keel/*` 包**：本仓库 `packages/` 下沉淀的可独立发布的共享能力包，scope 为 `@keel`。
- **EARS**：Easy Approach to Requirements Syntax，需求条款常用关键词包括 WHEN / IF / WHILE / WHERE / SHALL。
- **ApiEnvelope**：后端统一响应信封 `{code, data, message, traceId?}`，`code === 0` 表示业务成功。
- **BizError**：当 `ApiEnvelope.code !== 0` 时由 HTTP 层抛出的业务错误对象。
- **Single-flight**：刷新 Token 等高敏请求的"一次只允许一个请求在飞行"的并发模式。
- **指纹（Fingerprint）**：用于去重的请求签名，由 method + url + sorted(params) + stableHash(body) 构成。
- **菜单树（Menu Tree）**：后端返回的 DAG 形态权限菜单结构，由 `MenuNode[]` 组成。
- **权限码（Permission Code）**：业务侧定义的字符串标识，例如 `order:delete`，用于按钮级与路由级权限控制。
- **AuthAdapter**：业务侧实现的"权限上下文读取适配器"，把业务 store 的权限/角色注入到 `@keel/auth`。
- **PBT**：Property-Based Testing，基于属性的测试，本仓库使用 `fast-check`。
- **类 iOS 主题**：本工程的视觉规范，包含低饱和度配色、大圆角、毛玻璃效果、轻量阴影、SF/Inter 字体栈。
- **Pro-Components**：`@ant-design/pro-components`，AntD 官方提供的高阶业务组件库（ProTable、ProForm、PageContainer 等）。
- **Changesets**：版本号与 changelog 自动化工具，用于 monorepo 包的独立发布。
- **Single-flight 队列**：刷新 Token 期间暂存的失败请求列表，刷新成功后批量复放。
