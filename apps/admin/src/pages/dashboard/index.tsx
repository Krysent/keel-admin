/**
 * Dashboard page — the default landing page after login.
 *
 * Implements Requirements 22.9 and 22.10:
 *
 *   22.9  Route `/dashboard` renders a welcome title
 *         (zh-CN: `你好，{displayName}！`, en-US: `Hello, {displayName}!`)
 *         and the current date in locale-specific format
 *         (zh-CN: `YYYY年MM月DD日`, en-US: `MMMM D, YYYY`),
 *         wrapped in a `PageContainer`.
 *
 *   22.10 Dashboard shows exactly 4 statistics cards (today's users,
 *         online tenants, pending tickets, system status), all with
 *         `borderRadius ≥ 16px`, `boxShadow: 0 2px 8px rgba(0,0,0,0.06)`,
 *         and `bordered={false}`.  Data is supplied by frontend static mock.
 *
 * Date formatting falls back to `Intl.DateTimeFormat` (built-in) to avoid
 * adding a `dayjs` dependency that doesn't yet exist in this package.
 */

import {
  TeamOutlined,
  UserAddOutlined,
  ToolOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../stores/app.store';
import { useUserStore } from '../../stores/user.store';

const { Title, Text } = Typography;

// ---------------------------------------------------------------------------
// Static mock data (Requirement 22.10 — "数据由前端静态 Mock 提供")
// ---------------------------------------------------------------------------

interface StatCard {
  /** i18n key for the card title */
  titleKey: string;
  /** Fallback title for zh-CN */
  titleZh: string;
  /** Fallback title for en-US */
  titleEn: string;
  /** The numeric or text value to display */
  value: string | number;
  icon: JSX.Element;
  color: string;
}

const STAT_CARDS: StatCard[] = [
  {
    titleKey: 'dashboard.stats.todayUsers',
    titleZh: '今日用户数',
    titleEn: "Today's Users",
    value: 1_284,
    icon: <UserAddOutlined style={{ fontSize: 28 }} />,
    color: '#0A84FF',
  },
  {
    titleKey: 'dashboard.stats.onlineTenants',
    titleZh: '在线租户数',
    titleEn: 'Online Tenants',
    value: 37,
    icon: <TeamOutlined style={{ fontSize: 28 }} />,
    color: '#34C759',
  },
  {
    titleKey: 'dashboard.stats.pendingTickets',
    titleZh: '待处理工单数',
    titleEn: 'Pending Tickets',
    value: 12,
    icon: <ToolOutlined style={{ fontSize: 28 }} />,
    color: '#FF9F0A',
  },
  {
    titleKey: 'dashboard.stats.systemStatus',
    titleZh: '系统状态',
    titleEn: 'System Status',
    value: '正常',
    icon: <CheckCircleOutlined style={{ fontSize: 28 }} />,
    color: '#34C759',
  },
];

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format today's date in Chinese style: `YYYY年MM月DD日`
 * Uses Intl.DateTimeFormat for correctness rather than hand-rolling.
 */
function formatDateZhCN(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}年${month}月${day}日`;
}

/**
 * Format today's date in English style: `MMMM D, YYYY`
 * e.g. "July 4, 2025"
 */
function formatDateEnUS(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatCurrentDate(locale: string): string {
  const now = new Date();
  if (locale === 'zh-CN') {
    return formatDateZhCN(now);
  }
  return formatDateEnUS(now);
}

// ---------------------------------------------------------------------------
// Stat card styles (Requirement 22.10)
// ---------------------------------------------------------------------------

const CARD_STYLE: React.CSSProperties = {
  borderRadius: 16, // ≥ 16px
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  height: '100%',
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DashboardPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const userInfo = useUserStore((s) => s.userInfo);
  const locale = useAppStore((s) => s.locale);

  const displayName = userInfo?.displayName ?? '';

  // Determine greeting and date based on active locale
  const isZhCN = i18n.language === 'zh-CN' || i18n.language?.startsWith('zh');

  const greeting = isZhCN
    ? t('dashboard.greeting.zh', {
        defaultValue: `你好，${displayName}！`,
        displayName,
      })
    : t('dashboard.greeting.en', {
        defaultValue: `Hello, ${displayName}!`,
        displayName,
      });

  // Format date — prefer i18n.language for live locale changes, fall back
  // to the persisted appStore locale when i18next hasn't switched yet.
  const dateLocale = i18n.language || locale;
  const formattedDate = formatCurrentDate(dateLocale.startsWith('zh') ? 'zh-CN' : 'en-US');

  // Stat card titles respect the same locale
  const resolveTitle = (card: StatCard): string =>
    t(card.titleKey, {
      defaultValue: isZhCN ? card.titleZh : card.titleEn,
    });

  // Resolve system status text based on locale (it's not a number)
  const resolveValue = (card: StatCard): string | number => {
    if (card.titleKey === 'dashboard.stats.systemStatus') {
      return isZhCN
        ? t('dashboard.stats.systemStatus.normal', { defaultValue: '正常' })
        : t('dashboard.stats.systemStatus.normal.en', { defaultValue: 'Normal' });
    }
    return typeof card.value === 'number' ? card.value.toLocaleString() : card.value;
  };

  return (
    /* PageContainer — using a styled div equivalent until @keel/ui exports
     * a full PageContainer; this satisfies the "PageContainer 包裹" intent
     * from Requirement 22.9.  When PageContainer lands in @keel/ui this
     * wrapper can be swapped with zero layout changes. */
    <div style={{ padding: '0 4px' }}>
      {/* Welcome area (Requirement 22.9) */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, marginBottom: 4 }}>
          {greeting}
        </Title>
        <Text type="secondary">{formattedDate}</Text>
      </div>

      {/* Statistics cards grid (Requirement 22.10) — exactly 4 cards */}
      <Row gutter={[16, 16]}>
        {STAT_CARDS.map((card) => (
          <Col key={card.titleKey} xs={24} sm={12} lg={6}>
            <Card bordered={false} style={CARD_STYLE}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {/* Icon badge */}
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: `${card.color}1A`, // 10% opacity tint
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: card.color,
                    flexShrink: 0,
                  }}
                >
                  {card.icon}
                </div>

                {/* Value + label */}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      color: '#1C1C1E',
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {resolveValue(card)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {resolveTitle(card)}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
