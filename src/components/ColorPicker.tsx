import { PALETTE } from '../utils/color';

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const isCustom = !PALETTE.some((color) => color.toLowerCase() === value.toLowerCase());
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Colour ${color}`}
          aria-pressed={color.toLowerCase() === value.toLowerCase()}
          className="size-5 rounded-full transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-ink aria-pressed:ring-offset-2"
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <label
        title="Custom colour"
        className={`relative flex size-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-line-strong text-xs text-muted ${isCustom ? 'ring-2 ring-ink ring-offset-2' : ''}`}
        style={isCustom ? { backgroundColor: value } : undefined}
      >
        {!isCustom && '+'}
        <input
          type="color"
          aria-label="Custom colour"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}
