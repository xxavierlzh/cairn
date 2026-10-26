/** @jsxImportSource nativewind */
'use client';

import { Text, TextInput, type TextInputProps, View } from 'react-native';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, className = '', ...props }: TextFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-stone-700">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#a8a29e"
        className={`h-11 rounded-xl border bg-white px-3 text-base text-stone-900 ${error ? 'border-red-400' : 'border-stone-300'} ${className}`}
        {...props}
      />
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
