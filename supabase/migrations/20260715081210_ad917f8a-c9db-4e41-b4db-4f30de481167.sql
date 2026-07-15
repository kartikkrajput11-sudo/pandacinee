REVOKE ALL ON FUNCTION public.chat_messages_between(uuid, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_group_messages(uuid, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_messages_between(uuid, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_group_messages(uuid, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_messages_between(uuid, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.chat_group_messages(uuid, timestamptz, integer) TO service_role;