// Helpers to normalize third-party video URLs that can't be played by
// a native <video> tag (Google Drive, Dropbox share links, etc.) into
// embeddable iframe sources.

const DRIVE_ID = /drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+)|uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+))/;

export function extractDriveId(url: string): string | null {
  const m = DRIVE_ID.exec(url);
  return m ? (m[1] || m[2] || m[3] || null) : null;
}

export function isDriveUrl(url: string | null | undefined): boolean {
  return !!url && !!extractDriveId(url);
}

export function driveEmbedUrl(url: string): string | null {
  const id = extractDriveId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

/** Dropbox share links serve the player page unless ?raw=1 is appended. */
export function normalizeDropboxUrl(url: string): string {
  if (!/dropbox\.com\//.test(url)) return url;
  return url
    .replace(/\?dl=0/, "?raw=1")
    .replace(/([?&])dl=0(&|$)/, "$1raw=1$2");
}

/**
 * If the URL cannot be played by <video>, return an iframe embed URL.
 * Otherwise return null (caller uses the native player).
 */
export function toEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (isDriveUrl(url)) return driveEmbedUrl(url);
  return null;
}
