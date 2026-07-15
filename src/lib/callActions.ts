import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";

export type CallRow = {
  id: string;
  kind: "voice" | "video";
  scope: "direct" | "group";
  initiator_id: string;
  peer_id: string | null;
  group_id: string | null;
  status: "ringing" | "active" | "ended" | "missed";
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  ended_reason: string | null;
  duration_seconds: number | null;
};

export async function startDirectCall(peerId: string, kind: "voice" | "video"): Promise<CallRow> {
  const { data, error } = await supabase.rpc("call_start_direct", { _peer: peerId, _kind: kind });
  if (error) throw error;
  return data as unknown as CallRow;
}

export async function startGroupCall(groupId: string, kind: "voice" | "video"): Promise<CallRow> {
  const { data, error } = await supabase.rpc("call_start_group", { _group_id: groupId, _kind: kind });
  if (error) throw error;
  return data as unknown as CallRow;
}

export async function answerCall(callId: string): Promise<CallRow> {
  const { data, error } = await supabase.rpc("call_answer", {
    _call_id: callId,
    _device_id: getDeviceId(),
  });
  if (error) throw error;
  return data as unknown as CallRow;
}

export async function declineCall(callId: string) {
  const { error } = await supabase.rpc("call_decline", { _call_id: callId });
  if (error) throw error;
}

export async function leaveCall(callId: string) {
  const { error } = await supabase.rpc("call_leave", { _call_id: callId });
  if (error) throw error;
}

export async function endCall(callId: string, reason: string = "hangup") {
  const { error } = await supabase.rpc("call_end", { _call_id: callId, _reason: reason });
  if (error) throw error;
}

export async function timeoutCall(callId: string) {
  await supabase.rpc("call_timeout", { _call_id: callId });
}
