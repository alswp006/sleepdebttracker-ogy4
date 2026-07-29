import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Top, Paragraph, Spacing, Button, Chip, Toast } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { LoadingState } from '@/components/StateView';
import { getSettings, writeSettings } from '@/lib/storage';
import { TARGET_MIN, TARGET_MAX } from '@/lib/types';
import type { UserSettings } from '@/lib/types';

// 목업 대비: 그룹 컨테이너 Chip을 개별 토글 아이템으로 사용 (mocks.ts의 Chip이 selected/onClick 토글로 동작)
const ChipToggle = Chip as unknown as ComponentType<{
  selected?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}>;

const TARGET_HOURS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

const TAB_ITEMS = [
  { label: '홈', path: '/' },
  { label: '리포트', path: '/report' },
  { label: '플랜', path: '/plan' },
  { label: '유형', path: '/chronotype' },
  { label: '설정', path: '/settings' },
];

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [savedToastOpen, setSavedToastOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const loaded = getSettings();
      setSettings(loaded);
      setSelectedMinutes(loaded.targetMinutes);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSelect = (hours: number) => {
    fireHaptic('tickWeak');
    setSelectedMinutes(hours * 60);
  };

  const handleSave = () => {
    if (settings === null || selectedMinutes === null) return;
    const result = validateTargetMinutes(selectedMinutes);
    if (!result.ok) return;

    fireHaptic('success');
    const next = { ...settings, targetMinutes: selectedMinutes };
    writeSettings(next);
    setSettings(next);
    setSavedToastOpen(true);
  };

  const top = <Top title={<Top.TitleParagraph>설정</Top.TitleParagraph>} />;
  const bottom = <FloatingTabBar items={TAB_ITEMS} />;

  if (settings === null || selectedMinutes === null) {
    return (
      <ScreenScaffold top={top} bottom={bottom}>
        <LoadingState rows={4} testId="settings-loading" />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold top={top} bottom={bottom}>
      <Paragraph.Text typography="t5">목표 수면 시간</Paragraph.Text>
      <Spacing size={16} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TARGET_HOURS.map((hours) => (
          <div
            key={hours}
            data-testid="settings-chip"
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
      <Spacing size={24} />
      <Button variant="fill" size="large" display="block" onClick={handleSave}>
        저장
      </Button>
      <Toast
        open={savedToastOpen}
        text="목표를 저장했어요"
        position="bottom"
        onClose={() => setSavedToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
