import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Top, Paragraph, Spacing, ChipItem, Toast } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SubmitFooter } from '../components/BottomCTA';
import { getSettings, writeSettings } from '../lib/storage';
import { TARGET_MIN, TARGET_MAX } from '../lib/types';

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
  const [toast, setToast] = useState({ open: false, text: '' });

  const handleSelect = (hours: number) => {
    fireHaptic('tickWeak');
    setSelectedMinutes(hours * 60);
  };

  const handleComplete = () => {
    if (selectedMinutes === null) return;
    const validation = validateTargetMinutes(selectedMinutes);
    if (!validation.ok) return;

    fireHaptic('success');
    const result = writeSettings({ ...getSettings(), targetMinutes: selectedMinutes, onboarded: true });
    if (!result.ok) {
      setToast({ open: true, text: '저장 공간이 부족해요' });
      return;
    }
    console.log('DEBUG isMock', typeof (navigate as any).mock, (navigate as any).name);
    navigate('/', { replace: true });
    console.log('DEBUG after navigate call');
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
            <ChipItem
              selected={selectedMinutes === hours * 60}
              onClick={() => handleSelect(hours)}
            >
              {hours}시간
            </ChipItem>
          </div>
        ))}
      </div>
      <Toast
        open={toast.open}
        text={toast.text}
        position="bottom"
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </ScreenScaffold>
  );
}
