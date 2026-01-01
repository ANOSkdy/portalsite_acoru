import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, env } from "./env";

let driveClient: drive_v3.Drive | null = null;

function getDriveClient() {
  if (driveClient) return driveClient;

  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export type DriveFileSummary = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  parents?: string[];
};

export async function uploadToUnprocessedFolder(file: File) {
  const drive = getDriveClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  const { data } = await drive.files.create({
    requestBody: {
      name: file.name,
      parents: [env.GDRIVE_UNPROCESSED_FOLDER_ID],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id,name,mimeType",
  });

  return {
    id: data.id as string,
    name: (data.name as string) ?? file.name,
    mimeType: (data.mimeType as string) ?? mimeType,
  };
}

export async function listUnprocessedFiles(limit: number) {
  const drive = getDriveClient();
  const { data } = await drive.files.list({
    q: `'${env.GDRIVE_UNPROCESSED_FOLDER_ID}' in parents and trashed=false`,
    orderBy: "createdTime asc",
    pageSize: limit,
    fields: "files(id,name,mimeType,size,createdTime,parents)",
    supportsAllDrives: false,
  });

  const files = data.files ?? [];
  return files
    .filter((f): f is drive_v3.Schema$File => Boolean(f.id && f.name && f.mimeType))
    .map<DriveFileSummary>((f) => ({
      id: f.id as string,
      name: f.name as string,
      mimeType: f.mimeType as string,
      size: f.size ? Number(f.size) : undefined,
      createdTime: f.createdTime ?? undefined,
      parents: f.parents ?? undefined,
    }));
}

export async function downloadFile(fileId: string) {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function getFileMetadata(fileId: string) {
  const drive = getDriveClient();
  const { data } = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,parents,size,createdTime",
    supportsAllDrives: false,
  });

  return data;
}

export async function moveFileToProcessed(fileId: string, currentParents?: string[]) {
  const drive = getDriveClient();
  const parents = currentParents?.length ? currentParents.join(",") : undefined;

  await drive.files.update({
    fileId,
    addParents: env.GDRIVE_PROCESSED_FOLDER_ID,
    removeParents: parents,
    supportsAllDrives: false,
  });
}

export function isSupportedFile(file: { mimeType?: string; name?: string }) {
  const mime = (file.mimeType || "").toLowerCase();
  const ext = (file.name || "").split(".").pop()?.toLowerCase() ?? "";

  const mimeOk = ALLOWED_MIME_TYPES.includes(mime);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  return mimeOk && extOk;
}
