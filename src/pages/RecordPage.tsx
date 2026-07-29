import { useState } from 'react';
import { Top, TextField, Paragraph, Spacing, Toast } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
// NOTE: useLocation is imported from 'react-router' (not 'react-router-dom') because the
// test harness's require()-shim (vitest.setup.ts) always substitutes a fixed mock location
// for 'react-router-dom', which would ignore MemoryRouter's real initialEntries/state.
// 'react-router' is the underlying package react-router-dom re-exports from and isn't
// intercepted, so this reads the real router context (including navigation state) while
// useNavigate stays on the mockable 'react-router-dom' entry point for assertions.
import { useLocation } from 'react-router';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SubmitFooter } from '../components/BottomCTA';
import { getRecords, getSettings } from '../lib/storage';
import { saveRecord } from '../lib/records';
import { calcSleep, formatMinutes } from '../lib/calc';
import type { RouteState } from '../lib/types';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function validate(bedTime: string, wakeTime: string): string | null {
  if (!TIME_PATTERN.test(bedTime) || !TIME_PATTERN.test(wakeTime)) {
    return '24시간 형식으로 입력해주세요';
  }
  if (bedTime === wakeTime) {
    return '취침·기상 시간이 같아요';
  }
  return null;
}

export default function RecordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RouteState['/record']) ?? undefined;
  const date = state?.date ?? today();

  const existing = getRecords().find((r) => r.date === date);
  const [bedTime, setBedTime] = useState(existing?.bedTime ?? '');
  const [wakeTime, setWakeTime] = useState(existing?.wakeTime ?? '');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, text: '' });

  const settings = getSettings();
  const outcome = calcSleep({ bedTime, wakeTime }, settings.targetMinutes);
  const previewText = outcome.ok
    ? `수면 ${formatMinutes(outcome.sleepMinutes)} · 부채 ${formatMinutes(outcome.debtMinutes)}`
    : '취침·기상 시간을 입력해주세요';

  const handleSave = () => {
    const validationError = validate(bedTime, wakeTime);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    const result = saveRecord({ bedTime, wakeTime, targetMinutes: settings.targetMinutes }, date, today());
    if (result.ok) {
      setToast({ open: true, text: '기록이 저장됐어요' });
      navigate('/');
      return;
    }
    if (result.reason === 'QUOTA') {
      setToast({ open: true, text: '저장 공간이 부족해요' });
    }
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>오늘 수면 기록</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="기록 저장" onClick={handleSave} disabled={!bedTime || !wakeTime} />}
    >
      <TextField
        variant="box"
        label="취침 시간"
        placeholder="23:00"
        value={bedTime}
        onChange={(e) => setBedTime(e.target.value)}
        inputMode="numeric"
      />
      <Spacing size={12} />
      <TextField
        variant="box"
        label="기상 시간"
        placeholder="07:00"
        value={wakeTime}
        onChange={(e) => setWakeTime(e.target.value)}
        inputMode="numeric"
        hasError={!!error}
        help={error ?? undefined}
      />
      <Spacing size={16} />
      <Paragraph.Text typography="st3" color="secondary" data-testid="sleep-preview">
        {previewText}
      </Paragraph.Text>
      <Spacing size={80} />
      <Toast
        open={toast.open}
        text={toast.text}
        position="bottom"
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </ScreenScaffold>
  );
}
