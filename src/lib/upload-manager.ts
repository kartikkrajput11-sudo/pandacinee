import { supabase } from "@/integrations/supabase/client";

export type UploadStatus = "uploading" | "processing" | "error" | "done" | "cancelled";

export type UploadTask = {
  id: string;
  scope: string;
  kind: "image" | "video" | "file" | "voice";
  name: string;
  size: number;
  previewUrl: string | null;
  progress: number; // 0..1
  status: UploadStatus;
  error?: string | null;
};

type Internal = UploadTask & {
  xhr: XMLHttpRequest | null;
  retry: () => void;
  cancelled: boolean;
};

const tasks = new Map<string, Internal>();
const listeners = new Set<() => void>();
let snapshot: UploadTask[] = [];

function publish() {
  snapshot = Array.from(tasks.values()).map((t) => ({
    id: t.id,
    scope: t.scope,
    kind: t.kind,
    name: t.name,
    size: t.size,
    previewUrl: t.previewUrl,
    progress: t.progress,
    status: t.status,
    error: t.error ?? null,
  }));
  listeners.forEach((l) => l());
}

export function subscribeUploads(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getUploadSnapshot() {
  return snapshot;
}

export function cancelUpload(id: string) {
  const t = tasks.get(id);
  if (!t) return;
  t.cancelled = true;
  t.xhr?.abort();
  tasks.delete(id);
  if (t.previewUrl) URL.revokeObjectURL(t.previewUrl);
  publish();
}

export function retryUpload(id: string) {
  const t = tasks.get(id);
  if (!t || t.status !== "error") return;
  t.status = "uploading";
  t.progress = 0;
  t.error = null;
  publish();
  t.retry();
}

export function dismissUpload(id: string) {
  cancelUpload(id);
}

function extOf(name: string) {
  return (name.split(".").pop() || "bin").toLowerCase();
}

function contentTypeFor(file: Blob, kind: UploadTask["kind"]) {
  const base = (file.type || "").split(";")[0].trim();
  if (base) return base;
  return kind === "voice" ? "audio/webm"
    : kind === "image" ? "image/jpeg"
    : kind === "video" ? "video/mp4"
    : "application/octet-stream";
}

/** Upload with real byte-level progress using a signed upload URL + XHR. */
function putWithProgress(
  signedUrl: string,
  file: Blob,
  contentType: string,
  onProgress: (p: number) => void,
  bind: (xhr: XMLHttpRequest) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    bind(xhr);
    xhr.open("PUT", signedUrl, true);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("cancelled"));
    xhr.send(file);
  });
}

export type StartUploadOptions = {
  scope: string;
  kind: UploadTask["kind"];
  file: File | Blob;
  name?: string;
  /** Called once the object exists in storage; return when the message is sent. */
  onComplete: (path: string) => Promise<void> | void;
};

/**
 * Queue an upload. Returns the task id immediately; the tray renders progress
 * and offers cancel / retry until the message is actually sent.
 */
export function startUpload(opts: StartUploadOptions): string {
  const id = crypto.randomUUID();
  const name = opts.name ?? (opts.file as File).name ?? `${opts.kind}.${opts.kind === "image" ? "jpg" : "bin"}`;
  const previewUrl =
    opts.kind === "image" || opts.kind === "video" ? URL.createObjectURL(opts.file) : null;

  const run = async () => {
    const t = tasks.get(id);
    if (!t) return;
    const path = `${crypto.randomUUID()}`;
    try {
      const storagePath = `${opts.scope}/${opts.kind}/${path}.${extOf(name)}`;
      const contentType = contentTypeFor(opts.file, opts.kind);
      const { data: signed, error: signErr } = await supabase.storage
        .from("chat-media")
        .createSignedUploadUrl(storagePath);
      if (t.cancelled) return;

      if (signErr || !signed?.signedUrl) {
        // Fallback: plain upload without granular progress.
        t.progress = 0.15;
        publish();
        const { error } = await supabase.storage
          .from("chat-media")
          .upload(storagePath, opts.file, { contentType, upsert: false });
        if (error) throw error;
      } else {
        await putWithProgress(
          signed.signedUrl,
          opts.file,
          contentType,
          (p) => {
            const cur = tasks.get(id);
            if (!cur) return;
            cur.progress = Math.min(0.98, p);
            publish();
          },
          (xhr) => { t.xhr = xhr; },
        );
      }
      if (t.cancelled) return;
      t.progress = 1;
      t.status = "processing";
      publish();
      await opts.onComplete(storagePath);
      if (t.cancelled) return;
      t.status = "done";
      publish();
      window.setTimeout(() => cancelUpload(id), 350);
    } catch (err: any) {
      const cur = tasks.get(id);
      if (!cur || cur.cancelled) return;
      if (err?.message === "cancelled") return;
      cur.status = "error";
      cur.error = err?.message ?? "Upload failed";
      publish();
    }
  };

  tasks.set(id, {
    id,
    scope: opts.scope,
    kind: opts.kind,
    name,
    size: (opts.file as File).size ?? 0,
    previewUrl,
    progress: 0,
    status: "uploading",
    error: null,
    xhr: null,
    cancelled: false,
    retry: run,
  });
  publish();
  void run();
  return id;
}
