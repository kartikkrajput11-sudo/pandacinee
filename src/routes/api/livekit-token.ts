import { createFileRoute } from '@tanstack/react-router'
import { AccessToken } from 'livekit-server-sdk'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/livekit-token
 * Body: { call_id: string, room?: string }
 *
 * Requires a Supabase user bearer token in Authorization: Bearer <token>.
 * The caller must be a participant of the given call (call_participants row)
 * or the initiator. Returns { url, token, room }.
 */
export const Route = createFileRoute('/api/livekit-token')({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'authorization, content-type',
          },
        }),
      POST: async ({ request }) => {
        const cors = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }

        const auth = request.headers.get('authorization') ?? ''
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
        if (!token) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: cors,
          })
        }

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } },
        )

        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr || !userRes.user) {
          return new Response(JSON.stringify({ error: 'Invalid session' }), {
            status: 401,
            headers: cors,
          })
        }
        const uid = userRes.user.id

        let body: { call_id?: string; room?: string } = {}
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Bad JSON' }), { status: 400, headers: cors })
        }
        const callId = body.call_id
        if (!callId || typeof callId !== 'string') {
          return new Response(JSON.stringify({ error: 'call_id required' }), {
            status: 400,
            headers: cors,
          })
        }

        // Authorize: caller must be a participant of the call (RLS enforces this).
        const { data: part } = await supabase
          .from('call_participants')
          .select('user_id')
          .eq('call_id', callId)
          .eq('user_id', uid)
          .maybeSingle()
        if (!part) {
          return new Response(JSON.stringify({ error: 'Not a participant' }), {
            status: 403,
            headers: cors,
          })
        }

        const roomName = body.room ?? `calls-${callId}`
        const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
          identity: uid,
          ttl: 60 * 60, // 1 hour
        })
        at.addGrant({
          room: roomName,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        })
        const jwt = await at.toJwt()

        return new Response(
          JSON.stringify({
            url: process.env.LIVEKIT_WS_URL,
            token: jwt,
            room: roomName,
          }),
          { status: 200, headers: cors },
        )
      },
    },
  },
})
