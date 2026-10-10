# Onboarding and transaction references — 2026-10-10

Research only. User requested references and review before implementation. Preserve approved A2 identity. No app code modified for this research.

- Onboard · checklist aktivasi by Lota Anidi: https://www.lottabydesign.xyz/work/from-black-box-to-crystal-clear-onboarding-your-first-10000-users-onchain
  Pattern: Ambil pola checklist yang dapat dilipat. Untuk kita: akun dibuat → top up simulasi → transfer pertama. Paling cocok sebagai panduan di beranda.
  Public inspiration; reusable source/license not established.
- Maiar · Start here by Glass for Breakfast / tangkapan aplikasi Maiar: https://medium.com/@GlassforBreakfast/how-to-set-up-your-maiar-wallet-3db9eb6641eb
  Pattern: Ambil urutan langkah, ikon kecil, dan indikator kemajuan. Referensi historis; isi crypto dan recovery phrase tidak masuk scope LedgerFlow.
  Public inspiration; reusable source/license not established.
- Max Wallet · pengenalan visual by Wavespace: https://dribbble.com/shots/27161439-Max-Wallet-Crypto-Wallet-Onboarding-screen
  Pattern: Alternatif pengenalan satu ide per layar. Lebih ekspresif, tetapi menambah langkah sebelum pengguna mencoba wallet. A2 tetap terang, bukan mengambil tema gelapnya.
  Public inspiration; reusable source/license not established.
- Flint · detail ringkas by Dale-Anthony: https://dribbble.com/shots/27231125-Transaction-details-Flint-Design-System
  Pattern: Ambil hirarki detail dan jarak antar informasi. Cocok untuk nominal, status, tanggal, dan referensi yang mudah dibaca; klik gambar untuk membesarkan.
  Public inspiration; reusable source/license not established.
- StartGlobal · side drawer by Vishnu Prasad V P: https://dribbble.com/shots/25982675-Transaction-Details
  Pattern: Ambil panel samping agar riwayat tetap terlihat saat membaca transaksi di desktop. Pada ponsel panel perlu ruang lebih luas.
  Public inspiration; reusable source/license not established.
- Gem Wallet · detail mobile by Gem Wallet: https://docs.gemwallet.com/blockchains/hyperevm/
  Pattern: Alternatif tampilan detail pada layar tersendiri. Ambil susunan informasi saja; tidak mengganti palet A2 dan tidak menambahkan data yang belum tersedia.
  Public inspiration; reusable source/license not established.

Recommend A: inline collapsible checklist and responsive transaction detail with print-to-PDF. B: intro screens; C: contextual empty-state guidance. User selected A on 2026-10-10. Implemented; see onboarding-transaction-results.html and qa.md. Data contract and customer ownership must be verified before implementation.

Browser QA: all six remote images loaded; desktop board visually inspected. Candidate Pixsellz gallery thumbnail did not reliably show the desired mobile composition and was replaced with an official Gem Wallet documentation capture.
