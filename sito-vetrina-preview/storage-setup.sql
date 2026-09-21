-- ============================================================
-- SETUP STORAGE IMMAGINI — esegui UNA VOLTA in Supabase → SQL Editor
-- Crea il bucket "site-images" usato dall'Area Riservata per
-- caricare foto (galleria, hero, servizi, news).
-- ============================================================

-- Bucket pubblico (le immagini devono essere leggibili dal sito)
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

-- Lettura pubblica delle immagini
drop policy if exists site_images_public_read on storage.objects;
create policy site_images_public_read on storage.objects
  for select to public using (bucket_id = 'site-images');

-- Scrittura solo per admin autenticati (Area Riservata)
drop policy if exists site_images_auth_insert on storage.objects;
create policy site_images_auth_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'site-images');

drop policy if exists site_images_auth_update on storage.objects;
create policy site_images_auth_update on storage.objects
  for update to authenticated using (bucket_id = 'site-images');

drop policy if exists site_images_auth_delete on storage.objects;
create policy site_images_auth_delete on storage.objects
  for delete to authenticated using (bucket_id = 'site-images');
