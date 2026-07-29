import { useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Top, Paragraph, Spacing, Chip } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SubmitFooter } from '../components/BottomCTA';
import { getSettings, writeSettings } from '../lib/storage';
import { TARGET_MIN, TARGET_MAX } from '../lib/types';

// 목업 대비: 그룹 컨테이너 Chip을 개별 토글 아이템으로 사용 (mocks.ts의 Chip이 selected/onClick 토글로 동작)
const ChipToggle = Chip as unknown as ComponentType<{
  selected?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}>;

const TARGET_HOURS = [6, 7, 8, 9];

export function validateTargetMinutes(
  minutes: number,
): { ok: true } | { ok: false; message: string } {
  if (minutes < TARGET_MIN || minutes > TARGET_MAX) {
    return { ok: false, message: '목표는 4~12시간 사이로 설정해주세요' };
  }
  return { ok: true };
}

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);

  const handleSelect = (hours: number) => {
    fireHaptic('tickWeak');
    setSelectedMinutes(hours * 60);
  };

  const handleComplete = () => {
    if (selectedMinutes === null) return;
    const result = validateTargetMinutes(selectedMinutes);
    if (!result.ok) return;

    fireHaptic('success');
    writeSettings({ ...getSettings(), targetMinutes: selectedMinutes, onboarded: true });
    navigate('/', { replace: true });
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>목표 수면 설정</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter label="완료" onClick={handleComplete} disabled={selectedMinutes === null} />
      }
    >
      <Paragraph.Text typography="t5">하루 목표 수면 시간을 골라주세요</Paragraph.Text>
      <Spacing size={16} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TARGET_HOURS.map((hours) => (
          <div
            key={hours}
            data-testid="target-chip"
            style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
          >
            <ChipToggle
              selected={selectedMinutes === hours * 60}
              onClick={() => handleSelect(hours)}
            >
              {hours}시간
            </ChipToggle>
          </div>
        ))}
      </div>
    </ScreenScaffold>
  );
}
