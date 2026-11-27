# Hermes Affiliate Playbook (InstaBox `affiliate`)

Mesin ini memiliki Chromium yang sudah login akun **Threads** dan **Shopee Affiliate** pada `DISPLAY=:1` (terlihat live di tab `Computer` InstaBox).

Gunakan tool `bctl` lewat `mcp__instabox__exec` — kursor mouse akan otomatis memfokuskan Chromium, meluncur halus, dan mengklik secara live di layar!

## Perintah `bctl`
- `bctl tabs` — Lihat tab Chromium yang terbuka & koordinat kliknya.
- `bctl tab shopee` / `bctl tab threads` — Pindah ke tab Shopee Affiliate atau Threads (dengan verifikasi judul tab + fallback `Ctrl+1/2`).
- `bctl read` — Baca teks halaman aktif & tombol-tombol beserta koordinat layar `(x, y)` siap klik.
- `bctl read "Buat Link"` / `bctl read "s.shopee"` — Filter elemen tertentu di layar (termasuk langsung membaca link `https://s.shopee.co.id/...` dari kotak popup!).
- `bctl click <x> <y>` — Fokuskan Chromium, gerakkan kursor dengan halus ke `(x, y)`, lalu klik kiri.
- `bctl type "<teks>"` — Ketik teks dengan ritme manusia (`45-90ms/karakter`).
- `bctl paste "<teks>"` — Tempel teks UTF-8 / emoji / URL via clipboard non-blocking.
- `bctl key "<tombol>"` — Tekan tombol (`Return`, `Escape`, `ctrl+a`, `BackSpace`, `Page_Down`).
- `bctl scroll down 6` / `bctl scroll up 6` — Scroll halaman dengan halus.
- `bctl goto "<url>"` — Fokuskan Chromium, klik address bar, dan buka URL baru.
- `bctl clip` / `bctl clear-clip` — Baca atau bersihkan clipboard (cek link `https://s.shopee.co.id/...`).
- `bctl wait 3` — Tunggu halaman selesai loading.

## Aturan Ketat Affiliate & Anti-Ban
1. **WAJIB pakai link Shopee Affiliate asli milik user**: Ambil dari tab `Shopee Affiliate` -> klik `Buat Link` -> baca langsung dengan `bctl read "s.shopee"` atau klik `Salin Link` lalu `bctl clip`. DILARANG KERAS mengarang link `s.shopee.co.id`.
2. **Gaya balasan Threads natural**: Santai seperti teman Indonesia ("gua", "kemarin ambil ini", "so far awet", "kalau budget segitu"). DILARANG memakai bahasa jualan kaku ("Halo kak", "Yuk diorder", "Cek keranjang kuning").
3. **Anti-Ban**: Beri jeda minimal 45–90 detik antar komentar, jangan spam, maksimal sesuai batas yang diminta user.
4. **CAPTCHA / Verifikasi**: Jika muncul CAPTCHA atau halaman login ulang, BERHENTI dan laporkan ke user agar klik manual di tab Computer InstaBox. Jangan pernah mencoba bypass CAPTCHA.
