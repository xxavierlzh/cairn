'use client';

import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { useEffect, useRef } from 'react';

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '15px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    lineHeight: '1.6',
    padding: '16px 0',
  },
  '.cm-content': { padding: '0 24px' },
});

interface MarkdownEditorProps {
  /** Only read on mount. After that the editor owns the text and reports edits via onChange. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Edits raw Markdown with CodeMirror 6, the editor Obsidian is built on. Editing the source
 * directly means what you type is exactly what gets saved and exported.
 */
export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const container = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount once; re-key the component to load other text.
  useEffect(() => {
    if (!container.current) return;
    const view = new EditorView({
      parent: container.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown(),
          syntaxHighlighting(defaultHighlightStyle),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Note body (Markdown)' }),
          placeholder('Start writing in Markdown…'),
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    return () => view.destroy();
  }, []);

  return <div ref={container} className="h-full" />;
}
