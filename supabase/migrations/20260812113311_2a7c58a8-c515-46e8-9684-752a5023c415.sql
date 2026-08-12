ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS ayurvedic_remedy text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS ayurvedic_condition text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS ayurvedic_source text;