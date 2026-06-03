/**
 * Login page — minimal AntD form wrapping `runLoginFlow`.
 *
 * Implements the page-level half of task 9.4:
 *
 *   > pages/login：表单 + 提交 → 调 `/auth/login` → setTokens → 拉用户
 *   >   /菜单/权限 → 跳转首页
 *
 * The orchestration itself lives in `auth/login-flow.ts`; this file
 * is the thin React shell that:
 *
 *   - renders the form (username / password / remember checkbox)
 *   - pulls deps from `<AuthProvider />` via `useLoginDeps()`
 *   - shows a submit-error as an inline AntD `Alert` (type="error")
 *     above the form (Requirement 21.5), cleared on the next submission
 *   - navigates to `result.redirectTo` on success with `{ replace: true }`
 *     (Requirement 21.6)
 *   - honours an optional `?redirect=/somewhere` query param so the
 *     "deep link kicks you to /login" flow returns the user back to
 *     where they started after authentication
 *
 * Strings are wired through `react-i18next` with explicit
 * `defaultValue` fallbacks so the page renders correctly even when
 * the `auth` namespace hasn't been loaded yet (task 6.1's lazy-load
 * contract). The defaultValues are EN; ZH translations land with the
 * `auth` namespace bundle.
 */

import { useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Typography,
} from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { runLoginFlow, useLoginDeps } from '../../auth/index';

// ---------------------------------------------------------------------------
// "Remember me" localStorage helpers (Requirement 21.10)
// ---------------------------------------------------------------------------

/** The key used to persist the remembered username in localStorage. */
const REMEMBER_ME_KEY = 'keel_remembered_username';

/** Number of milliseconds in 30 days. */
const REMEMBER_ME_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface RememberedEntry {
  value: string;
  expiry: number;
}

/**
 * Persist `username` in localStorage under `REMEMBER_ME_KEY` with a
 * 30-day expiry timestamp.  Silently ignores storage errors (e.g. when
 * localStorage is blocked in private-browsing mode).
 */
function setRememberedUsername(username: string): void {
  try {
    const entry: RememberedEntry = {
      value: username,
      expiry: Date.now() + REMEMBER_ME_TTL_MS,
    };
    localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify(entry));
  } catch {
    // Ignore — storage quota exceeded or access denied.
  }
}

/**
 * Remove the remembered-username entry from localStorage.  Safe to
 * call even when the key is absent.
 */
function clearRememberedUsername(): void {
  try {
    localStorage.removeItem(REMEMBER_ME_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Read the remembered username.
 *
 * Returns the stored username string if the key exists and has not yet
 * expired; `null` in all other cases (missing key, malformed JSON,
 * expired entry, storage access denied).  Expired entries are removed
 * as a side-effect.
 */
function getRememberedUsername(): string | null {
  try {
    const raw = localStorage.getItem(REMEMBER_ME_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as RememberedEntry;
    if (typeof entry.value !== 'string' || typeof entry.expiry !== 'number') {
      return null;
    }
    if (Date.now() > entry.expiry) {
      // Expired — clean up eagerly.
      localStorage.removeItem(REMEMBER_ME_KEY);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

const { Title, Text } = Typography;

/**
 * Placeholder brand logo SVG — displayed in the Logo area above the
 * login card title.  A real project would replace this with an actual
 * asset import.
 */
function BrandLogoSVG(): JSX.Element {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer rounded square */}
      <rect width="48" height="48" rx="12" fill="#0A84FF" />
      {/* Letter "K" shape */}
      <path
        d="M14 12H19V22L28 12H34L24 23L34 36H28L19 25V36H14V12Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Returns the current inner width of the browser window, updating
 * on resize so callers re-render when the breakpoint changes.
 */
function useWindowWidth(): number {
  const [width, setWidth] = useState<number>(() => window.innerWidth);

  useEffect(() => {
    const handler = (): void => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return width;
}

interface LoginFormValues {
  username: string;
  password: string;
  remember?: boolean;
}

/**
 * Decide where to navigate after a successful login.
 *
 * - prefer `?redirect=...` from the URL (set by the protected-route
 *   guard when it bounces an unauthenticated user here)
 * - fall back to the orchestration result's `redirectTo`
 * - the latter currently defaults to `/`; the bootstrap layer can
 *   refine it once the menu is hydrated
 */
function pickRedirect(
  searchParam: string | null,
  flowRedirect: string,
): string {
  if (!searchParam) return flowRedirect;
  // Reject absolute URLs as a defence-in-depth against open-redirect
  // payloads in the query string. Only accept relative paths.
  if (/^https?:\/\//i.test(searchParam)) return flowRedirect;
  if (!searchParam.startsWith('/')) return flowRedirect;
  return searchParam;
}

export default function LoginPage(): JSX.Element {
  const deps = useLoginDeps();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const [form] = Form.useForm<LoginFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const windowWidth = useWindowWidth();

  // Requirement 21.10: on page init, restore remembered username
  useEffect(() => {
    const remembered = getRememberedUsername();
    if (remembered !== null) {
      form.setFieldsValue({ username: remembered, remember: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFinish = async (values: LoginFormValues): Promise<void> => {
    // Requirement 21.5: clear previous Alert when a new submission starts
    setLoginError(null);
    setSubmitting(true);
    try {
      const result = await runLoginFlow(
        {
          username: values.username,
          password: values.password,
          remember: values.remember ?? false,
        },
        deps,
      );

      // Requirement 21.10: persist or clear remembered username based on the
      // "remember me" checkbox state.
      if (values.remember) {
        setRememberedUsername(values.username);
      } else {
        clearRememberedUsername();
      }

      const redirect = pickRedirect(
        searchParams.get('redirect'),
        result.redirectTo,
      );
      // `replace` so the login page is removed from the back stack —
      // pressing "back" after authenticating should not bring the user
      // back to the form.
      // Requirement 21.6: navigate(target, { replace: true })
      navigate(redirect, { replace: true });
    } catch (err) {
      // Requirement 21.5: Surface the most useful message we can. `BizError` from
      // `@keel/http` exposes the backend-localised `message` field; everything
      // else falls back to the i18n key `auth.login.error`.
      const fallback = t('auth.login.error', {
        defaultValue: 'Login failed. Please check your credentials.',
      });
      const text =
        err instanceof Error && err.message ? err.message : fallback;
      // Show inline Alert instead of toast (Requirement 21.5)
      setLoginError(text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Subtle wash so the card's frosted-glass styling reads.
        // Requirement 21.7: linear-gradient(135deg, rgba(10,132,255,0.08), rgba(94,200,250,0.06))
        background:
          'linear-gradient(135deg, rgba(10,132,255,0.08), rgba(94,200,250,0.06))',
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      {/*
       * Requirement 21.8: frosted-glass card with responsive width.
       *   - backdrop-filter: blur(20px) saturate(180%)
       *   - borderRadius ≥ 16px
       *   - width: 400px fixed when viewport ≥ 768px; calc(100vw - 32px) when < 768px
       */}
      <Card
        bordered={false}
        style={{
          width: windowWidth >= 768 ? 400 : 'calc(100vw - 32px)',
          borderRadius: 20,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          // Subtle card background so the glass effect is visible
          background: 'rgba(255, 255, 255, 0.72)',
          boxShadow:
            '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 0 rgba(255, 255, 255, 0.6) inset',
        }}
      >
        {/* Requirement 21.1: Brand Logo area — height 80px, SVG icon 48px, "Keel Admin" text, horizontally centred */}
        <div
          style={{
            height: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <BrandLogoSVG />
          <Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
            Keel Admin
          </Title>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Text type="secondary">
            {t('auth.login.subtitle', {
              defaultValue: 'Sign in to continue',
            })}
          </Text>
        </div>

        <Form<LoginFormValues>
          form={form}
          name="login"
          layout="vertical"
          requiredMark={false}
          initialValues={{ remember: true }}
          onFinish={onFinish}
          disabled={submitting}
        >
          {/* Requirement 21.5: inline Alert above the form on login failure */}
          {loginError !== null && (
            <Form.Item style={{ marginBottom: 16 }}>
              <Alert
                type="error"
                message={loginError}
                showIcon
                closable
                onClose={() => setLoginError(null)}
              />
            </Form.Item>
          )}
          <Form.Item
            name="username"
            label={t('auth.login.username', { defaultValue: 'Username' })}
            rules={[
              {
                required: true,
                message: t('auth.login.usernameRequired', {
                  defaultValue: 'Please enter your username',
                }),
              },
            ]}
          >
            {/* Requirement 21.11: touch target height ≥ 44px on mobile */}
            <Input
              autoComplete="username"
              prefix={<UserOutlined />}
              placeholder={t('auth.login.username', {
                defaultValue: 'Username',
              })}
              size="large"
              style={{ minHeight: 44 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('auth.login.password', { defaultValue: 'Password' })}
            rules={[
              {
                required: true,
                message: t('auth.login.passwordRequired', {
                  defaultValue: 'Please enter your password',
                }),
              },
            ]}
          >
            {/* Requirement 21.11: touch target height ≥ 44px on mobile */}
            <Input.Password
              autoComplete="current-password"
              prefix={<LockOutlined />}
              placeholder={t('auth.login.password', {
                defaultValue: 'Password',
              })}
              size="large"
              style={{ minHeight: 44 }}
              onPressEnter={() => form.submit()}
            />
          </Form.Item>

          {/*
           * Requirement 21.11: Checkbox touch target ≥ 44px × 44px.
           * The container enforces minHeight 44px and vertically centres the
           * checkbox, ensuring the tap area is sufficient on mobile.
           * marginBottom: 8 ensures ≥ 8px vertical spacing above the button row.
           */}
          <Form.Item
            name="remember"
            valuePropName="checked"
            style={{ marginBottom: 8 }}
          >
            <div
              style={{
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Checkbox>
                {t('auth.login.remember', { defaultValue: 'Remember me' })}
              </Checkbox>
            </div>
          </Form.Item>

          {/* Requirement 21.11: touch target height ≥ 44px; marginTop provides ≥ 8px spacing */}
          <Form.Item style={{ marginTop: 8, marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={submitting}
              block
              style={{ minHeight: 44 }}
            >
              {t('auth.login.submit', { defaultValue: 'Sign in' })}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
