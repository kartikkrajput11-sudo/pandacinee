import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

/**
 * Phase 22 — Server-side FCM dispatcher.
 *
 * Callable from server functions (or `pg_net`) to fan out a push to every
 * device token belonging to a target user. Verifies a shared PUSH_SECRET
 * so only trusted callers can trigger a fan-out.
 *
 * Body: { user_id, title, body, data }
 */

const Body = z.object({
  user_id: z.string().uuid(),
  title: z.string().max(200).optional(),
  body: z.string().max(500).optional(),
  data: z.record(z.string()).optional(),
});

async function getAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson) as {
    client_email: string;
    private_key: string;
    token_uri: string;
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const unsigned = `${enc(header)}.${enc(claims)}`;

  const { createSign } = await import('crypto');
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const sig = signer
    .sign(sa.private_key)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsigned}.${sig}`;
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('FCM token exchange failed');
  return json.access_token;
}

export const Route = createFileRoute('/api/public/push-dispatch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get('x-push-secret');
        if (!secret || secret !== process.env.PUSH_SECRET) {
          return new Response('Unauthorized', { status: 401 });
        }

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return new Response('Bad request', { status: 400 });
        }

        const saJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
        const projectId = process.env.FCM_PROJECT_ID;
        if (!saJson || !projectId) {
          return new Response('FCM not configured', { status: 500 });
        }

        const { supabaseAdmin } = await import(
          '@/integrations/supabase/client.server'
        );

        const { data: tokens } = await (supabaseAdmin as any)
          .from('device_tokens')
          .select('token')
          .eq('user_id', parsed.user_id) as { data: { token: string }[] | null };

        if (!tokens || tokens.length === 0) {
          return Response.json({ sent: 0 });
        }

        const accessToken = await getAccessToken(saJson);
        const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

        let sent = 0;
        await Promise.all(
          tokens.map(async ({ token }) => {
            const message = {
              message: {
                token,
                notification:
                  parsed.data?.type === 'call'
                    ? undefined
                    : {
                        title: parsed.title ?? 'PANDACINE',
                        body: parsed.body ?? '',
                      },
                data: parsed.data ?? {},
                android: {
                  priority: 'HIGH',
                },
              },
            };
            const res = await fetch(url, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(message),
            });
            if (res.ok) sent += 1;
            else if (res.status === 404 || res.status === 400) {
              // Token is dead — prune it.
              await supabaseAdmin
                .from('device_tokens')
                .delete()
                .eq('token', token);
            }
          }),
        );

        return Response.json({ sent, total: tokens.length });
      },
    },
  },
});
