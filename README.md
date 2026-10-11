# Bilik Foto

Photo booth berbasis web. Tamu mengambil foto, memilih bingkai PNG, merekam voice note di bawah foto, lalu hasilnya masuk ke galeri kegiatan. Data disimpan di Supabase. Pengelola menghapus foto dan voice note lewat halaman admin yang terpisah.

## Isi paket

| File | Fungsi |
| --- | --- |
| `index.html`, `app.js` | Halaman pengguna: bilik foto dan galeri |
| `admin.html`, `admin.js` | Halaman admin: masuk, lihat, hapus foto dan voice note |
| `config.js` | Pengaturan: kunci Supabase, nama kegiatan, daftar bingkai |
| `supabase-setup.sql` | Tabel, bucket Storage, dan aturan akses |
| `common.js`, `style.css` | Kode dan tampilan bersama |
| `frames/` | Bingkai PNG (3 contoh sudah ada) |

## Pasang dalam 4 langkah

**1. Siapkan Supabase**
1. Buat project di supabase.com.
2. Buka **SQL Editor**, tempel seluruh isi `supabase-setup.sql`, lalu **Run**.
3. Buka **Authentication > Users > Add user**, isi email dan kata sandi admin.
4. Buka **Authentication > Sign In / Providers**, matikan **Allow new users to sign up**.
5. Di SQL Editor, jalankan baris `insert into public.admins ...` di bagian akhir `supabase-setup.sql` setelah mengganti email-nya.

**2. Isi `config.js`**
- `SUPABASE_URL` dan `SUPABASE_ANON_KEY`: ada di **Project Settings > API**. Pakai kunci `anon` (public). Jangan pernah memakai kunci `service_role` di sini.
- `EVENT_NAME`: nama kegiatan yang tercatat pada setiap foto.

**3. Siapkan bingkai PNG** (lihat bagian di bawah).

**4. Unggah semua file ke hosting statis** (Netlify, Vercel, Cloudflare Pages, GitHub Pages). Cukup seret folder ini. Alamat harus **https**, kalau tidak kamera dan mikrofon ditolak browser. Membuka `index.html` langsung dari folder (file://) tidak akan berfungsi.

- Tamu membuka: `https://alamat-kamu/`
- Admin membuka: `https://alamat-kamu/admin.html` (tidak ditautkan dari halaman utama)

Untuk mencoba di komputer sendiri: jalankan `python3 -m http.server 8000` di folder ini, lalu buka `http://localhost:8000`. Alamat localhost boleh memakai kamera.

## Membuat bingkai PNG

- Rasio **3:4**, disarankan **1080 x 1440 piksel**, format PNG dengan transparansi.
- Bagian tempat foto muncul dibuat **transparan**. Foto ditaruh di belakang bingkai.
- Bagian di luar jendela foto sebaiknya **tidak transparan**, supaya hasil akhir (JPEG) tidak punya sudut hitam.
- Taruh file di `frames/`, lalu tambahkan satu baris di `FRAMES` pada `config.js`:

```js
{ id: 'natal', name: 'Natal', src: 'frames/natal.png', window: [60, 140, 600, 640] }
```

- `window` (opsional) adalah area foto `[x, y, lebar, tinggi]` pada ukuran acuan **720 x 960**, bukan ukuran asli PNG. Dengan `window`, foto dipas di area itu. Tanpa `window`, foto memenuhi seluruh bingkai.
- Teks pada bingkai (judul, tanggal, logo) ikut digambar di PNG. Aplikasi tidak menambahkan teks di atas bingkai.
- Bingkai harus berasal dari alamat situs yang sama dengan halaman ini.

## Cara kerja penyimpanan

- Foto utama (sekitar 1080 x 1440) dan foto kecil untuk galeri diunggah ke Storage bucket `bilik-foto` di folder `photos/`. Voice note masuk ke folder `voices/`.
- Satu baris di tabel `kenangan` mencatat nama, ucapan, bingkai, dan lokasi file.
- Siapa saja boleh melihat galeri dan menambah foto. Hanya akun di tabel `admins` yang boleh menghapus atau mengubah.
- Admin bisa menghapus voice note saja, satu foto beserta voice note-nya, atau banyak foto sekaligus.

## Catatan

- Kunci `anon` memang publik. Keamanan ada di aturan akses (RLS) yang dibuat oleh `supabase-setup.sql`.
- Unggahan terbuka untuk semua orang yang punya alamatnya. Ukuran dibatasi 5 MB per file. Jika ada penyalahgunaan, hapus lewat halaman admin.
- Voice note: format yang diterima adalah webm, ogg, m4a/mp4, mp3, aac, wav, 3gp, amr. Batas 3 MB per voice note di aplikasi.
- Jika unggahan gagal di tengah jalan, file yang sudah terunggah bisa tertinggal tanpa baris di tabel. File itu tidak tampil di galeri dan bisa dihapus manual di Storage.
