// Pengaturan Bilik Foto. Ubah isi file ini, lalu unggah ulang ke hosting.
window.BILIK_CONFIG = {
  // Dari Supabase Dashboard > Project Settings > API
  SUPABASE_URL: 'https://gyvtrcbwojttygfhgazy.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_Rx2vDmqFrpBxJ_rph7aReg_lgtZJHIw',

  // Nama bucket Storage (sama dengan di supabase-setup.sql)
  BUCKET: 'bilik-foto',

  // Judul di bagian atas halaman dan nama kegiatan yang tercatat di galeri
  TITLE: 'Galeri Jemaat',
  EVENT_NAME: 'Hari Kesejahteraan Keluarga',

  // Batas panjang voice note saat merekam (detik)
  MAX_RECORD_SECONDS: 30,

  // Daftar bingkai. Taruh file PNG di folder frames/, lalu tambahkan barisnya di sini.
  //  id     : nama pendek tanpa spasi
  //  name   : nama yang tampil di bawah gambar kecil
  //  src    : lokasi file PNG
  //  window : (opsional) area foto [x, y, lebar, tinggi] pada ukuran 720 x 960.
  //           Jika diisi, foto dipas di area itu. Jika kosong, foto memenuhi seluruh bingkai.
  // Ukuran PNG: rasio 3:4, disarankan 1080 x 1440 piksel. Bagian foto dibuat transparan.
  FRAMES: [
    { id: 'contoh-biru',  name: 'Biru',  src: 'frames/contoh-biru.png',  window: [60, 140, 600, 640] },
    { id: 'contoh-putih', name: 'Putih', src: 'frames/contoh-putih.png', window: [36, 36, 648, 756] },
    { id: 'contoh-emas',  name: 'Emas',  src: 'frames/contoh-emas.png',  window: [70, 70, 580, 680] }
  ]
};
