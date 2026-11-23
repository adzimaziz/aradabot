# AR ADAbot

ADAbot dalam AR di telefon. Laman statik sahaja: **tiada server, tiada API Claude, tiada log masuk**, jadi sesiapa boleh buka tanpa makan kredit.

- **Scan lantai:** halakan kamera ke lantai dan gerakkan telefon perlahan-lahan. Bila cincin merah muncul, ketik skrin, ADAbot keluar.
- **Gerak:** joystick (kiri bawah) atau ketik mana-mana tempat atas lantai.
- **Saiz:** gelangsar "Saiz" (5%–200%) atau cubit skrin dengan dua jari.
- **ADAprime:** butang ⚡ Jadi ADAprime (transformasi penuh). ADAprime boleh menari (dengan lagu), lompat, terbang, duduk, pusing, dipanggil. ↩ untuk balik jadi ADAbot.
- **⌖** alih ADAbot ke permukaan lain, **🔊** bunyi, **✕** keluar.

## Telefon yang disokong
- **Android + Chrome:** AR penuh (WebXR, scan lantai).
- **iPhone (Safari):** "AR giroskop". Safari belum sokong WebXR, jadi lantai tak boleh di-scan betul-betul; ADAbot dikunci atas lantai guna giroskop telefon. Benarkan kamera dan *Motion & Orientation*. Berdiri di satu tempat dan pusing telefon; kalau berjalan, ADAbot ikut sekali.
- **PC / tanpa giroskop:** "mod kamera" (robot atas gambar kamera).

Perlu **https** (GitHub Pages dah https).

## Hosting (GitHub Pages)
Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`. Pautan: `https://adzimaziz.github.io/aradabot/`.

## Ujian di PC
```bash
python -m http.server 8090
```
Buka http://localhost:8090 (mod kamera; AR perlukan telefon).

## Fail
- `js/app.js` – AR (hit-test, dom-overlay), joystick, ketik, cubit, butang
- `js/prime.js` – ADAprime (sama seperti VR ADAbot, tambah `steer` dan `goTo` untuk kawalan telefon)
- `js/sfx.js` – bunyi 3D
- `assets/` – model 3D, tarian (`dance/`), bunyi (`sfx/`), ikon
