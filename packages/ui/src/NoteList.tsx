/** @jsxImportSource nativewind */
'use client';

import { formatRelativeTime, type NoteSummary } from '@cairn/core';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

export interface NoteListProps {
  notes: NoteSummary[];
  onPressNote: (id: string) => void;
  /** Called near the bottom of the list. Use it to load the next page. */
  onEndReached?: () => void;
  loadingMore?: boolean;
  /** Pull-to-refresh (mobile only; ignored on web). */
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function NoteList({
  notes,
  onPressNote,
  onEndReached,
  loadingMore = false,
  refreshing = false,
  onRefresh,
}: NoteListProps) {
  return (
    <FlatList
      data={notes}
      keyExtractor={(note) => note.id}
      renderItem={({ item }) => <NoteRow note={item} onPress={() => onPressNote(item.id)} />}
      ItemSeparatorComponent={Separator}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={EmptyState}
      ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" /> : undefined}
      contentContainerClassName="pb-8"
    />
  );
}

function NoteRow({ note, onPress }: { note: NoteSummary; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="gap-1 px-4 py-3 active:bg-stone-100"
    >
      <Text numberOfLines={1} className="text-base font-semibold text-stone-900">
        {note.title}
      </Text>
      <Text className="text-sm text-stone-500">Edited {formatRelativeTime(note.updatedAt)}</Text>
    </Pressable>
  );
}

function Separator() {
  return <View className="mx-4 h-px bg-stone-200" />;
}

function EmptyState() {
  return (
    <View className="items-center gap-1 px-6 py-16">
      <Text className="text-base font-semibold text-stone-800">No notes yet</Text>
      <Text className="text-center text-sm text-stone-500">
        Create your first note to get started.
      </Text>
    </View>
  );
}
