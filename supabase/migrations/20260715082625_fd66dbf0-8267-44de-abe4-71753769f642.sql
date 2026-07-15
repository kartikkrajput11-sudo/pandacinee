-- Rebuild the call system: durable calls, per-participant per-device state, per-device signaling.

DROP TABLE IF EXISTS public.call_signals CASCADE;

DO $$ BEGIN CREATE TYPE public.call_kind AS ENUM ('voice','video'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.call_scope AS ENUM ('direct','group'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.call_status AS ENUM ('ringing','active','ended','missed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.call_participant_state AS ENUM ('ringing','joined','declined','left','missed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.call_signal_kind AS ENUM ('offer','answer','ice','bye'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- calls: one row per call, source of truth for status/history
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.call_kind NOT NULL,
  scope public.call_scope NOT NULL,
  initiator_id uuid NOT NULL,
  peer_id uuid,
  group_id uuid REFERENCES public.chat_groups(id) ON DELETE SET NULL,
  status public.call_status NOT NULL DEFAULT 'ringing',
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  ended_reason text,
  duration_seconds integer,
  CONSTRAINT calls_scope_target_ck CHECK (
    (scope='direct' AND peer_id IS NOT NULL AND group_id IS NULL) OR
    (scope='group'  AND group_id IS NOT NULL AND peer_id IS NULL)
  )
);
CREATE INDEX calls_initiator_idx ON public.calls (initiator_id, started_at DESC);
CREATE INDEX calls_peer_idx      ON public.calls (peer_id,      started_at DESC);
CREATE INDEX calls_group_idx     ON public.calls (group_id,     started_at DESC);

-- call_participants: one row per invited user per call. device_id records which device joined.
CREATE TABLE public.call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  device_id text,
  state public.call_participant_state NOT NULL DEFAULT 'ringing',
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id, user_id)
);
CREATE INDEX call_participants_user_state_idx ON public.call_participants (user_id, state);
CREATE INDEX call_participants_call_idx       ON public.call_participants (call_id);

-- call_signals: per-device addressed WebRTC signaling (offer/answer/ice/bye)
CREATE TABLE public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  from_user uuid NOT NULL,
  from_device text NOT NULL,
  to_user uuid NOT NULL,
  to_device text NOT NULL,
  kind public.call_signal_kind NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_signals_route_idx ON public.call_signals (call_id, to_user, to_device, created_at);
CREATE INDEX call_signals_purge_idx ON public.call_signals (created_at);

GRANT SELECT, INSERT, UPDATE ON public.calls               TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.call_participants   TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.call_signals        TO authenticated;
GRANT ALL ON public.calls, public.call_participants, public.call_signals TO service_role;

ALTER TABLE public.calls             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signals      ENABLE ROW LEVEL SECURITY;

-- Helper: is user _uid a participant (invited/joined/etc) of call _call_id, or its initiator?
CREATE OR REPLACE FUNCTION public.is_call_participant(_call_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.call_participants WHERE call_id=_call_id AND user_id=_uid)
      OR EXISTS (SELECT 1 FROM public.calls WHERE id=_call_id AND initiator_id=_uid);
$$;

-- ============ calls policies ============
CREATE POLICY "calls read for participants" ON public.calls FOR SELECT TO authenticated
USING (initiator_id = auth.uid() OR public.is_call_participant(id, auth.uid()));

CREATE POLICY "calls insert by initiator" ON public.calls FOR INSERT TO authenticated
WITH CHECK (initiator_id = auth.uid());

-- Updates to calls happen via SECURITY DEFINER RPCs; still allow initiator/participant updates as safety net.
CREATE POLICY "calls update by initiator or participant" ON public.calls FOR UPDATE TO authenticated
USING       (initiator_id = auth.uid() OR public.is_call_participant(id, auth.uid()))
WITH CHECK  (initiator_id = auth.uid() OR public.is_call_participant(id, auth.uid()));

-- ============ call_participants policies ============
CREATE POLICY "cp read for participants" ON public.call_participants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.calls c
    WHERE c.id = call_id
      AND (c.initiator_id = auth.uid() OR public.is_call_participant(c.id, auth.uid()))
  )
);

CREATE POLICY "cp insert by initiator" ON public.call_participants FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND c.initiator_id = auth.uid()));

CREATE POLICY "cp update own row" ON public.call_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ call_signals policies ============
CREATE POLICY "signals read to_user" ON public.call_signals FOR SELECT TO authenticated
USING (to_user = auth.uid());

CREATE POLICY "signals insert by participant" ON public.call_signals FOR INSERT TO authenticated
WITH CHECK (from_user = auth.uid() AND public.is_call_participant(call_id, auth.uid()));

CREATE POLICY "signals delete own" ON public.call_signals FOR DELETE TO authenticated
USING (from_user = auth.uid() OR to_user = auth.uid());

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;

-- ============ RPCs (single source of truth for state transitions) ============

CREATE OR REPLACE FUNCTION public.call_start_direct(_peer uuid, _kind public.call_kind)
RETURNS public.calls LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); c public.calls;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _peer IS NULL OR _peer = me THEN RAISE EXCEPTION 'Invalid peer'; END IF;
  IF NOT (
    _peer = (SELECT partner_id FROM public.profiles WHERE id = me)
    OR public.is_accepted_friend(_peer)
  ) THEN RAISE EXCEPTION 'Not connected to that user'; END IF;
  INSERT INTO public.calls (kind, scope, initiator_id, peer_id)
    VALUES (_kind, 'direct', me, _peer) RETURNING * INTO c;
  INSERT INTO public.call_participants (call_id, user_id, state, joined_at)
    VALUES (c.id, me,    'joined', now());
  INSERT INTO public.call_participants (call_id, user_id, state)
    VALUES (c.id, _peer, 'ringing');
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.call_start_group(_group_id uuid, _kind public.call_kind)
RETURNS public.calls LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); c public.calls; m record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_group_member(_group_id, me) THEN RAISE EXCEPTION 'Not a group member'; END IF;
  INSERT INTO public.calls (kind, scope, initiator_id, group_id)
    VALUES (_kind, 'group', me, _group_id) RETURNING * INTO c;
  INSERT INTO public.call_participants (call_id, user_id, state, joined_at)
    VALUES (c.id, me, 'joined', now());
  FOR m IN SELECT user_id FROM public.chat_group_members WHERE group_id = _group_id AND user_id <> me LOOP
    INSERT INTO public.call_participants (call_id, user_id, state) VALUES (c.id, m.user_id, 'ringing');
  END LOOP;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.call_answer(_call_id uuid, _device_id text)
RETURNS public.calls LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); c public.calls;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.call_participants
    SET state='joined', device_id=_device_id, joined_at=COALESCE(joined_at, now()), left_at=NULL
    WHERE call_id=_call_id AND user_id=me AND state IN ('ringing','left','declined','missed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Not invited or already resolved'; END IF;
  UPDATE public.calls
    SET status='active', answered_at=COALESCE(answered_at, now())
    WHERE id=_call_id AND status IN ('ringing','active');
  SELECT * INTO c FROM public.calls WHERE id=_call_id;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.call_decline(_call_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); c public.calls;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.call_participants SET state='declined', left_at=now()
    WHERE call_id=_call_id AND user_id=me AND state='ringing';
  SELECT * INTO c FROM public.calls WHERE id=_call_id;
  IF c.scope='direct' AND c.status='ringing' THEN
    UPDATE public.calls SET status='ended', ended_at=now(),
      ended_reason='declined', duration_seconds=0
      WHERE id=_call_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.call_leave(_call_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); remaining int; c public.calls;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.call_participants SET state='left', left_at=now()
    WHERE call_id=_call_id AND user_id=me AND state IN ('joined','ringing');
  SELECT COUNT(*) INTO remaining FROM public.call_participants
    WHERE call_id=_call_id AND state='joined';
  IF remaining = 0 THEN
    SELECT * INTO c FROM public.calls WHERE id=_call_id;
    UPDATE public.calls
      SET status = CASE WHEN c.answered_at IS NULL THEN 'missed'::public.call_status ELSE 'ended'::public.call_status END,
          ended_at = now(),
          ended_reason = COALESCE(ended_reason, CASE WHEN c.answered_at IS NULL THEN 'missed' ELSE 'hangup' END),
          duration_seconds = CASE WHEN c.answered_at IS NOT NULL
            THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - c.answered_at))::int) ELSE 0 END
      WHERE id=_call_id AND status IN ('ringing','active');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.call_end(_call_id uuid, _reason text DEFAULT 'hangup')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); c public.calls;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO c FROM public.calls WHERE id=_call_id;
  IF c.id IS NULL THEN RETURN; END IF;
  IF c.initiator_id <> me AND NOT public.is_call_participant(_call_id, me) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.calls
    SET status = CASE WHEN c.answered_at IS NULL THEN 'missed'::public.call_status ELSE 'ended'::public.call_status END,
        ended_at = now(),
        ended_reason = _reason,
        duration_seconds = CASE WHEN c.answered_at IS NOT NULL
          THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - c.answered_at))::int) ELSE 0 END
    WHERE id=_call_id AND status IN ('ringing','active');
  UPDATE public.call_participants
    SET state = CASE state
                  WHEN 'ringing' THEN 'missed'::public.call_participant_state
                  WHEN 'joined'  THEN 'left'::public.call_participant_state
                  ELSE state END,
        left_at = COALESCE(left_at, now())
    WHERE call_id=_call_id AND state IN ('ringing','joined');
END $$;

CREATE OR REPLACE FUNCTION public.call_timeout(_call_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.calls;
BEGIN
  SELECT * INTO c FROM public.calls WHERE id=_call_id;
  IF c.id IS NULL THEN RETURN; END IF;
  IF c.status='ringing' AND now() - c.started_at > interval '50 seconds' THEN
    UPDATE public.calls SET status='missed', ended_at=now(), ended_reason='timeout', duration_seconds=0
      WHERE id=_call_id AND status='ringing';
    UPDATE public.call_participants SET state='missed', left_at=now()
      WHERE call_id=_call_id AND state='ringing';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.purge_stale_call_signals()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.call_signals WHERE created_at < now() - interval '2 minutes';
$$;

GRANT EXECUTE ON FUNCTION
  public.is_call_participant(uuid, uuid),
  public.call_start_direct(uuid, public.call_kind),
  public.call_start_group(uuid, public.call_kind),
  public.call_answer(uuid, text),
  public.call_decline(uuid),
  public.call_leave(uuid),
  public.call_end(uuid, text),
  public.call_timeout(uuid),
  public.purge_stale_call_signals()
TO authenticated;