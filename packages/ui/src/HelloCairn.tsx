/** @jsxImportSource nativewind */
// The pragma above makes `className` work on web too. Next.js can't set NativeWind's JSX
// runtime globally (it breaks Server Components), so every UI file that styles React Native
// components needs it. On mobile, Babel already sets it, so there it's a no-op.
'use client';

import { APP_NAME, TAGLINE } from '@cairn/core';
import { Platform, Text, View } from 'react-native';

const PLATFORM_LABEL: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
};

export function HelloCairn() {
  return (
    <View className="items-center gap-3 rounded-3xl border border-stone-200 bg-stone-50 px-10 py-8">
      <Text className="text-4xl font-bold text-stone-900">Hello {APP_NAME}</Text>
      <Text className="text-base text-stone-600">{TAGLINE}</Text>
      <View className="mt-2 rounded-full bg-moss-100 px-3 py-1">
        <Text className="text-xs font-semibold uppercase text-moss-700">
          Rendering on {PLATFORM_LABEL[Platform.OS] ?? Platform.OS}
        </Text>
      </View>
    </View>
  );
}
