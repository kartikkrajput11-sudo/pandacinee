import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Mints a short-lived LiveKit access token for the authenticated user to join
// the room named after the callId. Verifies the user is either the initiator
// or an invited participant of that call before issuing the token.
export const getLiveKitToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ callId: z.string().uuid(), deviceId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { callId, deviceId } = data;

    // Auth: initiator OR listed as a participant
    const { data: call } = await supabase
      .from("calls")
      .select("id, initiator_id, kind")
      .eq("id", callId)
      .maybeSingle();
    if (!call) throw new Error("Call not found");

    if (call.initiator_id !== userId) {
      const { data: part } = await supabase
        .from("call_participants")
        .select("user_id")
        .eq("call_id", callId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!part) throw new Error("Not a participant");
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_WS_URL;
    if (!apiKey || !apiSecret || !wsUrl) throw new Error("LiveKit not configured");

    const { AccessToken } = await import("livekit-server-sdk");
    const at = new AccessToken(apiKey, apiSecret, {
      identity: `${userId}:${deviceId}`,
      ttl: 60 * 60, // 1h
    });
    at.addGrant({
      room: `call_${callId}`,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    const token = await at.toJwt();
    return { token, wsUrl };
  });
