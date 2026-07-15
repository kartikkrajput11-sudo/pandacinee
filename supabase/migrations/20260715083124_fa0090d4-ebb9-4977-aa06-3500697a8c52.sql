-- Revoke default PUBLIC execute on the new call RPCs so only authenticated users
-- (and service_role) can call them. Postgres grants EXECUTE to PUBLIC by default
-- on new functions; that trips the "Public Can Execute SECURITY DEFINER" linter.

REVOKE EXECUTE ON FUNCTION public.is_call_participant(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_start_direct(uuid, public.call_kind) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_start_group(uuid, public.call_kind) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_answer(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_decline(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_leave(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_end(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_timeout(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_stale_call_signals() FROM PUBLIC;

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
TO authenticated, service_role;