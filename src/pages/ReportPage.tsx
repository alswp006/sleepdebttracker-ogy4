import { useEffect, useState } from 'react';
import { Top, Paragraph, Spacing, Button, Toast, Asset } from '@toss/tds-mobile';
import { generateHapticFeedback, loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { Card } from '@/components/Card';
import { MiniBar } from '@/components/MiniBar';
import { EmptyState, LoadingState } from '@/components/StateView';
import { getRecords, getSettings } from '@/lib/storage';
import { getWeekReport } from '@/lib/derive';
import { formatMinutes } from '@/lib/calc';
import type { SleepRecord, UserSettings } from '@/lib/types';

const AD_SLOT_ID = 'week-report-unlock';
const MIN_RECORDS_FOR_REPORT = 3;
const WEEKDAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const TAB_ITEMS = [
  { label: '홈', path: '/' },
  { label: '리포트', path: '/report' },
  { label: '플랜', path: '/plan' },
  { label: '유형', path: '/chronotype' },
  { label: '설정', path: '/settings' },
];

type ReportData = {
  records: SleepRecord[];
  settings: UserSettings;
};

function weekdayName(dateStr: string): string {
  return WEEKDAY_NAMES[new Date(dateStr).getDay()];
}

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function ReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [isShowingAd, setIsShowingAd] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [adFailed, setAdFailed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData({ records: getRecords(), settings: getSettings() });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const eligible = !!data && data.records.length >= MIN_RECORDS_FOR_REPORT;

  useEffect(() => {
    if (!eligible) return;
    try {
      loadFullScreenAd({
        slotId: AD_SLOT_ID,
        onEvent: () => setAdLoaded(true),
        onError: () => setAdLoaded(true),
      } as Parameters<typeof loadFullScreenAd>[0]);
    } catch {
      setAdLoaded(true);
    }
  }, [eligible]);

  const top = <Top title={<Top.TitleParagraph>주간 리포트</Top.TitleParagraph>} />;

  if (!data) {
    return (
      <ScreenScaffold top={top} bottom={<FloatingTabBar items={TAB_ITEMS} />}>
        <LoadingState rows={4} testId="report-loading" />
      </ScreenScaffold>
    );
  }

  const { records, settings } = data;

  if (records.length === 0) {
    return (
      <ScreenScaffold top={top} bottom={<FloatingTabBar items={TAB_ITEMS} />}>
        <EmptyState
          icon={<Asset.ContentIcon name="moon" alt="리포트 없음" />}
          title="이번 주 기록이 없어요"
          description="수면을 기록하면 리포트를 볼 수 있어요"
        />
      </ScreenScaffold>
    );
  }

  if (records.length < MIN_RECORDS_FOR_REPORT) {
    return (
      <ScreenScaffold top={top} bottom={<FloatingTabBar items={TAB_ITEMS} />}>
        <Paragraph.Text typography="st3" color="secondary">
          기록이 부족해요. 최소 3일 기록해주세요
        </Paragraph.Text>
      </ScreenScaffold>
    );
  }

  const currentDate = new Date().toISOString().slice(0, 10);
  const weekReport = getWeekReport(records, currentDate);

  const handleWatch = () => {
    fireHaptic('tickWeak');
    setIsShowingAd(true);
    setAdFailed(false);
    try {
      showFullScreenAd({
        slotId: AD_SLOT_ID,
        onEvent: () => {
          setIsShowingAd(false);
          setUnlocked(true);
        },
        onError: () => {
          setIsShowingAd(false);
          setAdFailed(true);
        },
      } as Parameters<typeof showFullScreenAd>[0]);
    } catch {
      setIsShowingAd(false);
      setAdFailed(true);
    }
  };

  return (
    <ScreenScaffold top={top} bottom={<FloatingTabBar items={TAB_ITEMS} />}>
      {!unlocked ? (
        <>
          <Paragraph.Text typography="st3" color="secondary">
            광고를 보면 이번 주 리포트를 확인할 수 있어요
          </Paragraph.Text>
          <Spacing size={16} />
          <Button
            variant="fill"
            display="block"
            onClick={handleWatch}
            disabled={isShowingAd || !adLoaded}
            aria-label="리포트 보기"
          >
            {isShowingAd ? '광고 재생 중...' : '리포트 보기'}
          </Button>
        </>
      ) : (
        <>
          <Card testId="week-summary-card">
            <Paragraph.Text typography="t3">
              주간 총 부채 {formatMinutes(weekReport.totalDebtMinutes)}
            </Paragraph.Text>
            <Spacing size={16} />
            <Paragraph.Text typography="st11">평균 수면</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="t5">{formatMinutes(weekReport.averageSleepMinutes)}</Paragraph.Text>
            <Spacing size={12} />
            <Paragraph.Text typography="st11">최다 부족 요일</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="t5">
              {weekReport.maxDebtDate ? weekdayName(weekReport.maxDebtDate) : '없음'}
            </Paragraph.Text>
          </Card>
          <Spacing size={16} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {weekReport.sleepMinutes.map((minutes, i) => (
              <MiniBar key={i} testId="week-bars" ratio={minutes / settings.targetMinutes} />
            ))}
          </div>
        </>
      )}

      <Toast
        open={adFailed}
        text="광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"
        position="bottom"
        onClose={() => setAdFailed(false)}
      />
    </ScreenScaffold>
  );
}
