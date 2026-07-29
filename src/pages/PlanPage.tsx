import { useEffect, useState } from 'react';
import { Top, Paragraph, Spacing, Button, Toast } from '@toss/tds-mobile';
import { generateHapticFeedback, loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { Card } from '@/components/Card';
import { EmptyState, LoadingState } from '@/components/StateView';
import { getRecords, getSettings } from '@/lib/storage';
import { getCumulativeDebt } from '@/lib/calc';
import { getRecoveryPlan } from '@/lib/derive';
import type { RouteState, SleepRecord, UserSettings } from '@/lib/types';

const AD_SLOT_ID = 'weekend-recovery-plan-unlock';
const WEEKEND_WAKE_MINUTES = 9 * 60; // 09:00

const TAB_ITEMS = [
  { label: '홈', path: '/' },
  { label: '리포트', path: '/report' },
  { label: '플랜', path: '/plan' },
  { label: '유형', path: '/chronotype' },
  { label: '설정', path: '/settings' },
];

type PlanData = {
  records: SleepRecord[];
  settings: UserSettings;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatClock(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function PlanPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PlanData | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [isShowingAd, setIsShowingAd] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [adIncomplete, setAdIncomplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData({ records: getRecords(), settings: getSettings() });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const cumDebt = data ? getCumulativeDebt(data.records, today()) : 0;
  const eligible = !!data && data.records.length > 0 && cumDebt > 0;

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

  const top = <Top title={<Top.TitleParagraph>주말 회복 플랜</Top.TitleParagraph>} />;
  const bottom = <FloatingTabBar items={TAB_ITEMS} />;

  if (!data) {
    return (
      <ScreenScaffold top={top} bottom={bottom}>
        <LoadingState rows={4} testId="plan-loading" />
      </ScreenScaffold>
    );
  }

  if (data.records.length === 0) {
    return (
      <ScreenScaffold top={top} bottom={bottom}>
        <EmptyState
          title="먼저 수면을 기록해주세요"
          description="수면을 기록하면 주말 회복 플랜을 볼 수 있어요"
          action={
            <Button
              variant="weak"
              onClick={() => navigate('/record', { state: { date: today() } as RouteState['/record'] })}
            >
              수면 기록하러 가기
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  if (cumDebt <= 0) {
    return (
      <ScreenScaffold top={top} bottom={bottom}>
        <Paragraph.Text typography="st3" color="secondary">
          회복이 필요 없어요. 지금 리듬을 유지하세요
        </Paragraph.Text>
      </ScreenScaffold>
    );
  }

  const plan = getRecoveryPlan(cumDebt, data.settings.targetMinutes)!;
  const bedTime = formatClock(WEEKEND_WAKE_MINUTES - plan.recommendedSaturdayMinutes);
  const wakeTime = formatClock(WEEKEND_WAKE_MINUTES);
  const hours = Math.round(plan.recommendedSaturdayMinutes / 60);

  const handleWatch = () => {
    fireHaptic('tickWeak');
    setIsShowingAd(true);
    setAdIncomplete(false);
    try {
      showFullScreenAd({
        slotId: AD_SLOT_ID,
        onEvent: (e: { type?: string }) => {
          setIsShowingAd(false);
          if (e?.type === 'rewarded') {
            setUnlocked(true);
          } else {
            setAdIncomplete(true);
          }
        },
        onError: () => {
          setIsShowingAd(false);
          setAdIncomplete(true);
        },
      } as Parameters<typeof showFullScreenAd>[0]);
    } catch {
      setIsShowingAd(false);
      setAdIncomplete(true);
    }
  };

  return (
    <ScreenScaffold top={top} bottom={bottom}>
      {!unlocked ? (
        <>
          <Paragraph.Text typography="st3" color="secondary">
            광고를 보면 주말 회복 플랜을 확인할 수 있어요
          </Paragraph.Text>
          <Spacing size={16} />
          <Button
            variant="fill"
            display="block"
            onClick={handleWatch}
            disabled={isShowingAd || !adLoaded}
          >
            {isShowingAd ? '광고 재생 중...' : '회복 플랜 보기'}
          </Button>
        </>
      ) : (
        <>
          {(['토요일', '일요일'] as const).map((weekday) => (
            <div key={weekday} data-testid="plan-card">
              <Card>
                <Paragraph.Text typography="t5">{`${weekday} 권장`}</Paragraph.Text>
                <Spacing size={4} />
                <Paragraph.Text typography="st11" color="secondary">
                  {`취침 ${bedTime} · 기상 ${wakeTime}`}
                </Paragraph.Text>
                <Spacing size={8} />
                <Paragraph.Text typography="t3">{`${hours}시간 · 추가 +${plan.additionalMinutesNeeded}분`}</Paragraph.Text>
              </Card>
              <Spacing size={12} />
            </div>
          ))}
        </>
      )}

      <Toast
        open={adIncomplete}
        text="광고 시청을 완료해야 플랜을 볼 수 있어요"
        position="bottom"
        onClose={() => setAdIncomplete(false)}
      />
    </ScreenScaffold>
  );
}
