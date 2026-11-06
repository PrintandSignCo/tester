import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { safeFilename } from "@/lib/uploads";

export type StoredObject = {
  storageKey: string;
  driver: "local" | "s3" | "box";
  boxFileId: string;
  boxFolderId: string;
};

export type StorageStatus = {
  driver: "local" | "s3" | "box";
  configured: boolean;
  label: string;
};

export function boxConfigured(): boolean {
  return Boolean(
    process.env.BOX_DEVELOPER_TOKEN ||
      (process.env.BOX_CLIENT_ID && process.env.BOX_CLIENT_SECRET && process.env.BOX_ENTERPRISE_ID),
  );
}

export function s3Configured(): boolean {
  return Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

export function storageStatus(): StorageStatus {
  const explicit = process.env.STORAGE_DRIVER?.toLowerCase();
  const driver: StorageStatus["driver"] =
    explicit === "box" || explicit === "s3" || explicit === "local"
      ? explicit
      : boxConfigured()
        ? "box"
        : s3Configured()
          ? "s3"
          : "local";
  const configured = driver === "local" || (driver === "s3" && s3Configured()) || (driver === "box" && boxConfigured());
  const label =
    driver === "box" ? "Box.com (a folder per job)" : driver === "s3" ? "S3-compatible bucket" : "Local disk";
  return { driver, configured, label };
}

export async function storeArtwork(input: {
  filename: string;
  mime: string;
  body: Buffer;
  folderName: string;
}): Promise<StoredObject> {
  const status = storageStatus();
  if (!status.configured) {
    throw new Error(`${status.label} is selected but the environment variables are incomplete.`);
  }
  if (status.driver === "box") return storeBox(input);
  if (status.driver === "s3") return storeS3(input);
  return storeLocal(input);
}

export async function readArtwork(record: {
  storageKey: string;
  driver: string;
  boxFileId: string;
  mime: string;
}): Promise<{ body: Buffer; mime: string }> {
  if (record.driver === "box") {
    const body = await downloadBox(record.boxFileId || record.storageKey);
    return { body, mime: record.mime || "application/octet-stream" };
  }
  if (record.driver === "s3") {
    const client = s3();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: record.storageKey }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error("Artwork file was empty.");
    return { body: Buffer.from(bytes), mime: record.mime || result.ContentType || "application/octet-stream" };
  }
  const full = localPath(record.storageKey);
  const body = await readFile(full);
  return { body, mime: record.mime || "application/octet-stream" };
}

export async function removeArtwork(record: { storageKey: string; driver: string; boxFileId: string }) {
  if (record.driver === "box") {
    const token = await boxToken();
    const id = record.boxFileId || record.storageKey;
    await fetch(`https://api.box.com/2.0/files/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return;
  }
  if (record.driver === "s3") {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: record.storageKey }));
    return;
  }
  await rm(localPath(record.storageKey), { force: true });
}

function localRoot() {
  return path.resolve(process.cwd(), process.env.ARTWORK_DIR || "data/artwork");
}

function localPath(key: string) {
  const root = localRoot();
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("Invalid artwork path.");
  return full;
}

async function storeLocal(input: { filename: string; body: Buffer; folderName: string }): Promise<StoredObject> {
  const folder = input.folderName.replace(/[^a-zA-Z0-9_-]+/g, "_") || "artwork";
  const key = path.posix.join(folder, `${crypto.randomUUID()}-${safeFilename(input.filename)}`);
  const full = localPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, input.body);
  return { storageKey: key, driver: "local", boxFileId: "", boxFolderId: "" };
}

function bucket() {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET is not set.");
  return name;
}

function s3() {
  return new S3Client({
    region: process.env.S3_REGION || "ap-southeast-2",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  });
}

async function storeS3(input: { filename: string; mime: string; body: Buffer; folderName: string }): Promise<StoredObject> {
  const folder = input.folderName.replace(/[^a-zA-Z0-9_-]+/g, "_") || "artwork";
  const key = `${folder}/${crypto.randomUUID()}-${safeFilename(input.filename)}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: input.body,
      ContentType: input.mime || "application/octet-stream",
    }),
  );
  return { storageKey: key, driver: "s3", boxFileId: "", boxFolderId: "" };
}

let boxCache: { token: string; exp: number } | null = null;
const folderCache = new Map<string, string>();

async function boxToken(): Promise<string> {
  if (process.env.BOX_DEVELOPER_TOKEN) return process.env.BOX_DEVELOPER_TOKEN;
  if (boxCache && boxCache.exp > Date.now() + 30_000) return boxCache.token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.BOX_CLIENT_ID || "",
    client_secret: process.env.BOX_CLIENT_SECRET || "",
    box_subject_type: "enterprise",
    box_subject_id: process.env.BOX_ENTERPRISE_ID || "",
  });
  const res = await fetch("https://api.box.com/oauth2/token", { method: "POST", body, signal: AbortSignal.timeout(20000) });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || "Box authentication failed.");
  }
  boxCache = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function ensureBoxFolder(token: string, name: string): Promise<string> {
  const cached = folderCache.get(name);
  if (cached) return cached;
  const parent = process.env.BOX_ROOT_FOLDER_ID || "0";
  const res = await fetch("https://api.box.com/2.0/folders", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, parent: { id: parent } }),
    signal: AbortSignal.timeout(20000),
  });
  const data = (await res.json()) as {
    id?: string;
    message?: string;
    context_info?: { conflicts?: { id?: string } | { id?: string }[] };
  };
  if (res.ok && data.id) {
    folderCache.set(name, data.id);
    return data.id;
  }
  const conflicts = data.context_info?.conflicts;
  const existing = Array.isArray(conflicts) ? conflicts[0]?.id : conflicts?.id;
  if (existing) {
    folderCache.set(name, existing);
    return existing;
  }
  throw new Error(data.message || "Box could not create the job folder.");
}

async function storeBox(input: { filename: string; mime: string; body: Buffer; folderName: string }): Promise<StoredObject> {
  const token = await boxToken();
  const folderId = await ensureBoxFolder(token, input.folderName || "Artwork");
  const form = new FormData();
  form.set("attributes", JSON.stringify({ name: input.filename, parent: { id: folderId } }));
  form.set("file", new Blob([new Uint8Array(input.body)], { type: input.mime || "application/octet-stream" }), input.filename);
  const res = await fetch("https://upload.box.com/api/2.0/files/content", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  const data = (await res.json()) as { entries?: { id: string }[]; message?: string };
  const fileId = data.entries?.[0]?.id;
  if (!res.ok || !fileId) throw new Error(data.message || "Box upload failed.");
  return { storageKey: fileId, driver: "box", boxFileId: fileId, boxFolderId: folderId };
}

async function downloadBox(fileId: string): Promise<Buffer> {
  const token = await boxToken();
  const res = await fetch(`https://api.box.com/2.0/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error("Box could not download that file.");
  return Buffer.from(await res.arrayBuffer());
}
