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
  /** Set while the list is filtered by a tag, so the empty state says so. */
  tag?: string;
}

export function NoteList({
  notes,
  onPressNote,
  onEndReached,
  loadingMore = false,
  refreshing = false,
  onRefresh,
  tag,
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
      ListEmptyComponent={<EmptyState tag={tag} />}
      ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" /> : undefined}
      contentContainerClassName="pb-8"
    />
  );
}

const ROW_TAGS_MAX = 3;

function NoteRow({ note, onPress }: { note: NoteSummary; onPress: () => void }) {
  const extraTags = note.tags.length - ROW_TAGS_MAX;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="gap-1 px-4 py-3 active:bg-stone-100"
    >
      <Text numberOfLines={1} className="text-base font-semibold text-stone-900">
        {note.title}
      </Text>
      <Text numberOfLines={1} className="text-sm text-stone-500">
        Edited {formatRelativeTime(note.updatedAt)}
        {note.tags.slice(0, ROW_TAGS_MAX).map((tag) => (
          <Text key={tag} className="text-moss-700">
            {`  #${tag}`}
          </Text>
        ))}
        {extraTags > 0 ? `  +${extraTags}` : null}
      </Text>
    </Pressable>
  );
}

function Separator() {
  return <View className="mx-4 h-px bg-stone-200" />;
}

function EmptyState({ tag }: { tag?: string }) {
  return (
    <View className="items-center gap-1 px-6 py-16">
      <Text className="text-base font-semibold text-stone-800">
        {tag ? `No notes tagged #${tag}` : 'No notes yet'}
      </Text>
      <Text className="text-center text-sm text-stone-500">
        {tag ? 'Pick another tag, or All.' : 'Create your first note to get started.'}
      </Text>
    </View>
  );
}
