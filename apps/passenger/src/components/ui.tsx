import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SeatBand, bandColors } from '@ridesrus/core';
import { colors, fonts, radius, space, type } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

/* ───────────── Button ───────────── */

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'dark' | 'soft' | 'ghost' | 'danger';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const buttonColors = {
  primary: { bg: colors.yellow, fg: colors.yellowInk },
  dark: { bg: colors.ink, fg: '#FFFFFF' },
  soft: { bg: colors.surfaceMuted, fg: colors.ink },
  ghost: { bg: 'transparent', fg: colors.olive },
  danger: { bg: colors.redSoft, fg: colors.red },
};

export function Button({ label, onPress, variant = 'primary', icon, iconRight, loading, disabled, size = 'lg', style, accessibilityHint }: ButtonProps) {
  const c = buttonColors[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: c.bg, height: size === 'lg' ? 56 : 44, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'lg' ? 20 : 16} color={c.fg} />}
          <Text style={[styles.buttonText, { color: c.fg, fontSize: size === 'lg' ? 16 : 14 }]}>{label}</Text>
          {iconRight && <Ionicons name={iconRight} size={size === 'lg' ? 20 : 16} color={c.fg} />}
        </>
      )}
    </Pressable>
  );
}

/* ───────────── Card / layout ───────────── */

export function Card({ children, style, tone = 'surface' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'muted' | 'lime' | 'yellow' | 'blue' }) {
  const bg = { surface: colors.surface, muted: colors.surfaceMuted, lime: colors.lime, yellow: colors.yellowSoft, blue: colors.blueSoft }[tone];
  return <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
}

export function Row({ children, gap = 12, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function IconBadge({ name, bg = colors.yellow, fg = colors.yellowInk, size = 44 }: { name: IconName; bg?: string; fg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.48} color={fg} />
    </View>
  );
}

/* ───────────── Chips ───────────── */

export function Chip({ label, tone = 'muted', icon }: { label: string; tone?: 'muted' | 'lime' | 'blue' | 'red' | 'yellow' | 'dark'; icon?: IconName }) {
  const t = {
    muted: [colors.surfaceMuted, colors.inkSoft],
    lime: [colors.lime, colors.limeInk],
    blue: [colors.blueSoft, colors.blue],
    red: [colors.redSoft, colors.red],
    yellow: [colors.yellowSoft, colors.yellowInk],
    dark: [colors.ink, '#FFFFFF'],
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t[0] }]}>
      {icon && <Ionicons name={icon} size={12} color={t[1]} />}
      <Text style={[styles.chipText, { color: t[1] }]}>{label}</Text>
    </View>
  );
}

export function SeatChip({ band, free }: { band: SeatBand; free: number }) {
  if (band === 'FULL') return <Chip label="Full" tone="red" icon="close-circle" />;
  if (band === 'EMPTY') return <Chip label={`Empty · ${free} seats`} tone="muted" icon="ellipse-outline" />;
  return <Chip label={`${free} seat${free === 1 ? '' : 's'} free`} tone="lime" icon="checkmark-circle" />;
}

export function BandDot({ band, size = 10 }: { band: SeatBand; size?: number }) {
  const c = bandColors[band];
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.fill, borderWidth: band === 'EMPTY' ? 1.5 : 0, borderColor: colors.ink }} />;
}

/* ───────────── Inputs ───────────── */

export function Field({ label, icon, error, ...props }: TextInputProps & { label: string; icon: IconName; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={type.label}>{label}</Text>
      <View style={[styles.input, error ? { borderColor: colors.red } : null]}>
        <Ionicons name={icon} size={18} color={colors.inkMuted} />
        <TextInput
          placeholderTextColor={colors.inkMuted}
          style={styles.inputText}
          accessibilityLabel={label}
          {...props}
        />
      </View>
      {error ? <Text style={[type.small, { color: colors.red }]}>{error}</Text> : null}
    </View>
  );
}

export function Banner({ tone = 'info', icon = 'information-circle', children }: { tone?: 'info' | 'error' | 'success'; icon?: IconName; children: ReactNode }) {
  const t = { info: [colors.oliveSoft, colors.olive], error: [colors.redSoft, colors.red], success: [colors.lime, colors.limeInk] }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t[0] }]} accessibilityRole="alert">
      <Ionicons name={icon} size={18} color={t[1]} />
      <Text style={[type.small, { color: t[1], flex: 1, fontFamily: fonts.semibold }]}>{children}</Text>
    </View>
  );
}

export function Stars({ value, onChange, size = 36 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <Row gap={8} style={{ justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange?.(n)} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} hitSlop={6}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? colors.yellow : colors.line} />
        </Pressable>
      ))}
    </Row>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    borderRadius: radius.md,
    paddingHorizontal: space(5),
  },
  buttonText: { fontFamily: fonts.heavy, letterSpacing: -0.2 },
  card: { borderRadius: radius.lg, padding: space(4) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, alignSelf: 'flex-start' },
  chipText: { fontFamily: fonts.bold, fontSize: 12 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, height: '100%' },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: radius.md },
});
