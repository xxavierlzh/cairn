import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from './api';
import { authClient } from './auth-client';

/**
 * Downloads every note as an Obsidian vault (.zip) into the app's cache, then opens the
 * share sheet so it can be saved to Files, AirDropped, or sent to another app.
 */
export async function exportVault(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("This device can't share files.");
  }
  const cookie = await authClient.getCookie();
  const date = new Date().toISOString().slice(0, 10);
  const file = await File.downloadFileAsync(
    api.exportUrl,
    new File(Paths.cache, `cairn-vault-${date}.zip`),
    // idempotent: replace today's earlier export instead of failing because it exists.
    { headers: cookie ? { Cookie: cookie } : {}, idempotent: true },
  );
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
    dialogTitle: 'Export vault',
  });
}
