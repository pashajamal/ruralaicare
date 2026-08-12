ALTER FUNCTION public.match_knowledge_base(vector(768), int, text) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.match_knowledge_base(vector(768), int, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_knowledge_base(vector(768), int, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge_base(vector(768), int, text) TO authenticated;