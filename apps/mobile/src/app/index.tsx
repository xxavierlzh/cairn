import { Button, NoteList, TagBar, useCreateNote, useNotesList, useTags } from '@cairn/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { HeaderButton } from '@/components/HeaderButton';
import { API_URL } from '@/lib/api-url';
import { authClient } from '@/lib/auth-client';
import { exportVault } from '@/lib/export-vault';

export default function NotesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // The tag filter is a route param, so tapping a #tag in a note can open this screen filtered.
  const params = useLocalSearchParams<{ tag?: string }>();
  const tag = params.tag?.toLowerCase() || undefined;
  const {
    notes,
    isPending,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotesList(tag);
  const tags = useTags();
  const createNote = useCreateNote();
  const [exporting, setExporting] = useState(false);

  const openNote = (id: string) => router.push({ pathname: '/notes/[id]', params: { id } });

  async function signOut() {
    await authClient.signOut();
    // Drop cached notes so the next person to sign in on this phone can't see them.
    queryClient.clear();
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportVault();
    } catch (exportError) {
      Alert.alert(
        "Couldn't export your vault",
        exportError instanceof Error ? exportError.message : 'Please try again.',
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderButton title="Sign out" onPress={signOut} />,
          headerRight: () => (
            <View className="flex-row">
              <HeaderButton title="Export" disabled={exporting} onPress={handleExport} />
              <HeaderButton
                title="New"
                disabled={createNote.isPending}
                onPress={() => createNote.mutate({}, { onSuccess: (note) => openNote(note.id) })}
              />
            </View>
          ),
        }}
      />

      <TagBar
        tags={tags.data?.tags ?? []}
        selected={tag}
        onSelect={(next) => router.setParams({ tag: next })}
      />

      {isPending ? (
        <ActivityIndicator className="mt-12" />
      ) : error ? (
        <View className="gap-3 p-6">
          <Text className="text-base font-semibold text-red-600">Couldn't load your notes</Text>
          <Text className="text-sm text-stone-600">{error.message}</Text>
          <Text className="text-sm text-stone-500">
            Is the API running, and can this phone reach {API_URL}?
          </Text>
          <Button title="Try again" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (
        <NoteList
          notes={notes}
          tag={tag}
          onPressNote={openNote}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          loadingMore={isFetchingNextPage}
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={() => {
            void refetch();
            void tags.refetch();
          }}
        />
      )}
    </View>
  );
}
