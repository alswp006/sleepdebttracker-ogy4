import { describe, it, expect, vi } from 'vitest';

describe('dbg', () => {
  it('quota via prototype spy', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    });
    try {
      localStorage.setItem('x', '1');
      console.log('NO THROW');
    } catch (e) {
      console.log('THREW', (e as Error).message);
    }
    spy.mockRestore();
  });
});
