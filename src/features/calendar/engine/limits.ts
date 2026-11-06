/** 可調常數的唯一來源（SDS 資料模型「可調常數」）。其他程式一律引用，不得另寫數字。 */
export const NAME_MAX_CHARS = 30;
export const EVENT_MIN_MINUTES = 1;
export const EVENT_MAX_MINUTES = 10080; // 7 天
export const NEW_EVENT_MINUTES = 120;
export const RADIAL_LONG_PRESS_MS = 250; // 長按空白處叫出 radial 選單（PRD AC-01.4、SRS FR-04，票 025）
export const RADIAL_MOVE_TOLERANCE_PX = 6; // 長按期間移動超過此距離即取消
export const RADIAL_ENTER_MS = 120; // 選單球向外滑出的進場動畫（DESIGN.md）
