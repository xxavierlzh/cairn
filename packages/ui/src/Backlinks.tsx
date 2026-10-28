/** @jsxImportSource nativewind */
'use client';

import { formatRelativeTime } from '@cairn/core';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useBacklinks } from './notes';

export interface BacklinksProps {
  noteId: string;
  onPressNote: (id: string) => void;
}

/** "Linked from": the notes that [[link]] to this one, like Obsidian's backlinks pane. */
export function Backlinks({ noteId, onPressNote }: BacklinksProps) {
  const { data, isPending, error } = useBacklinks(noteId);

  return (
    <View className="gap-2 border-t border-stone-200 pt-4">
      <Text className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        Linked from
      </Text>
      {isPending ? (
        <ActivityIndicator className="self-start" />
      ) : error ? (
        <Text className="text-sm text-red-600">Couldn't load backlinks.</Text>
      ) : data.items.length === 0 ? (
        <Text className="text-sm text-stone-500">No other notes link here yet.</Text>
      ) : (
        <View className="gap-1">
          {data.items.map((note) => (
            <Pressable
              key={note.id}
              accessibilityRole="link"
              onPress={() => onPressNote(note.id)}
              className="flex-row items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 active:bg-stone-100"
            >
              <Text numberOfLines={1} className="shrink text-base font-medium text-moss-700">
                {note.title}
              </Text>
              <Text className="text-xs text-stone-400">{formatRelativeTime(note.updatedAt)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
