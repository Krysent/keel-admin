/**
 * 403 Forbidden — shown when a user lands on a protected route but the
 * `permissionCodes` filter rejects them (Requirement 4.3).
 *
 * Two action affordances:
 *   - "Go home" navigates to `/`
 *   - "Go back" walks the history stack one step back so a user who
 *     followed a stale link doesn't lose their place entirely
 *
 * The visual is AntD's `Result` component. Pages keep the same iOS
 * styling because they render under the same `<ConfigProvider />`
 * tree wired by the bootstrap layer.
 */

import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function Forbidden403(): JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Result
      status="403"
      title="403"
      subTitle={t('exception.403.subTitle', {
        defaultValue: 'Sorry, you are not authorized to access this page.',
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
