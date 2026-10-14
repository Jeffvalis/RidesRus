import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance, formatEta } from '@ridesrus/core';
import { colors, fonts, radius, type } from '../theme';

export type StopOption = { id: string; name: string; metres?: number; etaSec?: number; disabled?: boolean };

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: StopOption[];
  selectedId: string | null;
  onSelect: (stopId: string) => void;
  onClose: () => void;
};

export function StopPicker({ visible, title, subtitle, options, selectedId, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.grabber} />
        <Text style={type.title}>{title}</Text>
        {subtitle ? <Text style={[type.body, { marginTop: 4 }]}>{subtitle}</Text> : null}
        <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ gap: 8 }}>
          {options.map((o) => {
            const active = o.id === selectedId;
            return (
              <Pressable
                key={o.id}
                disabled={o.disabled}
                onPress={() => onSelect(o.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: o.disabled }}
                style={[styles.row, active && styles.rowActive, o.disabled && { opacity: 0.4 }]}
              >
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.olive : colors.inkMuted} />
                <Text style={[styles.name, active && { color: colors.ink }]}>{o.name}</Text>
                {o.etaSec !== undefined && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.eta}>{formatEta(o.etaSec)}</Text>
                    <Text style={type.small}>{formatDistance(o.metres ?? 0)}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,16,18,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.cream, borderWidth: 1.5, borderColor: 'transparent' },
  rowActive: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.inkSoft },
  eta: { fontFamily: fonts.heavy, fontSize: 15, color: colors.blue },
});
