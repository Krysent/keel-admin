# Keel Admin

企业级 SaaS 中后台 React 前端模板。基于 Vite + React 18 + TypeScript + Ant Design 5，采用 pnpm workspaces + Turborepo Monorepo 架构，内建鉴权、权限、网络、状态、布局、Mock、测试、规范、国际化、主题、部署全套基础设施。

## 快速开始

```bash
# 克隆仓库
git clone <repo-url> keel-admin && cd keel-admin

# 安装依赖（需 Node ≥ 20、pnpm ≥ 9）
pnpm install

# 启动开发服务器（包含 Mock）
pnpm dev

# 运行全部检查
pnpm turbo run lint typecheck test build
```

默认开发地址：`http://localhost:5173`，Mock 登录账号 `admin / admin123`。

## 目录速查

```
keel-admin/
├── apps/
│   └── admin/                 # 业务主应用（Vite + React 18）
├── packages/
│   ├── auth/                  # 权限机制：usePermission、Auth、buildRoutes
│   ├── eslint-config/         # 统一 ESLint / Prettier / TS 配置
│   ├── http/                  # HTTP 工厂：Token 刷新、防重复、信封解包
│   ├── i18n/                  # 国际化工厂：createI18n、懒加载命名空间
│   ├── theme/                 # 类 iOS 主题：AntD 5 Token + 全局样式
│   ├── types/                 # 跨包共享类型（无运行时代码）
│   ├── ui/                    # 业务组件：KeelTable 等 Pro-Components 薄封装
│   └── utils/                 # 通用工具：storage、logger、eventBus、stableHash
├── tooling/
│   ├── scripts/               # 维护脚本（create-app、check-cycles 等）
│   └── dep-graph-check/       # 包依赖无环验证
├── docker/                    # Dockerfile + Nginx + docker-compose
├── .github/workflows/         # CI/CD（lint → test → build → release）
├── turbo.json                 # Turborepo 任务编排
├── pnpm-workspace.yaml        # Workspace 声明
└── tsconfig.base.json         # 共享 TS 配置（含 paths 免 build 联调）
```

## 可用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动所有工作区 dev 模式 |
| `pnpm build` | 构建全部（Turbo 并行 + 缓存） |
| `pnpm lint` | ESLint 检查 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | Vitest 单元测试（含 PBT） |
| `pnpm test:e2e` | Playwright E2E 测试 |
| `pnpm release` | 构建 packages + changeset publish |
| `pnpm ci:check-cycles` | 检测包间循环依赖 |
| `pnpm check-chunk-size` | 验证产物 gzip 后 < 250KB/chunk |

## 二次开发指南

### 新增业务页面

1. 在 `apps/admin/src/pages/<module>/` 创建页面组件
2. 后端菜单接口新增对应路由节点（含 `permissionCodes`）
3. 在 `services/` 添加 API 调用函数
4. 在 `stores/modules/` 添加业务 store（如需要）
5. Mock 层在 `apps/admin/mock/` 添加对应 handler

### 新增共享能力包

```bash
# 在 packages/ 下创建新包
mkdir packages/my-pkg
# 参照已有包结构：package.json、tsup.config.ts、tsconfig.json、src/index.ts
# 在根目录 pnpm-workspace.yaml 中已通过 packages/* 通配符自动识别
```

### 创建新 SaaS 应用（脚手架）

```bash
node tooling/scripts/create-app.mjs my-new-app
```

该命令会复制 `apps/admin` 的骨架结构到 `apps/my-new-app`，并替换名称与配置。

### 外部项目消费 @keel/* 包

在外部项目 `.npmrc` 中配置：

```ini
@keel:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_PACKAGES_TOKEN}
```

然后正常安装：

```bash
pnpm add @keel/http @keel/auth @keel/ui @keel/theme @keel/i18n @keel/utils @keel/types
```

## 环境变量

通过 `.env.{development,staging,production}` 管理，关键变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_BASE_URL` | API 地址 | `http://localhost:3000` |
| `VITE_USE_MOCK` | 是否启用 Mock | `true`（仅 dev） |
| `VITE_AUTH_STORAGE` | Token 存储方式 | `localStorage` |
| `VITE_TENANT_HEADER` | 租户头名称 | `X-Tenant-Id` |
| `VITE_PUBLIC_PATH` | 部署 publicPath | `/` |

## 部署

### Docker

```bash
# 构建生产镜像
docker build -f docker/Dockerfile --build-arg MODE=production -t keel-admin .

# 本地运行
docker compose -f docker/docker-compose.yml up -d
```

### CI/CD

- PR → 自动触发 `ci.yml`（lint / typecheck / test / build）
- 合并到 main → E2E 测试
- 推送 `v*` tag → 构建 Docker 镜像并发布
- Changesets Version PR 合并 → 自动发布 `@keel/*` 包

## 技术栈

- **框架**: React 18 + TypeScript 5.5
- **构建**: Vite 5 + tsup（packages）
- **UI**: Ant Design 5 + @ant-design/pro-components（薄封装）
- **状态**: Zustand（按域切片）
- **路由**: React Router v6（动态路由）
- **HTTP**: Axios（含单飞刷新、防重复提交）
- **国际化**: react-i18next（命名空间懒加载）
- **测试**: Vitest + fast-check + Playwright
- **规范**: ESLint + Prettier + Commitlint + Husky
- **CI/CD**: GitHub Actions + Turborepo + Docker

## License

Private — Internal use only.
