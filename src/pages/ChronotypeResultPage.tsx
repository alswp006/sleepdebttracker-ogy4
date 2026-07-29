import { Top, Paragraph, Spacing, ListRow, Button } from '@toss/tds-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/StateView';
import { getChronotype } from '@/lib/storage';
import type { ChronotypeResult, ChronotypeType, RouteState } from '@/lib/types';

const TYPE_LABEL: Record<ChronotypeType, string> = {
  MORNING: '아침형',
  EVENING: '저녁형',
  INTERMEDIATE: '중간형',
};

const TYPE_DESCRIPTION: Record<ChronotypeType, string> = {
  MORNING: '아침에 컨디션이 가장 좋아요',
  EVENING: '밤에 집중력이 높아요',
  INTERMEDIATE: '낮과 밤 모두 무난하게 컨디션을 유지해요',
};

const TYPE_BEDTIME_RANGE: Record<ChronotypeType, string> = {
  MORNING: '21:30~23:00',
  EVENING: '00:00~01:30',
  INTERMEDIATE: '22:30~00:00',
};

export default function ChronotypeResultPage() {
  const navigate = useNavigate();
  const state = useLocation().state as RouteState['/chronotype/result'];
  const result: ChronotypeResult | null = state?.result ?? getChronotype();

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>진단 결과</Top.TitleParagraph>} />}>
      <Spacing size={16} />
      {result ? (
        <div data-testid="chronotype-card">
          <SummaryHero
            label="내 수면 유형"
            value={<Paragraph.Text typography="t2">{TYPE_LABEL[result.type]}</Paragraph.Text>}
            caption={`점수 ${result.score}점`}
          />
          <Spacing size={16} />
          <Card>
            <ListRow
              contents={
                <ListRow.Texts type="2RowTypeA" top="특징" bottom={TYPE_DESCRIPTION[result.type]} />
              }
            />
            <ListRow
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top="권장 취침시간대"
                  bottom={TYPE_BEDTIME_RANGE[result.type]}
                />
              }
            />
          </Card>
          <Spacing size={24} />
          <Button variant="weak" display="block" onClick={() => navigate('/chronotype')}>
            다시 진단
          </Button>
        </div>
      ) : (
        <EmptyState
          title="진단 결과가 없어요"
          description="수면 유형 진단을 먼저 진행해 주세요"
          action={
            <Button variant="weak" display="block" onClick={() => navigate('/chronotype')}>
              진단하러 가기
            </Button>
          }
        />
      )}
    </ScreenScaffold>
  );
}
