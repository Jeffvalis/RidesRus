import { brand } from '@ridesrus/core';
import { useConsole } from './state/console';

export const fonts = {
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
};

type Surface = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  line: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  accentBg: string;
  accentInk: string;
};

const day: Surface = {
  bg: brand.cream,
  surface: brand.surface,
  surfaceMuted: brand.surfaceMuted,
  line: brand.line,
  ink: brand.ink,
  inkSoft: brand.inkSoft,
  inkMuted: brand.inkMuted,
  accentBg: brand.lime,
  accentInk: brand.limeInk,
};

/** After dark the console dims to avoid glare in the driver's eyes. */
const night: Surface = {
  bg: brand.night,
  surface: brand.nightSurface,
  surfaceMuted: '#22252A',
  line: brand.nightLine,
  ink: brand.nightInk,
  inkSoft: '#CFCBC2',
  inkMuted: brand.nightInkMuted,
  accentBg: '#2C3A16',
  accentInk: brand.lime,
};

export type Palette = { [K in keyof typeof brand]: string } & Surface;

export function usePalette(): Palette {
  const isNight = useConsole((s) => s.night);
  return { ...brand, ...(isNight ? night : day) };
}
