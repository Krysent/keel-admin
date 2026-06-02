# @keel/i18n

i18n factory for keel-admin. Built on `react-i18next` with namespace lazy-loading, language detection, offline fallback, and coordinated switching (i18next + dayjs + AntD locale).

## Installation

```bash
pnpm add @keel/i18n
# peer dependencies
pnpm add react react-i18next i18next
```

## API

### `createI18n(options: CreateI18nOptions): KeelI18n`

Factory that initializes an i18next instance with HTTP backend, language detection, and namespace lazy-load support.

```ts
import { createI18n } from '@keel/i18n';

const i18n = createI18n({
  fallbackLng: 'zh-CN',
  supportedLngs: ['zh-CN', 'en-US'],
  ns: ['common'],             // sync-loaded on init
  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json',
  },
});
```

### `useT(namespace?: string)`

Scoped translation hook. Loads namespace on first use.

```tsx
const t = useT('order');
return <h1>{t('title')}</h1>;
```

### Language Switching

```ts
// Coordinates i18next + dayjs + AntD ConfigProvider
await i18n.changeLanguage('en-US');
```

No page reload required. Detector priority: `query > localStorage > navigator`.

### Offline Fallback

If HTTP backend fails to load a namespace, the system falls back to `localStorage`-cached translations from the last successful load.

## Detection Order

```
1. URL query param (?lng=en-US)
2. localStorage ('i18nextLng')
3. navigator.language
```

Exported as `DEFAULT_DETECTION_ORDER` for reference.

## Namespace Strategy

| Namespace | Location | Loading |
|-----------|----------|---------|
| `common` | `@keel/i18n` built-in | Sync (first screen) |
| `<module>` | `apps/admin/src/locales/{lang}/{module}.json` | Lazy (on route enter) |

## Exports

| Export | Description |
|--------|-------------|
| `createI18n` | Factory to create configured i18next instance |
| `DEFAULT_DETECTION_ORDER` | Language detection priority array |
| `CreateI18nOptions` | Options type |
| `KeelI18n` | Return type of `createI18n` |

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
