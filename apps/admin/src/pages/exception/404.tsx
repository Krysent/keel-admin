/**
 * 404 Not Found — terminal fallback for the catch-all `*` route
 * (Requirement 4.8). Mirrors the 403 layout for visual consistency.
 *
 * "Go home" is `replace: true` so the missing URL doesn't sit in the
 * history stack as a back-button trap.
 */

import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function NotFound404(): JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Result
      status="404"
      title="404"
      subTitle={t('exception.404.subTitle', {
        defaultValue: 'Sorry, the page you visited does not exist.',
      })}
      extra={
        <>
          <Button type="primary" onClick={() => navigate('/', { replace: true })}>
            {t('exception.action.home', { defaultValue: 'Back home' })}
          </Button>
          <Button onClick={() => navigate(-1)}>
            {t('exception.action.back', { defaultValue: 'Go back' })}
          </Button>
        </>
      }
    />
  );
}
