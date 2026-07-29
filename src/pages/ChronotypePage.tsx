import { useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Top, Paragraph, Spacing, Chip } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { diagnoseChronotype } from '@/lib/derive';
import { writeChronotype } from '@/lib/storage';
import type { RouteState } from '@/lib/types';

// 목업 대비: 그룹 컨테이너 Chip을 개별 토글 아이템으로 사용 (mocks.ts의 Chip이 selected/onClick 토글로 동작)
const ChipToggle = Chip as unknown as ComponentType<{
  selected?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}>;

const SCALE_VALUES = [1, 2, 3, 4, 5];

const QUESTIONS = [
  '밤 12시가 넘어도 잠이 잘 오지 않는 날이 많나요?',
  '아침에 일어나기가 유난히 힘든가요?',
  '저녁 늦게 집중이 더 잘 되나요?',
  '주말엔 평일보다 훨씬 늦게 일어나나요?',
  '낮보다 밤에 활동하는 게 더 편한가요?',
];

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function ChronotypePage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Array<number | null>>(Array(QUESTIONS.length).fill(null));

  const allAnswered = answers.every((answer) => answer !== null);

  const handleSelect = (questionIndex: number, value: number) => {
    fireHaptic('tickWeak');
    setAnswers((prev) => prev.map((answer, i) => (i === questionIndex ? value : answer)));
  };

  const handleSubmit = () => {
    if (!allAnswered) return;
    const result = diagnoseChronotype(answers as number[]);
    writeChronotype(result);
    navigate('/chronotype/result', { state: { result } as RouteState['/chronotype/result'] });
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>수면 유형 진단</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="결과 보기" onClick={handleSubmit} disabled={!allAnswered} />}
    >
      <Paragraph.Text typography="st3" color="secondary">
        각 문항에 1~5점으로 답해주세요
      </Paragraph.Text>
      <Spacing size={16} />
      {QUESTIONS.map((question, questionIndex) => (
        <div key={question} data-testid="chronotype-question">
          <Paragraph.Text typography="t5">{question}</Paragraph.Text>
          <Spacing size={8} />
          <div style={{ display: 'flex', gap: 8 }}>
            {SCALE_VALUES.map((value) => (
              <div
                key={value}
                data-testid="chronotype-chip"
                style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
              >
                <ChipToggle
                  selected={answers[questionIndex] === value}
                  onClick={() => handleSelect(questionIndex, value)}
                >
                  {value}
                </ChipToggle>
              </div>
            ))}
          </div>
          <Spacing size={16} />
        </div>
      ))}
    </ScreenScaffold>
  );
}
