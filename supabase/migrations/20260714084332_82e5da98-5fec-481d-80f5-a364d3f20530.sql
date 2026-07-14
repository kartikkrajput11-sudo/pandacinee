REVOKE EXECUTE ON FUNCTION public.friend_profiles_for_me(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.friend_profiles_for_me(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.friend_profiles_for_me(uuid[]) TO authenticated;