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
 *   - shows a submit-error message via AntD's static `App.useApp()`
 *     (theme-aware notification surface)
 *   - navigates to `result.redirectTo` on success
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

import { useState } from 'react';
import {
  App as AntApp,
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

import { runLoginFlow, useLoginDeps } from '../../auth/index.js';

const { Title, Text } = Typography;

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
  const { message } = AntApp.useApp();

  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: LoginFormValues): Promise<void> => {
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
      const redirect = pickRedirect(
        searchParams.get('redirect'),
        result.redirectTo,
      );
      // `replace` so the login page is removed from the back stack —
      // pressing "back" after authenticating should not bring the user
      // back to the form.
      navigate(redirect, { replace: true });
    } catch (err) {
      // Surface the most useful message we can. `BizError` from
      // `@keel/http` exposes the backend-localised message; everything
      // else falls back to a generic translation.
      const fallback = t('auth.login.error', {
        defaultValue: 'Login failed. Please check your credentials.',
      });
      const text =
        err instanceof Error && err.message ? err.message : fallback;
      // `message.error` is the AntD-themed toast; works under the
      // `<AntApp />` wrapper installed by the providers tree.
      message.error(text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Subtle wash so the card's frosted-glass styling reads.
        background:
          'linear-gradient(135deg, rgba(10,132,255,0.08), rgba(94,200,250,0.06))',
        padding: 16,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 400 }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            {t('auth.login.title', { defaultValue: 'Welcome back' })}
          </Title>
          <Text type="secondary">
            {t('auth.login.subtitle', {
              defaultValue: 'Sign in to continue to Keel Admin',
            })}
          </Text>
        </div>

        <Form<LoginFormValues>
          name="login"
          layout="vertical"
          requiredMark={false}
          initialValues={{ remember: true }}
          onFinish={onFinish}
          disabled={submitting}
        >
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
            <Input
              autoComplete="username"
              prefix={<UserOutlined />}
              placeholder={t('auth.login.username', {
                defaultValue: 'Username',
              })}
              size="large"
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
            <Input.Password
              autoComplete="current-password"
              prefix={<LockOutlined />}
              placeholder={t('auth.login.password', {
                defaultValue: 'Password',
              })}
              size="large"
            />
          </Form.Item>

          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox>
              {t('auth.login.remember', { defaultValue: 'Remember me' })}
            </Checkbox>
          </Form.Item>

          <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={submitting}
              block
            >
              {t('auth.login.submit', { defaultValue: 'Sign in' })}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
