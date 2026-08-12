-- Enable pgvector for embedding storage and similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Reference knowledge base for RAG grounding of the AI assistant.
-- One row = one readable sentence/paragraph built from a source row.
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('symptom_disease', 'vitals_threshold', 'first_aid_protocol', 'drug_safety')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768) not null,
  created_at timestamptz not null default now()
);

-- Data API access grants
GRANT SELECT ON public.knowledge_base TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO service_role;

-- Row-level security: staff can read; only admins (via has_role) and the service role can write.
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read knowledge base"
  ON public.knowledge_base
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage knowledge base"
  ON public.knowledge_base
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fast cosine-similarity index. lists=100 is a reasonable default for up to ~100k rows;
-- rebuild with a higher list count if the table grows substantially.
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx
  ON public.knowledge_base
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Top-N semantic similarity search, optionally filtered by source_type.
-- cosine distance (=>) returns 0 (identical) to 2 (opposite); similarity = 1 - distance.
CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  query_embedding vector(768),
  match_count int,
  filter_source_type text default null
)
RETURNS TABLE (
  id uuid,
  source_type text,
  content text,
  metadata jsonb,
  embedding vector(768),
  created_at timestamptz,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    kb.id,
    kb.source_type,
    kb.content,
    kb.metadata,
    kb.embedding,
    kb.created_at,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base kb
  WHERE filter_source_type IS NULL OR kb.source_type = filter_source_type
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
$$;