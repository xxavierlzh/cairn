/** @jsxImportSource nativewind */
// The pragma above makes `className` work on web too. Next.js can't set NativeWind's JSX
// runtime globally (it breaks Server Components), so every UI file that styles React Native
// components needs it. On mobile, Babel already sets it, so there it's a no-op.
'use client';

import { ActivityIndicator, Pressable, Text } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger';

// Full class names (not built from parts) so Tailwind's scanner can find them.
const CONTAINER: Record<Variant, string> = {
  primary: 'bg-moss-700 active:bg-moss-900',
  secondary: 'border border-stone-300 bg-white active:bg-stone-100',
  danger: 'border border-red-200 bg-white active:bg-red-50',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-stone-800',
  danger: 'text-red-700',
};

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      className={`h-11 flex-row items-center justify-center gap-2 rounded-xl px-4 ${CONTAINER[variant]} ${inactive ? 'opacity-50' : ''} ${className}`}
    >
      {loading && (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#ffffff' : '#57534e'} />
      )}
      <Text className={`text-base font-semibold ${LABEL[variant]}`}>{title}</Text>
    </Pressable>
  );
}
