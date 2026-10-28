/** @jsxImportSource nativewind */
'use client';

import type { TagCount } from '@cairn/core';
import { Pressable, ScrollView, Text } from 'react-native';

export interface TagBarProps {
  tags: TagCount[];
  /** The tag being filtered by, or undefined for all notes. */
  selected?: string;
  onSelect: (tag: string | undefined) => void;
}

/** A row of tag chips that filters the notes list. Scrolls sideways when there are many. */
export function TagBar({ tags, selected, onSelect }: TagBarProps) {
  if (tags.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="grow-0"
      contentContainerClassName="gap-2 px-4 py-2"
    >
      <Chip label="All" active={!selected} onPress={() => onSelect(undefined)} />
      {tags.map(({ tag, count }) => (
        <Chip
          key={tag}
          label={`#${tag}`}
          count={count}
          active={selected === tag}
          onPress={() => onSelect(selected === tag ? undefined : tag)}
        />
      ))}
    </ScrollView>
  );
}

interface ChipProps {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}

function Chip({ label, count, active, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-row items-center gap-1 rounded-full border px-3 py-1 ${active ? 'border-moss-700 bg-moss-700' : 'border-stone-300 bg-white active:bg-stone-100'}`}
    >
      <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-stone-700'}`}>
        {label}
      </Text>
      {count !== undefined && (
        <Text className={`text-xs ${active ? 'text-moss-100' : 'text-stone-400'}`}>{count}</Text>
      )}
    </Pressable>
  );
}
