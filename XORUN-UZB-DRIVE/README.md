# XORUN UZB DRIVE 🇺🇿

Brauzerda ishlaydigan haqiqiy 3D haydash va parking o‘yini — UZB Parking uslubida. Three.js, backend yo‘q, build qadam yo‘q.

- **Map:** KICHIK ITTIFOQ — TOSHKENT VILOYATI (aniq geografik nusxa emas; Kichik Ittifoqdan ilhomlangan o‘zbekona mahalla muhiti)
- **Mashina:** Chevrolet Cobalt — 3D lofted kuzov

---

## Bu safar nima o‘zgardi

### 1. Mashina endi qutilardan yig‘ilmagan

Avvalgi versiyada kuzov `BoxGeometry` lardan yasalgan edi — shuning uchun u primitive ko‘rinardi. Endi kuzov **loft** usulida quriladi: mashina uzunligi bo‘ylab 15 ta **kesim** (burun → kapot → oyna tagi → old oyna → tom → orqa oyna → bagaj → orqa) jadval sifatida beriladi va bu kesimlar uchburchaklar bilan “terisi qoplanadi”.

Aynan shu narsa haqiqiy avtomobil siluetini beradi: qiya kapot, qiya old oyna, egilgan yelka chizig‘i, toraygan orqa qism. Kuzov faqat o‘zi **~300 ta uchburchak**dan iborat.

Yelka chizig‘i bilan tom qirrasi orasidagi bel qismi alohida **shisha materiali** bilan chiqariladi — shuning uchun old oyna, yon oynalar va orqa oyna bitta loftdan kelib chiqadi.

Qolgan detallar: 4 ta g‘ildirak (shina + disk + 5 spitsa + xrom qalpoq), old faralar + haqiqiy yorug‘lik nuri, burilish chiroqlari, orqa stop chiroqlar, orqaga yurish chirog‘i, old va orqa bamper, xrom panjara (Chevrolet uslubida), yon ko‘zgular (qo‘l + korpus + oyna), eshik chiziqlari va tutqichlari, yon himoya lentasi, kapot va bagaj chiziqlari, raqam taxtasi, chiqindi trubasi, oynatozalagichlar, salon (panel, ikkita o‘rindiq, rul) va soya.

### 2. Mahalladagi boshqa mashinalar ham xuddi shunday model

Ko‘chada turgan mashinalar endi quti emas — ular **aynan o‘sha 3D model**dan: Nexia, Gentra, Spark, Damas, Malibu. Ya’ni mahalla haqiqiy o‘zbek mashinalari bilan to‘lgan, va ularning har biri garajda ochilganda o‘sha modelni haydaysiz.

### 3. Men o‘yinni ko‘rmasdan qoldirmadim

Brauzerni ishlata olmaganim uchun `tools/render.js` ichida **o‘z software rendererimni** yozdim: u Three.js bilan mos geometriya yaratadi, sahna grafini aylanib chiqadi, kamerani qo‘yadi, z-bufer va Lambert soyalash bilan uchburchaklarni rasterizatsiya qiladi va PNG chiqaradi. Orqa tomonga qaragan yuzalar `MeshStandardMaterial` dagidek qirqiladi, shuning uchun noto‘g‘ri winding brauzerdagidek ko‘rinadi.

Shu yo‘l bilan topilgan va tuzatilgan **haqiqiy xatolar**:

| Xato | Oqibati |
|---|---|
| `map.js` → `window.taperBoxGeometry` endi mavjud emas edi | **Sahna umuman qurilmasdi — PLAY ishlamasdi** |
| Tom konusi uy tomining yuziga aniq tekkan edi | Tomlarda z-fighting (yo‘l-yo‘l dog‘lar) |
| Panjara va bamper kuzov ichida edi | Old tomonda qizil “shovqin” |
| Ustun (pillar) qutilari tomdan chiqib turardi | Mashinada qora tayoqchalar |
| G‘ildirak kamarlari noto‘g‘ri joyda edi | Mashina yonida qora bo‘laklar |
| Kuzov g‘ildiraklarga juda past o‘tirgan edi | Mashina “cho‘kkan” ko‘rinardi |

`tools/preview/` papkasida shu rendererning natijalari bor. Brauzeringizdagi ko‘rinish shularga o‘xshashi kerak:

| Fayl | Nima |
|---|---|
| `car-hero.png`, `car-side.png`, `car-front.png`, `car-rear.png` | Cobalt to‘rt tomondan |
| `drive-start.png` | PLAY bosgandan keyin ko‘rinadigan birinchi kadr |
| `drive-mahalla.png` | Uylar orasida haydash |
| `drive-junction.png` | Chorraha va zebra |
| `drive-parking-approach.png` | Parkingga burilish |
| `parked.png` | Sariq chiziq ichida to‘g‘ri qo‘yilgan holat |
| `overview.png` | Butun levelning yuqoridan ko‘rinishi |
| `garage-lineup.png` | Oltita mashina yonma-yon |

Qayta chizish: `node tools/preview.js`

---

## Ishga tushirish (VS Code)

1. `XORUN-UZB-DRIVE` papkasini VS Code'da oching.
2. **Live Server** kengaytmasini o‘rnating (Ritwick Dey).
3. `index.html` ustida o‘ng tugma → **Open with Live Server**.

Yoki: `python3 -m http.server 8080` → `http://localhost:8080`

Internetsiz: `three.min.js` (r128) ni yuklab olib `vendor/three.min.js` sifatida saqlang.

---

## O‘yin oqimi

```
MAIN MENU  →  PLAY  →  3D KICHIK ITTIFOQ  →  3D COBALT  →  DRIVE  →  PARKING  →  COMPLETED
```

3D dunyo **sahifa ochilishi bilanoq** quriladi va menyu ortida ko‘rinib turadi — mahalla, ko‘cha va Cobalt aylanib turadi. PLAY hech narsa yuklamaydi, faqat kamerani mashina orqasiga olib o‘tadi va rulni beradi.

1. START — ko‘chaning boshida.
2. Ko‘cha bo‘ylab haydang: chorraha, zebra, uylar, temir darvozalar, do‘konlar, elektr ustunlari, ko‘cha chiroqlari, daraxtlar, turgan mashinalar.
3. Ekrandagi sariq strelka parkinggacha yo‘nalish va masofani ko‘rsatadi.
4. Chap tomondagi parking maydoniga kiring, **sariq chiziqli joyga** mashinani qo‘ying.
5. To‘g‘rilang, to‘xtang, bir lahza ushlab turing → **PARKING COMPLETED! +100 COINS +XP +SCORE**.

Parking faqat mashina joy **ichida** bo‘lsa va **juda qiya turmagan** bo‘lsa hisoblanadi. Orqa bilan kirsangiz ham bo‘ladi.

## Boshqaruv

| Tugma | Vazifa |
|---|---|
| `W` / `↑` | Gaz |
| `S` / `↓` | Orqaga |
| `A` / `←` | Chapga |
| `D` / `→` | O‘ngga |
| `Space` | Tormoz |
| `R` | STARTga qaytarish |
| `Esc` | Menyu |

Telefonda katta sensorli tugmalar avtomatik chiqadi (GAZ, ORQAGA, TORMOZ, ◀ ▶).

---

## Garaj va unlock arxitekturasi

| Mashina | Kuzov | Uzunlik | Holat | Narx |
|---|---|---|---|---|
| Chevrolet Cobalt | sedan | 4.48 m | **OPEN** | — |
| Chevrolet Spark | xetchbek | 3.64 m | 🔒 LOCKED | 450 🪙 |
| Chevrolet Nexia | sedan | 4.24 m | 🔒 LOCKED | 600 🪙 |
| Chevrolet Damas | yukchi | 3.56 m | 🔒 LOCKED | 700 🪙 |
| Chevrolet Gentra | sedan | 4.52 m | 🔒 LOCKED | 900 🪙 |
| Chevrolet Malibu | sedan | 4.92 m | 🔒 LOCKED | 1500 🪙 |

Har bir mashina `VEHICLE_DEFS` da bitta yozuv: kuzov turi (`sedan` / `hatch` / `van`), uzunlik, kenglik, balandlik, g‘ildirak radiusi, rang, tezlik, unlock narxi. Uchta kuzov profili `BODY_PROFILES` da — yangi model qo‘shish uchun yangi kesimlar jadvalini yozish kifoya, qolgan hamma narsa (oynalar, faralar, g‘ildiraklar, fizika) avtomatik moslashadi.

Parking uchun tanga olasiz; tanga yetganda garajda **Ochish** tugmasi faollashadi. Tanga, XP va ochilgan mashinalar `localStorage` da saqlanadi.

---

## Tekshiruv: 80 ta test

```bash
node test-gameplay.js    # 40 ta
node test-browser.js     # 40 ta
node tools/preview.js    # rasmlarni qayta chizadi
```

`test-gameplay.js` — haqiqiy `car.js`, `map.js`, `parking.js` ni ishlatadi: kuzov haqiqatan loft ekani (300+ uchburchak), oynalar chiqqani, oltita mashina ham xatosiz qurilishi, W oldinga yurishi, **A ekranning chap tomoniga, D o‘ng tomoniga burishi** (kamera proyeksiyasi bilan tekshiriladi), tormoz, reverse, binoga urilib ichidan o‘tib ketmasligi, xaritadan chiqib ketmasligi, parking to‘g‘ri/qiya/harakatdagi/tashqaridagi holatlarni to‘g‘ri baholashi, va STARTdan parkinggacha to‘liq yo‘l — bitta ham to‘qnashuvsiz.

`test-browser.js` — brauzerni simulyatsiya qiladi: `index.html` dagi tartibda skriptlarni yuklaydi, **PLAY ni bosadi**, klaviatura hodisalarini yuboradi, haqiqiy o‘yin siklini aylantiradi va **kamera mashina orqasida, 6–14 m masofada, tepada turishini** tekshiradi. Shuningdek: parking natija oynasi, +100 coins, XP, vaqt, tanga saqlanishi, garaj, ikkinchi marta PLAY.

Agar Three.js umuman yuklanmasa: PLAY xato bermaydi, menyu ishlayveradi, zaxira CDN'lar sinaladi, holat ekranda yoziladi.

---

## Tuzilishi

```
XORUN-UZB-DRIVE/
├── index.html
├── css/style.css
├── js/
│   ├── three-fallback.js   # zaxira CDN'lar
│   ├── ui.js               # menyu, garaj, HUD, saqlash
│   ├── controls.js         # klaviatura + sensor
│   ├── car.js              # LOFT 3D kuzov + fizika + to‘qnashuv
│   ├── map.js              # Kichik Ittifoq mahallasi
│   ├── parking.js          # parking tekshiruvi
│   └── main.js             # renderer, sahna, kamera, o‘yin sikli
├── tools/
│   ├── render.js           # offline software renderer (PNG)
│   ├── preview.js          # ko‘rinishlarni chizadi
│   └── preview/*.png       # mos yozuvlar rasmlari
├── vendor/                 # offline uchun three.min.js
├── test-gameplay.js
├── test-browser.js
└── README.md
```

Texnik eslatma: mashina mesh’i lokal `-Z` ga qaraydi → heading 0 = dunyo `-Z`, oldinga vektor `(-sin h, 0, -cos h)`. Three.js kamerasi lokal `-Z` ga qaraydi, shuning uchun `+Z` tomonga qaragan kamerada dunyo `+X` **ekranning chap tomoni** bo‘ladi — rul yo‘nalishi shunga qarab tekshirilgan.

---

## YANGI: FREE DRIVE rejimi

PLAY bosilganda o'yin endi **parking topshirig'i bilan cheklanmaydi** — Kichik Ittifoq mapida erkin haydaysiz. Parking ixtiyoriy: xohlagan paytingizda qilasiz, o'yin to'xtamaydi.

| Nima | Qayerda |
|---|---|
| **Traffic** — Cobalt, Nexia, Gentra, Spark, Damas ko'chada ikki yo'nalishda doim yuradi, oldidagiga yaqinlashsa sekinlashadi, player ularni quvib o'tadi, to'qnashuv bor | `js/traffic.js` (yangi) |
| **3 ta mission** — 1) parking qilish 2) belgilangan joyga borish 3) 60 sekund ichida checkpointga yetish; navbat bilan takrorlanadi, sariq halqa (marker) nishonni ko'rsatadi | `js/missions.js` (yangi) |
| **Mukofot** — to'g'ri park qilinsa **+100 COINS, +50 XP**, har 200 XP da **LEVEL** oshadi | `js/ui.js` → `addReward()` |
| **HUD** — LEVEL, XP, COINS, SPEED, MISSION | `index.html` + `css/style.css` |

`car.js`, `map.js`, `parking.js` va kamera tizimiga tegilmagan. `main.js` da faqat o'yin sikli va mukofot mantig'i o'zgargan: parking endi `complete()` (o'yinni to'xtatuvchi) emas, `awardParking()` (mukofot berib, haydashni davom ettiruvchi).

Testlar: `node test-browser.js` → **49 ta** (traffic va mission bo'limlari qo'shildi), `node test-gameplay.js` → 40 ta.
