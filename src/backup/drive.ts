// A minimal Google Drive v3 client for the app's private appDataFolder. The folder is hidden from
// the tutor's Drive UI and only this app (by OAuth client) can read it.

import { fetch } from 'expo/fetch';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FIELDS = 'id,name,createdTime,size,appProperties';

export type BackupProperties = {
  deviceId: string;
  deviceName: string;
  changeSeq: string;
  schemaVersion: string;
  students: string;
};

export type DriveBackup = {
  id: string;
  name: string;
  createdTime: string;
  size: number;
  props: Partial<BackupProperties>;
};

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type RawFile = { id: string; name: string; createdTime: string; size?: string; appProperties?: Record<string, string> };

const toBackup = (f: RawFile): DriveBackup => ({
  id: f.id,
  name: f.name,
  createdTime: f.createdTime,
  size: Number(f.size ?? 0),
  props: f.appProperties ?? {},
});

async function request(token: string, url: string, init: { method?: string; headers?: Record<string, string>; body?: Uint8Array<ArrayBuffer> }) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {}
    throw new DriveError(`Drive ${init.method ?? 'GET'} failed (${res.status}) ${detail}`, res.status);
  }
  return res;
}

/** Every backup in the app folder, newest first. */
export async function listBackups(token: string): Promise<DriveBackup[]> {
  const files: DriveBackup[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      fields: `nextPageToken,files(${FIELDS})`,
      orderBy: 'createdTime desc',
      pageSize: '100',
      q: "name contains 'mentto-' and trashed = false",
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await request(token, `${API}?${params}`, {});
    const json = (await res.json()) as { files: RawFile[]; nextPageToken?: string };
    files.push(...json.files.map(toBackup));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return files;
}

/** Uploads a new backup file in one multipart request. */
export async function uploadBackup(
  token: string,
  name: string,
  data: Uint8Array,
  props: BackupProperties,
): Promise<DriveBackup> {
  const boundary = `mentto-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({ name, parents: ['appDataFolder'], appProperties: props, mimeType: 'application/gzip' });
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + data.length + tail.length);
  body.set(head, 0);
  body.set(data, head.length);
  body.set(tail, head.length + data.length);

  const res = await request(token, `${UPLOAD}?uploadType=multipart&fields=${FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return toBackup((await res.json()) as RawFile);
}

export async function downloadBackup(token: string, id: string): Promise<Uint8Array> {
  const res = await request(token, `${API}/${encodeURIComponent(id)}?alt=media`, {});
  return new Uint8Array(await res.arrayBuffer());
}

export async function deleteBackup(token: string, id: string): Promise<void> {
  try {
    await request(token, `${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (e) {
    // Already gone (e.g. pruned from another phone) is fine.
    if (!(e instanceof DriveError && e.status === 404)) throw e;
  }
}
