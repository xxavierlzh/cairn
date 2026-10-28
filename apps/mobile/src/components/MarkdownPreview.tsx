import Markdown from 'react-native-marked';

export function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <Markdown
      value={markdown || '_Nothing to preview yet._'}
      flatListProps={{ contentContainerStyle: { padding: 16 }, style: { backgroundColor: '#fff' } }}
    />
  );
}
