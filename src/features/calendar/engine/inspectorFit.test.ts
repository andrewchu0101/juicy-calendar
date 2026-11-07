import { describe, expect, it } from 'vitest';
import { inspectorFits } from './index';

// 票 027｜NFR-07、SDS UI-06：右側面板固定佔版面時，日曆區要放得下完整的日曆欄，否則面板收合成圓點。
// 預期值是手算：時間軸 80 px（容納 12 小時制）＋每欄至少 84 px；面板 272 px＋間隔 16 px。
//   週檢視 7 欄：80 + 84×7 + 272 + 16 = 956；日檢視 1 欄：80 + 84 + 272 + 16 = 452。
describe('[NFR-07][UI-06,ticket 027] inspector fits beside the calendar', () => {
  it('week view needs 956 px of calendar area', () => {
    expect(inspectorFits(956, 7)).toBe(true);
    expect(inspectorFits(955, 7)).toBe(false);
    expect(inspectorFits(1284, 7)).toBe(true); // 1400 px window
    expect(inspectorFits(784, 7)).toBe(false); // 900 px window, the minimum
  });

  it('day view needs only 452 px', () => {
    expect(inspectorFits(452, 1)).toBe(true);
    expect(inspectorFits(451, 1)).toBe(false);
    expect(inspectorFits(784, 1)).toBe(true);
  });
});
