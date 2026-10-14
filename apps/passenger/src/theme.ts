import { StyleSheet, TextStyle } from 'react-native';
import { brand } from '@ridesrus/core';

export const colors = brand;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = (n: number) => n * 4;

export const type = StyleSheet.create({
  display: { fontFamily: fonts.heavy, fontSize: 40, lineHeight: 44, letterSpacing: -1.2, color: brand.ink },
  title: { fontFamily: fonts.heavy, fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: brand.ink },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: brand.ink },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: brand.inkSoft },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: brand.inkMuted },
  label: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: brand.inkMuted, textTransform: 'uppercase' } as TextStyle,
  number: { fontFamily: fonts.heavy, fontSize: 32, letterSpacing: -1, color: brand.ink, fontVariant: ['tabular-nums'] } as TextStyle,
});

export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 8,
};
