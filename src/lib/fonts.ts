export const FONT_PRESETS = {
  house: {
    label: "House",
    description: "Cormorant Garamond with Lato. The brand pairing from the sales pages.",
  },
  editorial: {
    label: "Editorial",
    description: "Playfair Display with Source Sans. A little more magazine.",
  },
  modern: {
    label: "Modern",
    description: "Your device's own system type. Fastest and plainest.",
  },
} as const;

export type FontPreset = keyof typeof FONT_PRESETS;

export const TEXT_SCALES = [90, 100, 110, 120] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export function isFontPreset(v: string): v is FontPreset {
  return v in FONT_PRESETS;
}

export function isTextScale(v: number): v is TextScale {
  return (TEXT_SCALES as readonly number[]).includes(v);
}
