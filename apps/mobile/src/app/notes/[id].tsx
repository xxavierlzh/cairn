import { ApiError } from '@cairn/core';
import { Button, SAVE_STATUS_LABEL, useNoteEditor } from '@cairn/ui';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { HeaderButton } from '@/components/HeaderButton';
import { MarkdownPreview } from '@/components/MarkdownPreview';

const MONOSPACE = Platform.select({ ios: 'Menlo', default: 'monospace' });
const MODES = ['write', 'preview'] as const;

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // key={id}: opening another note remounts the editor with a fresh draft.
  return <NoteEditorScreen key={id} id={id} />;
}

function NoteEditorScreen({ id }: { id: string }) {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const editor = useNoteEditor(id);
  const [mode, setMode] = useState<(typeof MODES)[number]>('write');

  function confirmDelete() {
    Alert.alert('Delete this note?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await editor.deleteNote();
            router.back();
          } catch {
            Alert.alert("Couldn't delete the note", 'Please try again.');
          }
        },
      },
    ]);
  }

  if (editor.isLoading) {
    return <ActivityIndicator className="mt-12" />;
  }

  if (editor.error || !editor.draft) {
    const missing = editor.error instanceof ApiError && editor.error.status === 404;
    return (
      <View className="gap-3 p-6">
        <Text className="text-base text-red-600">
          {missing ? "This note doesn't exist or was deleted." : "Couldn't load this note."}
        </Text>
        <Button title="Back to notes" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
      className="flex-1 bg-white"
    >
      <Stack.Screen
        options={{
          title: SAVE_STATUS_LABEL[editor.status],
          headerRight: () => (
            <HeaderButton
              title="Delete"
              destructive
              disabled={editor.isDeleting}
              onPress={confirmDelete}
            />
          ),
        }}
      />

      <TextInput
        value={editor.draft.title}
        onChangeText={editor.setTitle}
        placeholder="Untitled"
        placeholderTextColor="#a8a29e"
        accessibilityLabel="Title"
        className="px-4 pt-4 text-2xl font-bold text-stone-900"
      />
      {editor.titleError ? (
        <Text className="px-4 pt-1 text-sm text-red-600">{editor.titleError}</Text>
      ) : null}

      <View accessibilityRole="tablist" className="mx-4 my-3 flex-row rounded-lg bg-stone-100 p-1">
        {MODES.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === option }}
            onPress={() => setMode(option)}
            className={`flex-1 items-center rounded-md py-1.5 ${mode === option ? 'bg-white' : ''}`}
          >
            <Text
              className={`text-sm capitalize ${mode === option ? 'font-semibold text-stone-900' : 'text-stone-600'}`}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'write' ? (
        <TextInput
          multiline
          value={editor.draft.markdown}
          onChangeText={editor.setMarkdown}
          placeholder="Start writing in Markdown…"
          placeholderTextColor="#a8a29e"
          textAlignVertical="top"
          accessibilityLabel="Note body (Markdown)"
          style={{ fontFamily: MONOSPACE }}
          className="flex-1 px-4 pb-4 text-base text-stone-900"
        />
      ) : (
        <MarkdownPreview markdown={editor.draft.markdown} />
      )}
    </KeyboardAvoidingView>
  );
}
