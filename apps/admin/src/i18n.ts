/**
 * i18n bootstrap — initializes the global i18next instance that
 * `useTranslation()` hooks bind to throughout the app.
 *
 * Strategy:
 *   - Inline the `common` namespace so the first paint has translations
 *     without a network round-trip (Requirement 8.2).
 *   - Register `initReactI18next` so `useTranslation()` returns a real,
 *     initialized `i18n` object rather than a no-op stub.
 *   - Language detection order: query-string → localStorage → navigator
 *     (Requirement 8.1).
 *
 * Import this module **before** rendering the React tree (i.e. at the
 * top of main.tsx) so the `i18n` instance is ready synchronously.
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ---------------------------------------------------------------------------
// Inline common translations (Requirement 8.2 — only `common` is synchronous)
// ---------------------------------------------------------------------------

const zhCNCommon: Record<string, string> = {
  // Breadcrumb
  'breadcrumb.home': '首页',
  // Sider
  'sider.noMenu': '暂无菜单',
  // Header
  'header.tenant.placeholder': '切换租户',
  'header.user.guest': '访客',
  'header.user.profile': '个人信息',
  'header.user.logout': '退出登录',
  'header.search.placeholder': '搜索菜单、页面…',
  // Auth / Login
  'auth.login.username': '用户名',
  'auth.login.password': '密码',
  'auth.login.remember': '记住我',
  'auth.login.submit': '登录',
  'auth.login.subtitle': '登录以继续',
  'auth.login.usernameRequired': '请输入用户名',
  'auth.login.passwordRequired': '请输入密码',
  'auth.login.error': '登录失败，请检查用户名和密码',
  // Dashboard
  'dashboard.greeting.zh': '你好，{{displayName}}！',
  'dashboard.stats.todayUsers': '今日用户数',
  'dashboard.stats.onlineTenants': '在线租户数',
  'dashboard.stats.pendingTickets': '待处理工单数',
  'dashboard.stats.systemStatus': '系统状态',
  'dashboard.stats.systemStatus.normal': '正常',
  // Menu items
  'menu.dashboard': '仪表盘',
  'menu.system': '系统管理',
  'menu.system.user': '用户管理',
  'menu.system.role': '角色管理',
  'menu.order': '订单管理',
  'menu.order.list': '订单列表',
  'menu.order.detail': '订单详情',
  // Common operations
  'common.operationSuccess': '操作成功',
  'common.success': 'Success',
  'common.error.unknown': '未知错误，请稍后重试',
};

const enUSCommon: Record<string, string> = {
  // Breadcrumb
  'breadcrumb.home': 'Home',
  // Sider
  'sider.noMenu': 'No menu',
  // Header
  'header.tenant.placeholder': 'Tenant',
  'header.user.guest': 'Guest',
  'header.user.profile': 'Profile',
  'header.user.logout': 'Sign out',
  'header.search.placeholder': 'Search…',
  // Auth / Login
  'auth.login.username': 'Username',
  'auth.login.password': 'Password',
  'auth.login.remember': 'Remember me',
  'auth.login.submit': 'Sign in',
  'auth.login.subtitle': 'Sign in to continue',
  'auth.login.usernameRequired': 'Please enter your username',
  'auth.login.passwordRequired': 'Please enter your password',
  'auth.login.error': 'Login failed. Please check your credentials.',
  // Dashboard
  'dashboard.greeting.en': 'Hello, {{displayName}}!',
  'dashboard.stats.todayUsers': "Today's Users",
  'dashboard.stats.onlineTenants': 'Online Tenants',
  'dashboard.stats.pendingTickets': 'Pending Tickets',
  'dashboard.stats.systemStatus': 'System Status',
  'dashboard.stats.systemStatus.normal': 'Normal',
  'dashboard.stats.systemStatus.normal.en': 'Normal',
  // Menu items
  'menu.dashboard': 'Dashboard',
  'menu.system': 'System',
  'menu.system.user': 'Users',
  'menu.system.role': 'Roles',
  'menu.order': 'Orders',
  'menu.order.list': 'Order List',
  'menu.order.detail': 'Order Detail',
  // Common operations
  'common.operationSuccess': '操作成功',
  'common.success': 'Success',
  'common.error.unknown': 'An unknown error occurred',
};

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------
//
// `initImmediate: false` + inline resources (no backend) means init
// completes synchronously. By the time this module finishes evaluating,
// i18next.changeLanguage is a real function and useTranslation() returns
// a populated `i18n` object.

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Supported locales
    supportedLngs: ['zh-CN', 'en-US'],
    fallbackLng: 'zh-CN',
    // Detection order: query → localStorage → navigator (Req 8.1)
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'keel_locale',
    },
    // Inline common namespace — no backend needed for the first paint
    defaultNS: 'common',
    ns: ['common'],
    resources: {
      'zh-CN': { common: zhCNCommon },
      'en-US': { common: enUSCommon },
    },
    partialBundledLanguages: true,
    react: { useSuspense: false },
    interpolation: {
      // React already escapes by default
      escapeValue: false,
    },
    debug: false,
    initImmediate: false,
  });

export default i18next;
