-- ============================================================
-- SETUP RECENSIONI — esegui UNA VOLTA in Supabase → SQL Editor
-- Dopo questa operazione il form recensioni del sito e il tab
-- "Recensioni" dell'Area Riservata funzionano subito.
-- ============================================================

create table if not exists public.site_reviews (
  id bigint generated always as identity primary key,
  nome text not null,
  testo text not null,
  rating int not null default 5 check (rating between 1 and 5),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.site_reviews enable row level security;

-- Permessi di base
grant select, insert on public.site_reviews to anon;
grant select, insert, update, delete on public.site_reviews to authenticated;

-- Il pubblico può INVIARE recensioni (nascono sempre non approvate)
drop policy if exists reviews_anon_insert on public.site_reviews;
create policy reviews_anon_insert on public.site_reviews
  for insert to anon with check (approved = false);

-- Il pubblico LEGGE solo le recensioni approvate
drop policy if exists reviews_anon_select on public.site_reviews;
create policy reviews_anon_select on public.site_reviews
  for select to anon using (approved = true);

-- L'admin autenticato (Area Riservata) può tutto
drop policy if exists reviews_auth_all on public.site_reviews;
create policy reviews_auth_all on public.site_reviews
  for all to authenticated using (true) with check (true);
