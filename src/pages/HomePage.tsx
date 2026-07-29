import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Top, Paragraph, Spacing, Chip, Button, Asset } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { Card } from '@/components/Card';
import { Sparkline } from '@/components/Sparkline';
import { EmptyState, LoadingState } from '@/components/StateView';
import { AdSlot } from '@/components/AdSlot';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { getRecords, getSettings, getStreak } from '@/lib/storage';
import { getCumulativeDebt, estimatePayoffDays, formatMinutes } from '@/lib/calc';
import type { SleepRecord, UserSettings, Streak } from '@/lib/types';

// 목업 대비: 단일 뱃지 표시용으로 사용 (OnboardingPage의 ChipToggle과 동일한 캐스팅 패턴)
const ChipLabel = Chip as unknown as ComponentType<{ children?: ReactNode }>;

const TAB_ITEMS = [
  { label: '홈', path: '/' },
  { label: '리포트', path: '/report' },
  { label: '플랜', path: '/plan' },
  { label: '유형', path: '/chronotype' },
  { label: '설정', path: '/settings' },
];

type HomeData = {
  records: SleepRecord[];
  settings: UserSettings;
  streak: Streak;
};

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

function getLast7DaysDebt(records: SleepRecord[], currentDate: string): number[] {
  const byDate = new Map(records.map((r) => [r.date, r.debtMinutes]));
  const result: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    result.push(byDate.get(date) ?? 0);
  }
  return result;
}

export default function HomePage() {
  const navigate = useNavigate();
  const currentDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData({ records: getRecords(), settings: getSettings(), streak: getStreak() });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleRecordClick = () => {
    fireHaptic('tickWeak');
    navigate('/record', { state: { date: currentDate } });
  };

  const top = <Top title={<Top.TitleParagraph>수면 부채</Top.TitleParagraph>} />;

  if (!data) {
    return (
      <ScreenScaffold top={top}>
        <LoadingState rows={4} testId="home-loading" />
      </ScreenScaffold>
    );
  }

  const { records, settings, streak } = data;
  const hasTodayRecord = records.some((record) => record.date === currentDate);

  if (records.length === 0) {
    return (
      <ScreenScaffold top={top} bottom={<FloatingTabBar items={TAB_ITEMS} />}>
        <EmptyState
          icon={<Asset.ContentIcon name="moon" alt="기록 없음" />}
          title="첫 수면을 기록해보세요"
          description="취침·기상 시간만 입력하면 돼요"
          action={
            <Button variant="weak" onClick={handleRecordClick}>
              수면 기록하기
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  const cumDebt = getCumulativeDebt(records, currentDate);
  const payoffDays = estimatePayoffDays(cumDebt, records, settings);
  const trendData = getLast7DaysDebt(records, currentDate);

  return (
    <ScreenScaffold top={top} bottom={<FloatingTabBar items={TAB_ITEMS} />}>
      <SummaryHero
        testId="debt-hero"
        label="누적 수면 부채"
        value={<Paragraph.Text typography="t2">{formatMinutes(cumDebt)}</Paragraph.Text>}
        caption={
          cumDebt > 0 ? `약 ${payoffDays}일 후 상환 완료` : <ChipLabel>수면 부채 없음</ChipLabel>
        }
      />

      <Spacing size={16} />

      <div data-testid="streak-chip">
        {streak.current > 0 ? (
          <ChipLabel>🔥 {streak.current}일 연속</ChipLabel>
        ) : (
          <Paragraph.Text typography="t6">오늘부터 시작해보세요</Paragraph.Text>
        )}
      </div>

      <Spacing size={16} />

      <Card testId="payoff-card">
        <Paragraph.Text typography="st11">상환 예상</Paragraph.Text>
        <Spacing size={4} />
        <Paragraph.Text typography="t5">
          {payoffDays > 0 ? `약 ${payoffDays}일 후` : '이미 상환 완료'}
        </Paragraph.Text>
      </Card>

      <Spacing size={24} />

      <Paragraph.Text typography="t4">최근 7일 추이</Paragraph.Text>
      <Spacing size={8} />
      <Sparkline data={trendData} testId="trend-sparkline" />

      {!hasTodayRecord ? (
        <>
          <Spacing size={24} />
          <Button variant="fill" display="block" onClick={handleRecordClick}>
            오늘 수면 기록하기
          </Button>
        </>
      ) : null}

      <Spacing size={24} />

      <Card>
        <AdSlot adGroupId="home-bottom" />
      </Card>
    </ScreenScaffold>
  );
}
