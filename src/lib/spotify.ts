// Spotify Web API — Authorization Code with PKCE (browser-only, no secret).
// Docs: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

export const SPOTIFY_CLIENT_ID = "d3dc93ce19894aa4a6cccd6860bf6f2a";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-library-read",
  "user-top-read",
  "user-read-recently-played",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

const LS_TOKENS = "pandacine.spotify.tokens.v1";
const LS_VERIFIER = "pandacine.spotify.verifier";

type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms epoch
  token_type: string;
  scope: string;
};

export type SpotifyImage = { url: string; width?: number | null; height?: number | null };
export type SpotifyArtist = { id: string; name: string };
export type SpotifyTrack = {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: { id: string; name: string; images: SpotifyImage[] };
  duration_ms: number;
  uri: string;
};
export type SpotifyPlaylist = {
  id: string;
  name: string;
  images: SpotifyImage[];
  owner: { display_name?: string };
  tracks: { total: number };
};
export type SpotifyMe = {
  id: string;
  display_name: string | null;
  email: string;
  images: SpotifyImage[];
  product: "premium" | "free" | "open" | string;
};

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string): Promise<Uint8Array> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(hash);
}

function randomString(len = 64): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return b64url(bytes).slice(0, len);
}

export function spotifyRedirectUri(): string {
  return `${window.location.origin}/app/music`;
}

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(LS_TOKENS);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

function setTokens(t: Tokens) {
  localStorage.setItem(LS_TOKENS, JSON.stringify(t));
}

export function spotifyDisconnect() {
  localStorage.removeItem(LS_TOKENS);
  localStorage.removeItem(LS_VERIFIER);
}

export async function startSpotifyLogin() {
  const verifier = randomString(96);
  // Use localStorage (not sessionStorage) so the verifier survives across
  // tabs — auth completes in a fresh top-level tab that doesn't share
  // sessionStorage with the caller.
  localStorage.setItem(LS_VERIFIER, verifier);
  const challenge = b64url(await sha256(verifier));
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: spotifyRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
  });
  const url = `${AUTH_URL}?${params.toString()}`;
  // Open Spotify auth in a new top-level tab. This escapes the Lovable
  // editor iframe (Spotify refuses to render inside iframes) and avoids the
  // preview's fetch proxy for the token exchange POST.
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Popup blocked — fall back to same-tab redirect. Users in the editor
    // iframe should test on the preview or published URL for this to work.
    window.location.href = url;
  }
}


export async function completeSpotifyLogin(code: string): Promise<Tokens> {
  const verifier = localStorage.getItem(LS_VERIFIER) ?? sessionStorage.getItem(LS_VERIFIER);
  if (!verifier) throw new Error("Missing PKCE verifier — try logging in again.");

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: spotifyRedirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify token exchange failed: ${res.status} ${t}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };
  const tokens: Tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 - 30_000,
    token_type: data.token_type,
    scope: data.scope,
  };
  setTokens(tokens);
  sessionStorage.removeItem(LS_VERIFIER);
  return tokens;
}

async function refreshTokens(t: Tokens): Promise<Tokens> {
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: t.refresh_token,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    spotifyDisconnect();
    throw new Error("Spotify session expired — please reconnect.");
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };
  const next: Tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? t.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 - 30_000,
    token_type: data.token_type,
    scope: data.scope,
  };
  setTokens(next);
  return next;
}

async function accessToken(): Promise<string | null> {
  let t = getTokens();
  if (!t) return null;
  if (Date.now() >= t.expires_at) t = await refreshTokens(t);
  return t.access_token;
}

export async function spotifyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error("Not connected to Spotify");
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    spotifyDisconnect();
    throw new Error("Spotify session expired — please reconnect.");
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify API ${res.status}: ${t}`);
  }
  return (await res.json()) as T;
}

export async function getMe() {
  return spotifyFetch<SpotifyMe>("/me");
}

export async function getMyPlaylists() {
  const data = await spotifyFetch<{ items: SpotifyPlaylist[] }>("/me/playlists?limit=50");
  return data.items;
}

export async function getTopTracks() {
  const data = await spotifyFetch<{ items: SpotifyTrack[] }>("/me/top/tracks?limit=30&time_range=medium_term");
  return data.items;
}

export async function searchTracks(q: string) {
  const params = new URLSearchParams({ q, type: "track", limit: "25" });
  const data = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(`/search?${params}`);
  return data.tracks.items;
}

export function isSpotifyConnected(): boolean {
  return getTokens() !== null;
}
