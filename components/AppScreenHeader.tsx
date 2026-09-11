import { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/lib/theme';

type AppScreenHeaderProps = {
  title: string;
  subtitle?: string;
  topInset?: number;
  rightElement?: ReactNode;
  onRightPress?: () => void;
  rightAccessibilityLabel?: string;
};

export default function AppScreenHeader({
  title,
  subtitle,
  topInset = 0,
  rightElement,
  onRightPress,
  rightAccessibilityLabel,
}: AppScreenHeaderProps) {
  return (
    <LinearGradient
      colors={[theme.colors.primaryDark, theme.colors.primary]}
      style={[styles.header, { paddingTop: Math.max(topInset, 16) + 12 }]}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightElement ? (
        <TouchableOpacity
          style={styles.rightBtn}
          onPress={onRightPress}
          accessibilityRole="button"
          accessibilityLabel={rightAccessibilityLabel}>
          {rightElement}
        </TouchableOpacity>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  titleBlock: { flex: 1 },
  title: {
    ...theme.typography.title,
    color: '#ffffff',
  },
  subtitle: {
    ...theme.typography.subtitle,
    color: theme.colors.primarySoft,
    marginTop: 2,
  },
  rightBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.md,
  },
});
