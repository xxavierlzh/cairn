import { parsePreviewHref, toPreviewMarkdown } from '@cairn/core';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import { Text, type TextStyle } from 'react-native';
import Markdown, { Renderer } from 'react-native-marked';

interface LinkHandlers {
  /** The id of the note a [[link]] points to, or `null` if there's no such note yet. */
  resolveLink: (title: string) => string | null;
  onPressLink: (title: string) => void;
  onPressTag: (tag: string) => void;
}

interface MarkdownPreviewProps extends LinkHandlers {
  markdown: string;
  /** Rendered after the note, inside the same scroll view (e.g. backlinks). */
  footer?: ReactElement;
}

const UNRESOLVED: TextStyle = {
  color: '#a8a29e',
  textDecorationLine: 'underline',
  textDecorationStyle: 'dashed',
};
const TAG: TextStyle = { color: '#3e5a39', backgroundColor: '#f3f7f2', textDecorationLine: 'none' };

/** react-native-marked's renderer, plus [[wikilinks]] and #tags (which arrive as cairn: links). */
class CairnRenderer extends Renderer {
  constructor(private readonly handlers: LinkHandlers) {
    super();
  }

  override link(children: string | ReactNode[], href: string, styles?: TextStyle, title?: string) {
    const target = parsePreviewHref(href);
    if (!target) return super.link(children, href, styles, title);

    const { resolveLink, onPressLink, onPressTag } = this.handlers;
    const isTag = target.kind === 'tag';
    const missing = !isTag && resolveLink(target.title) === null;
    return (
      <Text
        key={this.getKey()}
        accessibilityRole="link"
        accessibilityHint={missing ? 'Creates this note' : undefined}
        onPress={() => (isTag ? onPressTag(target.tag) : onPressLink(target.title))}
        style={[styles, isTag ? TAG : missing ? UNRESOLVED : null]}
      >
        {children}
      </Text>
    );
  }
}

export function MarkdownPreview({
  markdown,
  resolveLink,
  onPressLink,
  onPressTag,
  footer,
}: MarkdownPreviewProps) {
  const value = useMemo(() => toPreviewMarkdown(markdown), [markdown]);
  const renderer = useMemo(
    () => new CairnRenderer({ resolveLink, onPressLink, onPressTag }),
    [resolveLink, onPressLink, onPressTag],
  );

  return (
    <Markdown
      value={value || '_Nothing to preview yet._'}
      renderer={renderer}
      flatListProps={{
        contentContainerStyle: { padding: 16 },
        style: { backgroundColor: '#fff' },
        ListFooterComponent: footer,
      }}
    />
  );
}
