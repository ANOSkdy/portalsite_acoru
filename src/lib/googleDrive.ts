import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, ensureEnv, env } from "./env";

const DRIVE_MIME_FOLDER = "application/vnd.google-apps.folder";
const DRIVE_MIME_SHORTCUT = "application/vnd.google-apps.shortcut";

let driveClient: drive_v3.Drive | null = null;

function getDriveClient() {
  if (driveClient) return driveClient;

  ensureEnv();
  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

type DriveErrorPayload = {
  status?: number;
  errors?: unknown;
  code?: string;
};

export class DriveOperationError extends Error {
  status?: number;
  code?: string;
  hint?: string;
  errors?: unknown;

  constructor(message: string, options: { status?: number; code?: string; hint?: string; errors?: unknown } = {}) {
    super(message);
    this.name = "DriveOperationError";
    this.status = options.status;
    this.code = options.code;
    this.hint = options.hint;
    this.errors = options.errors;
  }
}

function parseDriveError(error: unknown): DriveErrorPayload & { message: string } {
  const err = error as { response?: { status?: number; data?: { error?: { errors?: unknown; code?: string; message?: string } } }; code?: string; message?: string };
  const apiError = err?.response?.data?.error;
  return {
    status: err?.response?.status ?? apiError?.code,
    errors: apiError?.errors,
    code: err?.code ?? apiError?.code,
    message: apiError?.message ?? err?.message ?? "Drive API error",
  };
}

function logDriveError(context: string, folderId: string, error: unknown) {
  const parsed = parseDriveError(error);
  console.error(`[Drive] ${context}`, {
    serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    folderId,
    status: parsed.status,
    errors: parsed.errors,
    message: parsed.message,
  });
}

export async function resolveFolderId(folderId: string): Promise<string> {
  const drive = getDriveClient();
  let currentId = folderId;
  const visited = new Set<string>();

  try {
    // Follow shortcut until we reach the actual folder object
    for (let depth = 0; depth < 3; depth++) {
      const { data } = await drive.files.get({
        fileId: currentId,
        supportsAllDrives: true,
        fields: "id,name,mimeType,driveId,shortcutDetails",
      });

      if (data.mimeType === DRIVE_MIME_SHORTCUT) {
        const targetId = data.shortcutDetails?.targetId;
        if (!targetId) {
          throw new DriveOperationError("ショートカットの参照先を取得できませんでした。", {
            status: 400,
            hint: "ショートカットではなくフォルダ本体のIDを設定してください。",
          });
        }
        if (visited.has(targetId)) {
          throw new DriveOperationError("ショートカットの参照が循環しています。", {
            status: 400,
            hint: "ショートカットではなくフォルダ本体のIDを設定してください。",
          });
        }
        visited.add(targetId);
        currentId = targetId;
        continue;
      }

      if (data.mimeType !== DRIVE_MIME_FOLDER) {
        throw new DriveOperationError("指定IDはフォルダではありません。", {
          status: 400,
          hint: "フォルダIDを指定してください（ドライブ内のファイルではなくフォルダ）。",
        });
      }

      if (!data.id) {
        throw new DriveOperationError("フォルダIDを解決できませんでした。", { status: 400 });
      }

      return data.id;
    }

    throw new DriveOperationError("ショートカットの解決に失敗しました。", {
      status: 400,
      hint: "フォルダ本体のIDを設定してください。",
    });
  } catch (error) {
    const parsed = parseDriveError(error);
    logDriveError("resolveFolderId failed", currentId, error);

    const sharedHint = [
      `未処理フォルダ/処理済みフォルダを ${env.GOOGLE_SERVICE_ACCOUNT_EMAIL} に編集権限で共有しているか確認`,
      "Shared Driveの場合はメンバー追加",
      "ショートカットIDではなくフォルダ本体IDを設定",
    ].join(" / ");

    if (parsed.status === 404) {
      throw new DriveOperationError("フォルダが見つかりません。IDが間違っているか、サービスアカウントに共有されていません。", {
        status: 404,
        hint: sharedHint,
        code: parsed.code,
        errors: parsed.errors,
      });
    }

    if (error instanceof DriveOperationError) {
      throw error;
    }

    throw new DriveOperationError(parsed.message, {
      status: parsed.status,
      hint: sharedHint,
      code: parsed.code,
      errors: parsed.errors,
    });
  }
}

export type DriveFileSummary = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  parents?: string[];
};

export async function uploadToFolder({
  folderId,
  fileName,
  mimeType,
  buffer,
}: {
  folderId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const drive = getDriveClient();

  try {
    const resolvedFolderId = await resolveFolderId(folderId);

    const { data } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        parents: [resolvedFolderId],
        mimeType,
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id,name,mimeType,parents",
    });

    return {
      id: data.id as string,
      name: (data.name as string) ?? fileName,
      mimeType: (data.mimeType as string) ?? mimeType,
    };
  } catch (error) {
    logDriveError("uploadToFolder failed", folderId, error);
    const parsed = parseDriveError(error);
    const hint = [
      `未処理フォルダを ${env.GOOGLE_SERVICE_ACCOUNT_EMAIL} に共有しているか確認`,
      "GDRIVE_UNPROCESSED_FOLDER_ID がショートカットではないか確認",
      "Shared Driveの場合は supportsAllDrives が有効です（実装済み）",
    ].join(" / ");

    if (error instanceof DriveOperationError) {
      throw new DriveOperationError(error.message, {
        status: error.status ?? parsed.status,
        code: error.code ?? parsed.code,
        errors: error.errors ?? parsed.errors,
        hint: error.hint ?? hint,
      });
    }

    throw new DriveOperationError(parsed.message, {
      status: parsed.status,
      code: parsed.code,
      errors: parsed.errors,
      hint,
    });
  }
}

export async function uploadToUnprocessedFolder(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = (file.type || "application/octet-stream").toLowerCase();

  return uploadToFolder({
    folderId: env.GDRIVE_UNPROCESSED_FOLDER_ID,
    fileName: file.name,
    mimeType,
    buffer,
  });
}

export async function listUnprocessedFiles(limit: number) {
  const drive = getDriveClient();
  const resolvedFolderId = await resolveFolderId(env.GDRIVE_UNPROCESSED_FOLDER_ID);
  try {
    const { data } = await drive.files.list({
      q: `'${resolvedFolderId}' in parents and trashed=false`,
      orderBy: "createdTime asc",
      pageSize: limit,
      fields: "files(id,name,mimeType,size,createdTime,parents)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
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
  } catch (error) {
    logDriveError("listUnprocessedFiles failed", env.GDRIVE_UNPROCESSED_FOLDER_ID, error);
    const parsed = parseDriveError(error);
    throw new DriveOperationError(parsed.message, {
      status: parsed.status,
      code: parsed.code,
      errors: parsed.errors,
      hint: `未処理フォルダを ${env.GOOGLE_SERVICE_ACCOUNT_EMAIL} に共有し、Shared Drive ではメンバー追加されているか確認してください。`,
    });
  }
}

export async function downloadFile(fileId: string) {
  const drive = getDriveClient();
  const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  return Buffer.from(res.data as ArrayBuffer);
}

export async function getFileMetadata(fileId: string) {
  const drive = getDriveClient();
  const { data } = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,parents,size,createdTime",
    supportsAllDrives: true,
  });

  return data;
}

export async function moveFileToProcessed(fileId: string, currentParents?: string[]) {
  const drive = getDriveClient();
  const parents = currentParents?.length ? currentParents.join(",") : undefined;

  const resolvedFolderId = await resolveFolderId(env.GDRIVE_PROCESSED_FOLDER_ID);

  try {
    await drive.files.update({
      fileId,
      addParents: resolvedFolderId,
      removeParents: parents,
      supportsAllDrives: true,
    });
  } catch (error) {
    logDriveError("moveFileToProcessed failed", env.GDRIVE_PROCESSED_FOLDER_ID, error);
    const parsed = parseDriveError(error);
    throw new DriveOperationError(parsed.message, {
      status: parsed.status,
      code: parsed.code,
      errors: parsed.errors,
      hint: `処理済みフォルダを ${env.GOOGLE_SERVICE_ACCOUNT_EMAIL} に共有し、ショートカットではないことを確認してください。`,
    });
  }
}

export function isSupportedFile(file: { mimeType?: string; name?: string }) {
  const mime = (file.mimeType || "").toLowerCase();
  const ext = (file.name || "").split(".").pop()?.toLowerCase() ?? "";

  const mimeOk = ALLOWED_MIME_TYPES.includes(mime);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  return mimeOk && extOk;
}
