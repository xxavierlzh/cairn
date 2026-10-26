'use client';

import { useParams } from 'next/navigation';
import { NoteEditor } from '@/components/NoteEditor';

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  // key={id}: opening another note remounts the editor with a fresh draft.
  return <NoteEditor key={id} id={id} />;
}
