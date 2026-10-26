import { Pressable, Text } from 'react-native';

interface HeaderButtonProps {
  title: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function HeaderButton({ title, onPress, destructive, disabled }: HeaderButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      className={`px-2 ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={`text-base font-semibold ${destructive ? 'text-red-600' : 'text-moss-700'}`}>
        {title}
      </Text>
    </Pressable>
  );
}
