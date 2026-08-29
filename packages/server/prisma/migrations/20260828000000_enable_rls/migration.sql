-- The application accesses PostgreSQL only through the NestJS backend.
-- Enable RLS without public policies so Supabase Data API roles cannot read or
-- mutate these tables. The database owner used by Prisma continues to work.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_feedback ENABLE ROW LEVEL SECURITY;

-- Remove privileges inherited through PostgreSQL's PUBLIC pseudo-role.
REVOKE ALL PRIVILEGES ON TABLE
  public.users,
  public.reviews,
  public.review_issues,
  public.review_runs,
  public.review_feedback
FROM PUBLIC;

-- Supabase defines these Data API roles, while a regular local PostgreSQL
-- installation may not. Conditional revocation keeps the migration portable.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.users, public.reviews, public.review_issues, public.review_runs, public.review_feedback FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.users, public.reviews, public.review_issues, public.review_runs, public.review_feedback FROM authenticated';
  END IF;
END
$$;
