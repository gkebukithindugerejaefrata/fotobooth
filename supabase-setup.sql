-- ============================================================
-- Bilik Foto: pengaturan Supabase
-- Jalankan sekali di Supabase Dashboard > SQL Editor > New query.
-- Aman dijalankan ulang.
-- ============================================================

-- 1. Tabel foto dan voice note -------------------------------
create table if not exists public.kenangan (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_name  text not null default '',
  author      text not null default '',
  caption     text not null default '',
  frame       text not null default '',
  photo_path  text not null,          -- file foto utama di Storage
  thumb_path  text,                   -- foto kecil untuk galeri
  voice_path  text,                   -- file voice note (boleh kosong)
  voice_type  text,
  constraint kenangan_panjang check (
    char_length(event_name) <= 80 and char_length(author) <= 60 and
    char_length(caption) <= 120 and char_length(frame) <= 60
  )
);
create index if not exists kenangan_created_idx on public.kenangan (created_at desc);

-- 2. Daftar admin --------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 3. Aturan akses tabel (RLS) --------------------------------
alter table public.kenangan enable row level security;
alter table public.admins   enable row level security;

drop policy if exists "kenangan: semua boleh lihat"  on public.kenangan;
drop policy if exists "kenangan: semua boleh tambah" on public.kenangan;
drop policy if exists "kenangan: admin ubah"         on public.kenangan;
drop policy if exists "kenangan: admin hapus"        on public.kenangan;
drop policy if exists "admins: lihat diri sendiri"   on public.admins;

create policy "kenangan: semua boleh lihat"
  on public.kenangan for select to anon, authenticated using (true);

create policy "kenangan: semua boleh tambah"
  on public.kenangan for insert to anon, authenticated
  with check (
    photo_path like 'photos/%'
    and (thumb_path is null or thumb_path like 'photos/%')
    and (voice_path is null or voice_path like 'voices/%')
  );

create policy "kenangan: admin ubah"
  on public.kenangan for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "kenangan: admin hapus"
  on public.kenangan for delete to authenticated
  using (public.is_admin());

create policy "admins: lihat diri sendiri"
  on public.admins for select to authenticated using (user_id = auth.uid());

-- 4. Storage: satu bucket untuk foto dan voice note -----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bilik-foto', 'bilik-foto', true, 5242880,   -- maksimum 5 MB per file
  array['image/jpeg','image/png',
        'audio/webm','audio/ogg','audio/mp4','audio/x-m4a','audio/mpeg',
        'audio/aac','audio/wav','audio/x-wav','audio/3gpp','audio/amr']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bilik-foto: semua boleh lihat"  on storage.objects;
drop policy if exists "bilik-foto: tamu boleh unggah"  on storage.objects;
drop policy if exists "bilik-foto: admin hapus"        on storage.objects;

create policy "bilik-foto: semua boleh lihat"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'bilik-foto');

create policy "bilik-foto: tamu boleh unggah"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'bilik-foto'
    and (storage.foldername(name))[1] in ('photos', 'voices')
  );

create policy "bilik-foto: admin hapus"
  on storage.objects for delete to authenticated
  using (bucket_id = 'bilik-foto' and public.is_admin());

-- 5. Jadikan seseorang admin ----------------------------------
-- a) Dashboard > Authentication > Users > Add user (isi email dan password).
-- b) Dashboard > Authentication > Sign In / Providers: matikan "Allow new users to sign up".
-- c) Ganti email di bawah ini, lalu jalankan barisnya:
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'email-admin@contoh.com'
-- on conflict do nothing;
