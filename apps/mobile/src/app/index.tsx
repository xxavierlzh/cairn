import { Button, NoteList, useCreateNote, useNotesList } from '@cairn/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { HeaderButton } from '@/components/HeaderButton';
import { API_URL } from '@/lib/api-url';
import { authClient } from '@/lib/auth-client';

export default function NotesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    notes,
    isPending,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotesList();
  const createNote = useCreateNote();

  const openNote = (id: string) => router.push({ pathname: '/notes/[id]', params: { id } });

  async function signOut() {
    await authClient.signOut();
    // Drop cached notes so the next person to sign in on this phone can't see them.
    queryClient.clear();
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderButton title="Sign out" onPress={signOut} />,
          headerRight: () => (
            <HeaderButton
              title="New"
              disabled={createNote.isPending}
              onPress={() => createNote.mutate({}, { onSuccess: (note) => openNote(note.id) })}
            />
          ),
        }}
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
          onPressNote={openNote}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          loadingMore={isFetchingNextPage}
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={refetch}
        />
      )}
    </View>
  );
}
