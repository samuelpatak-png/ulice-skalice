// Centrum 1 — Gorkého, Štefánikova (1. úsek), Kráľovská.
// Spracované sú 1. úsek Gorkého (OSM way 38417436, (250.0,-163.5) -> (308.0,-132.8)) a 1. úsek Štefánikovej
// (OSM way 1299698076, (120.6,-182.1) -> (-1.8,-123.9)), oboje Street View 10/2022 + satelit. Kráľovská príde neskôr.
// Prieskum: balíky centrum1/Gorkého a centrum1/Štefánikova (looks.txt, ploty.txt, zariadenie.txt, trasa.md).
// Stanoviská Gorkého G0..G4, kalibrované polohy kamier
// G0 (310.7,-137.1) G1 (291.0,-142.0) G2 (273.5,-151.8) G3 (263.1,-157.7) G4 (245.5,-171.4) — o ~1.8 m západnejšie ako panoramy.json.
// Stanoviská Štefánikovej Š0..Š9: Š0 (119.65,-184.46) Š1 (103.27,-173.19) Š2 (94.68,-169.68) Š3 (76.07,-160.46) Š4 (66.79,-156.39)
// Š5 (48.31,-148.11) Š6 (38.88,-143.92) Š7 (21.23,-134.31) Š8 (11.92,-129.83) Š9 (2.70,-124.57).
//
// Pomocné súradnice prieskumu Gorkého: s = vzdialenosť pozdĺž osi ulice od (256.2,-159.5) smerom 117° (VJV), t = kolmo (+ sever, − juh).
// Herné x = východ, z = juh. Prepočet: p = (256.2 + 0.8910·s + 0.4540·t, −159.5 + 0.4540·s − 0.8910·t).
// Štefánikova má os lomenú (OSM): (120.6,-182.1) → (114.0,-180.2) s 6.9 → (83.4,-167.0) s 40.2 → (51.5,-151.0) s 75.9 → (-1.8,-123.9) s 135.7;
// t je kolmo na práve platný úsek, + = sever (park a dláždená plocha), − = juh (radnica a rad domov). Smer ulice od námestia 254° → 243°.
//
// PREPOČET SMEROV: prieskum udáva `dir` v stupňoch od severu (0 = sever, rastie v smere hodinových ručičiek), kód pracuje
// s matematickým uhlom v rovine x–z (0 = +x = východ, rastie k +z = juh). Platí  uhol_kódu = dir − 90:
//   • `looks[].ang` (smer hrebeňa): Gorkého 117 → 27, Štefánikova 243 → 153.
//   • `lots.lamps[].a` (os ramien kandelábra): ramená kolmo na ulicu, dir 153 → a 63.
//   • `furniture` typu `bench`: `ang` je os sedadla, teda ešte o 90° menej než smer pohľadu sediaceho: ang = dir − 180 (dir 153 → ang 333).
//   • `furniture` typu `adColumn`: `rot` je v otáčkach, nie stupňoch: rot = (dir − 90) / 360 (dir 153 → 0.175).
//
// Nárožné domy do námestia (60999098 Prima banka, 61000733 okresný súd) majú looks už v namestie.js — tu sú len ich doplnky
// do Gorkého (nápis banky, sokle, mriežky, tabuľa súdu, skrinky). Zariadenie ulice začína za hranou dlažby PLAZA (s ≈ 0–1.5).
//
// Kľúče lamps, trafficSigns, nameplates, crossings, markings, driveways, clearLamps, furniture (nové typy) a todo zapisuje Stavbár podľa
// zmrazenej schémy technik/schema_prvkov.md. Hra ich zatiaľ nevykresľuje; zobrazia sa po PR tech/prvky bez prepisovania štvrte.
// Prehľad „v hre áno / v hre nie“ pre každú položku je v projekt/prieskum/centrum1/prvky.md.

// -------------------------------------------------------------------- vzhľad domov (looks)
const looks = {
  // Gorkého 1A + 1B (súp. č. 2618), severná strana, dlhý biely prízemný dom s lososovým soklom a obytným podkrovím.
  // fh 3.6 + eave 5.0: vyvýšené prízemie (~7 schodov do vchodov) a vysoká nadmurovka nad oknami; rh 4.8 = prízemný s obytným podkrovím.
  61000413: { wall: '#efeae0', floors: 1, fh: 3.6, eave: 5.0, roof: 'gable', rh: 4.8, roofColor: '#a0473a', ang: 27, ft: 1 },
  // Gorkého 2 (2045/2) Úrad práce, soc. vecí a rodiny, južná strana; koralová dvojpodlažná budova.
  // ft: 2 (fasáda starého mesta): OSM má na budove značku obchodu (fac 4) a bez ft by prízemie dostalo presklené výklady.
  61003077: { wall: '#dc7b68', floors: 2, fh: 3.9, eave: 8.6, roof: 'gable', rh: 3.6, roofColor: '#9a5444', ang: 27, ft: 2 },

  // ---- ŠTEFÁNIKOVA, južná strana (fasády hľadia na SSZ, 333°); hrebene rovnobežne s ulicou → ang 243 − 90 = 153.
  // 60997383 + 60999413 sú vizuálne JEDEN dom (Štefánikova 136/1 + východná časť s prejazdom): rovnaká farba, rímsa aj strecha.
  60997383: { wall: '#e2dfd6', floors: 2, fh: 3.7, eave: 7.9, roof: 'gable', rh: 4.5, roofColor: '#a97873', ang: 153, ft: 2 },
  60999413: { wall: '#e2dfd6', floors: 2, fh: 3.7, eave: 7.9, roof: 'gable', rh: 4.5, roofColor: '#a97873', ang: 153, ft: 2 },
  // 1174039013 (TÁČKAREŇ) + 61002459 (PIZZA APETITO) — jeden žltý prízemný dom so spoločnou strechou.
  // ft: 2 pri obidvoch: 61002459 má v OSM značku obchodu (fac 4) a bez ft by dostala presklené prízemie, kým TÁČKAREŇ nie — bol by vidieť švík.
  1174039013: { wall: '#efc585', floors: 1, fh: 3.4, eave: 4.7, roof: 'gable', rh: 4.0, roofColor: '#b48f88', ang: 153, ft: 2 },
  61002459: { wall: '#efc585', floors: 1, fh: 3.4, eave: 4.7, roof: 'gable', rh: 4.0, roofColor: '#b48f88', ang: 153, ft: 2 },
  // 61001176 (Raiffeisen) + 61000307 (Kancelárske potreby) — jeden blok, medzi nimi vyšší rizalit s prejazdom (extraBuildings nižšie).
  61001176: { wall: '#eccdb5', floors: 2, fh: 3.6, eave: 7.9, roof: 'gable', rh: 4.5, roofColor: '#966f66', ang: 153, ft: 2 },
  61000307: { wall: '#eccdb5', floors: 2, fh: 3.6, eave: 7.9, roof: 'gable', rh: 4.5, roofColor: '#966f66', ang: 153, ft: 2 },
  // 60999339 Mäsiarstvo U býka — koralová prízemná predajňa s vysokou valbovou strechou, na konci úseku pri Potočnej
  60999339: { wall: '#da7f6d', floors: 1, fh: 3.4, eave: 3.8, roof: 'hip', rh: 5.0, roofColor: '#b87260', ang: 153, ft: 2 },

  // ---- ŠTEFÁNIKOVA, severná strana (fasády hľadia na JJV, 153°)
  // 60999883 dlhý biely obchodný dom (Orange, La Donuteria) — 7–8 prevádzok s výkladmi, preto ft: 4 (cat 5 by ich sám nedal)
  60999883: { wall: '#f2eee2', floors: 1, fh: 3.5, eave: 3.6, roof: 'hip', rh: 3.0, roofColor: '#b5623f', ang: 153, ft: 4 },
  // 1488770549 Štefánikova 138/8 — do ulice je vidieť iba múr pred ním (fences); smer hrebeňa je neistý, preto bez ang
  1488770549: { wall: '#f0ece2', floors: 1, fh: 3.2, roof: 'gable', rh: 3.5, roofColor: '#b0603f', ft: 2 },
  // 60998021 Potočná 195/31 — nárožný dom na konci úseku; podľa rozhodnutia vedúceho patrí k Štefánikovej
  60998021: { wall: '#efe9dc', floors: 2, fh: 3.3, eave: 6.8, roof: 'hip', rh: 3.8, roofColor: '#b8654a', ft: 2 },
  // 60997157 pavilón/kaviareň v parku (Štefánikova 2597/2), 35–40 m od osi, presnosť nízka
  60997157: { wall: '#e8e0d2', floors: 1, fh: 3.0, roof: 'hip', rh: 2.5, roofColor: '#c4643f', ft: 2 },
};

// Hrebeň rovnobežne s ulicou: prieskum udáva smer od severu (Gorkého 117°, Štefánikova 243°), ale kľúč `ang` v city.js je
// matematický uhol atan2(z, x) v stupňoch (hrebeň smeruje (cos ang, sin ang)), teda dir − 90 → 27 a 153.
// Všetky domy majú omietnutú fasádu, preto mat: 'PLASTER' (bez neho dá cat 1 zvetranú hrubú omietku).
for (const id in looks) looks[id] = { mat: 'PLASTER', ...looks[id] };

// -------------------------------------------------------------------- dom, ktorý chýba v OSM (Štefánikova)
// Časť bloku 61001176/61000307 nad prejazdom (s 110 → 112.9, t −9.2…−10): v OSM je medzi obrysmi medzera, v skutočnosti
// je tam v prízemí prejazd s kovanou bránou a nad ním vyšší rizalit s 2 balkónmi (≥ 10.5 m). Polygón = presne tá medzera.
// POZOR: hra postaví plný blok od terénu, takže prejazd v hre NIE JE priechodný — engine dieru v prízemí nevie (todo).
const extraBuildings = [
  { id: 9000002, like: 61001176, ring: [[25.2, -127.3], [22.8, -125.9], [25.9, -120.6], [28.4, -121.9]],
    look: { mat: 'PLASTER', wall: '#eccdb5', floors: 3, fh: 3.4, eave: 10.6, roof: 'gable', rh: 3.2, roofColor: '#966f66', ang: 153, ft: 2 } },
];

// -------------------------------------------------------------------- doplnky na fasádach (nápisy, sokle, mriežky, truhlíky)
// path = skutočná uličná čiara podľa obrysu OSM. side určuje normálu líca: pre domy na severnej strane (fasáda hľadí na JJZ)
// je to side 1, pre domy na južnej strane (fasáda hľadí na SSV) side -1. Pri opačnej hodnote sa prvky nakreslia dovnútra domu.
const sign = (s, v, preset, arg, extra = {}) => ({ t: 'sign', s, v, preset, arg, glow: 0, ...extra });
const wall = (s, v, c, extra = {}) => ({ t: 'wall', s, v, c, m: 'PLASTER', ...extra });

const retail = [
  // 60999098 Prima banka — bočná fasáda do Gorkého (s -1.5 → 20.2). Face s = s + 1.49.
  { path: [[258.4, -167.1], [277.4, -156.7]], side: 1, items: [
    wall([0, 21.6], [0, 1.05], '#e8c9ae'),                                       // lososový sokel ~0.9 m nad chodníkom (v meria od terénu, chodník je +0.15)
    sign([6.1, 8.7], [3.85, 4.4], 'primaBanka', null, { cut: true }),            // nápis „Prima banka“ + logo na fasáde, h ≈ 4.1
    ...[4.1, 16.0].map(s => ({ t: 'box', s: [s - 0.25, s + 0.25], d: [0, 0.06], v: [0.35, 0.6], c: '#6d6a64', m: 'PLASTER' })),  // vetracie mriežky v sokli
  ] },
  // 61000413 Gorkého 1A/1B — uličná fasáda (s 20.2 → 53.9). Face s = s − 20.16.
  { path: [[277.4, -156.7], [307.0, -140.5]], side: 1, items: [
    wall([0, 33.7], [0, 1.15], '#ecc6ac'),                                       // lososový sokel ~1.0 m nad chodníkom
    ...[7.3, 15.7].map(s => sign([s - 0.75, s + 0.75], [1.35, 1.85], 'flowers', null, { cut: true, dd: 0.4 })),  // truhlíky s muškátmi (s ≈ 27.5 a 35.9)
  ] },
  // 61000413 — východná štítová stena do križovatky (x 307.1 → 311.5), rovnaký lososový sokel
  { path: [[307.0, -140.5], [311.4, -145.6]], side: 1, items: [
    wall([0, 6.74], [0, 1.15], '#ecc6ac'),
  ] },
  // 61003077 Úrad práce — uličná fasáda (s 35.4 → 55.4). Face s = s − 35.38.
  { path: [[284.7, -137.5], [295.8, -132.3], [303.2, -129.7]], side: -1, items: [
    wall([0, 20.0], [0, 1.15], '#cf7a68'),                                       // koralový sokel ~1.0 m nad chodníkom
  ] },
  // 61000733 okresný súd — severná fasáda do Gorkého (s 3.9 → 22.4). Face s = s − 3.90.
  { path: [[256.6, -151.7], [273.3, -143.8]], side: -1, items: [
    sign([13.3, 14.9], [1.95, 2.75], 'board', ['#e9e5d9', '#2e2b28', 'OKRESNÝ SÚD', 'SKALICA', 'Georgia']),   // tabuľa so štátnym znakom pri vchode (s ≈ 17.8)
  ] },

  // ================= ŠTEFÁNIKOVA =================
  // Južná strana: cesta ide od námestia na ZJZ, takže pri path v smere rastúceho s je vonkajšia normála (k ulici, 333°) strana side 1.
  // `v` sa meria od terénu, chodník je o 0.15 m vyššie → sokel 0.6 m nad chodníkom = v [0, 0.75].
  // 60997383 + 60999413 (s 70.2 → 86.3), svetlosivý sokel ~0.6 m
  { path: [[61.1, -144.5], [46.4, -138.1]], side: 1, items: [
    wall([0, 16.03], [0, 0.75], '#c3bdb9'),
  ] },
  // 1174039013 TÁČKAREŇ + 61002459 PIZZA APETITO (s 86.3 → 102.1), okrový sokel ~0.4 m
  { path: [[46.4, -138.1], [32.2, -131.1]], side: 1, items: [
    wall([0, 15.83], [0, 0.55], '#dfa159'),
    sign([1.9, 4.2], [3.05, 3.55], 'board', ['#f2f0ea', '#1e1c1a', 'TÁČKAREŇ', '', 'Georgia']),           // tabuľa nad vchodom, s ≈ 88–90.5, h ≈ 3.3
    sign([10.7, 14.2], [3.5, 4.0], 'board', ['#f4f2ec', '#c0392b', 'PIZZA APETITO', '', 'Arial']),        // nápis na fasáde, s ≈ 97–100.5, h ≈ 3.8
  ] },
  // 61001176 + rizalit nad prejazdom + 61000307 (s 102.1 → 128.1), sivý sokel ~0.5 m
  { path: [[32.2, -131.1], [9.3, -118.9]], side: 1, items: [
    wall([0, 25.95], [0, 0.65], '#a99891'),
    sign([1.5, 4.2], [3.15, 3.65], 'board', ['#141414', '#ffd400', 'Raiffeisen', 'BANK', 'Arial']),        // s ≈ 103.6–106.3, h ≈ 3.4
    sign([13.9, 17.4], [3.0, 3.45], 'board', ['#1d5c2e', '#f2efe6', 'KANCELÁRSKE', 'POTREBY', 'Arial']),   // s ≈ 116–119.5, h ≈ 3.3
    sign([17.9, 22.4], [2.95, 3.35], 'board', ['#f2f2ee', '#12367f', 'CENTRUM POISTENIA', 'CENTRUM ÚVEROV', 'Arial']),  // s ≈ 120–124.5
  ] },
  // 60999339 Mäsiarstvo U býka (s 128.1 → 139.0, koniec úseku pri s 135.7), tmavočervený sokel ~0.3 m
  { path: [[9.3, -118.9], [0.1, -112.8]], side: 1, items: [
    wall([0, 11.04], [0, 0.45], '#ab3d29'),
    sign([2.9, 5.9], [2.75, 3.2], 'board', ['#b5201f', '#ffffff', 'MÄSIARSTVO', 'U BÝKA', 'Arial']),       // červený pás, s ≈ 131–134, h ≈ 3.0
  ] },
  // Severná strana: fasáda hľadí na JJV (153°), pri path v smere rastúceho s je to side -1.
  // 60999883 (s 98.4 → 127.5), okrovohnedá podmurovka ~0.5 m
  { path: [[22.9, -157.5], [-2.5, -143.4]], side: -1, items: [
    wall([0, 29.05], [0, 0.65], '#c49a70'),
    sign([11.5, 12.7], [2.4, 2.9], 'board', ['#f26522', '#ffffff', 'orange', '', 'Arial']),                // svetelný výklad Orange, s ≈ 110.5
  ] },
];

// -------------------------------------------------------------------- vozovka a chodníky
// OSM vozovka je 6.0 m široká, v skutočnosti 5.4–5.7 m: off posúva obrubník dnu na skutočné miesto.
// sw[0] = južná strana (vpravo v smere jazdy od námestia), sw[1] = severná strana; obe sa merajú od obrubníka.
// juh: obrubník t −2.95 (off −0.05), 3.5 m (pri ústí ~3.5, pred súdom 2.3 + 1.25 trávnik, pred úradom 3.0; pred dvorom 5.0 = lots.islands).
// sever: obrubník t +2.4 (off −0.6), 5.4 m po uličnú čiaru, z toho trávnatý pás (lots.islands) a ~2 m dlažby pri fasáde.
//   Prieskum udáva severný obrubník t 2.7 pri s < 26 a 2.35 pri s > 31, čo by chcelo dva úseky s rôznym off. Nedá sa:
//   OSM way Gorkého nemá medzi námestím a križovatkou pri G0 žiadny vrchol a CITY.buildRoads vyhodnocuje roadOverride
//   na stred každého prevzorkovaného úseku, pričom nové body vkladá len pri križovatkách — celý úsek s 0–51 má teda
//   jednu hodnotu. Zvolené je t 2.4, lebo pri s > 31 je trávnik užší a pri obrubníku na 2.7 by tráva ležala na vozovke.
const roads = [
  // Zníženie obrubníka na konci trávnika pri križovatke G0 (s 55–57, sever; neoznačený prechod OSM 12734616111).
  // Musí byť pred hlavným záznamom, roadOverride berie prvý box, ktorý bod obsahuje. Hra `curb` zatiaľ ignoruje.
  { name: 'Gorkého', box: [309.5, -139.5, 313.5, -135], sw: [3.5, 5.4], off: [-0.05, -0.6], curbH: 0.12, curb: 'low' },
  // mat sa neuvádza = betónová zámková dlažba chodníka (predvolený povrch generátora)
  { name: 'Gorkého', box: [250, -170, 312, -125], sw: [3.5, 5.4], off: [-0.05, -0.6], curbH: 0.12 },

  // ---- ŠTEFÁNIKOVA: vozovka celá zo žulových kociek (OSM surface=sett, w 7.0, cob 1 → hra ju už kreslí kockami).
  // `surface: 'settsDark'` je podľa rozhodnutia vedúceho; hra toto pole zatiaľ nečíta, nakreslí ho tech/prvky.
  // Prieskum meria odtieň kociek #a19991 (svetlosivý) — to sa v schéme zadať nedá, materiál je daný názvom.
  // sw[0] = juh, sw[1] = sever (overené: OSM way vedie od Potočnej k námestiu, u = (0.891,−0.453), normála side +1 = (−uz, ux) = (0.453, 0.891) = juh).
  // Vozovka je v skutočnosti 8.7–10.0 m medzi obrubníkmi, OSM udáva 7.0 a os je ~1.8 m severne od skutočnej osi,
  // preto je off na juhu kladný (obrubník von z OSM vozovky) a pás medzi hranou OSM vozovky a obrubníkom dopĺňa lots.surfaces.
  // Tri boxy zodpovedajú trom prevzorkovaným úsekom (lomy osi pri s 6.9, 40.2, 75.9 a križovatka s Jatočnou dávajú deliace body).
  { name: 'Štefánikova', box: [82, -195, 124, -160], sw: [3.7, 1.9], off: [2.8, -0.7], curbH: 0.13, surface: 'settsDark' },   // s 0–40: obrubníky t −6.3 / +2.8
  { name: 'Štefánikova', box: [44, -175, 82, -140], sw: [3.3, 1.9], off: [3.1, -1.35], curbH: 0.13, surface: 'settsDark' },   // s 40–68: obrubníky t −6.6 / +2.15
  // s 83–136: na severe chodník nekreslíme (sw 0), celú plochu až k domom rieši vyvýšený ostrovček PLOCHA_S nižšie
  { name: 'Štefánikova', box: [-1, -160, 44, -110], sw: [3.4, 0], off: [2.4, 0], curbH: 0.13, surface: 'settsDark' },         // s 83–136: južný obrubník t −5.9
  // ústie Jatočnej (kocky, oblé nárožia) — sw a off ostávajú na predvolených hodnotách, zapisuje sa iba povrch
  { name: 'Jatočná', box: [38, -180, 56, -148], sw: [2.0, 2.0], off: [0, 0], curbH: 0.13, surface: 'settsDark' },
];

// -------------------------------------------------------------------- ploty, múry, brána (južná strana, medzi súdom a úradom práce)
const fences = [
  // s 23.8 … 28.3 múr zo sivých betónových tvárnic so štiepaným povrchom, krycia doska, bez stĺpikov
  { p: [[273.7, -141.5], [277.7, -139.4]], h: 1.7, type: 'block', color: '#9a9288' },
  // s 28.3 … 33.3 dvojkrídlová otváravá brána do dvora úradu práce (čierna oceľ, zvislé tyčky, stredný stĺpik pri s ≈ 30.8)
  // typ 'slat' (zvislé laty) je zo súčasných typov najbližšie; 'rail' kreslil len 2 vodorovné rúrky a brána bola takmer neviditeľná
  { p: [[277.7, -139.4], [282.1, -137.1]], h: 1.65, type: 'slat', color: '#3c3a38' },
  // s 33.3 … 34.6 murovaný pilier/krátky múr, napája sa priamo na západný roh 61003077
  { p: [[282.1, -137.1], [283.3, -136.5]], h: 1.8, type: 'stoneblock', color: '#9a9288' },
  // Severná strana: bez plotov, domy stoja na uličnej čiare (overené na všetkých 20 snímkach).

  // ================= ŠTEFÁNIKOVA (3 úseky) =================
  // s 88 … 98 sever: múr pred 1488770549, omietnutý/tehlový oranžovolososový, tmavá krycia doska, 1 murovaný pilier pri s ≈ 90.
  // Typ 'wall' (omietnutý múr) namiesto 'brick': 'brick' kreslí tehlovú textúru a pevne sivú dosku, tu je omietka a tmavá doska.
  { p: [[32.27, -162.31], [23.35, -157.56]], h: 2.3, type: 'wall', color: '#d9a07c', cap: '#6e5a50' },
  // s 110 … 112.9 juh: dvojkrídlová kovaná mreža v prejazde pod rizalitom (na snímke otvorená, kreslí sa zavretá).
  // Leží 0.3 m pred uličnou čiarou (t −9.0), aby bola pred čelom domu 9000002 vidieť; 'slat' = zvislé tyče.
  { p: [[25.17, -127.51], [22.58, -126.2]], h: 3.2, type: 'slat', color: '#2a2a2a' },
  // s 27 … 34 (t ≈ 32): nízke drevené zábradlie terasy pri pavilóne 60997157, hlboko v parku (35–40 m, presnosť ±2 m)
  { p: [[76.6, -198.8], [82.6, -202.7]], h: 1.0, type: 'wood', color: '#8a6a4e' },
];

// -------------------------------------------------------------------- povrchy, trávniky, lampy (lots)
// clear = koridor ulice v s −3…60, t −13…+12: zmažú sa v ňom lampy z mapy (clearLamps) a procedurálne stromy a autá.
// Patrí sem aj ihličnan z mapy vo dvore úradu práce [275.1,−136.0], ktorý v Street View (G1-207, 17 m) nie je.
const CLEAR = [[247.62, -149.28], [303.75, -120.68], [315.11, -142.95], [258.97, -171.55]];
// Severný trávnatý pás medzi chodníkom a obrubníkom (s 1.8 → 54.8), hrany podľa balíka:
// vnútorná hneď za obrubníkom (t 2.6 pri s < 26, 2.4 pri s > 31), vonkajšia t 5.65 (s 1.8), 5.39 (s 26), 4.48 (s 31), 4.35 (s 54.8).
// Dlažba pri fasáde z toho vychádza 2.0 m pri s < 5 a 1.6–2.3 m ďalej; obrys 61000413 v OSM leží o ~0.2–0.3 m bližšie
// k ceste než skutočná fasáda, preto pri s 20–26 ostáva manko ~0.4 m.
const LAWN_N = [[258.98, -161.0], [260.37, -163.72], [281.81, -152.5], [285.86, -149.42], [307.0, -138.5], [306.12, -136.76], [284.91, -147.56], [280.55, -150.01]];
// Južný trávnatý pás pri obrubníku pred súdom (s 4.5 → 21.9, šírka 1.25 m). Začiatok s ≈ 4.5 je neistý ±1 m (zakryté autami).
const LAWN_S = [[258.78, -154.65], [258.75, -153.26], [273.36, -145.82], [274.28, -146.75]];
// Spevnená plocha pred bránou dvora úradu práce (s 21.9 → 35.5, 5.0 m od obrubníka po múr) — pokračovanie južného chodníka.
const YARD_WALK = [[273.41, -143.72], [284.82, -137.91], [284.0, -136.3], [273.39, -141.7], [273.02, -142.96]];
// Plocha zo žulových kociek na rohu pri G0 (s 55–62, t 4–10, ~42 m²), doplnená prieskumom; presnosť ±0.3 m.
// Hrana t 4 leží za severným obrubníkom (t 2.4), takže do vozovky Gorkého nezasahuje; pri s 55–55.6 sa západný okraj
// prekrýva s východným štítom 61000413 (plocha pod domom nie je vidieť). Východná polovica leží v ústí bočnej ulice
// (OSM way bez mena, w 6.0, os cez s 58.1 t −0.2 → s 65.4 t 36.0) — na satelite je tam jedna súvislá dlažba, viď prvky.md 4.13.
const SETTS_G0 = [[307.0, -138.1], [313.3, -134.9], [316.0, -140.3], [309.7, -143.4]];
const SETTS_G0_IN = [[307.27, -138.19], [313.21, -135.17], [315.73, -140.21], [309.79, -143.13]];
const SETTS_G0_LEM = SETTS_G0.map((a, i) => [a, SETTS_G0[(i + 1) % 4], SETTS_G0_IN[(i + 1) % 4], SETTS_G0_IN[i]]);

// ---------------- ŠTEFÁNIKOVA ----------------
// clear = koridor ulice s 3.5…136, na juhu po t −11, na severe po t +8 v parkovej časti a po t +19.4 na dláždenej ploche.
// Park (t > 8 pri s < 78) ostáva nedotknutý, aby v ňom ostali stromy z mapy — prieskum zameral iba 6 smrekov pri ulici.
const CLEAR_S = [[120.28, -170.56], [2.99, -113.99], [-10.79, -141.09], [23.88, -158.72], [33.15, -163.66], [45.99, -157.17], [115.02, -188.82]];
// Vozovka je širšia než OSM obrys (hw 3.5): tieto tri pásy dopĺňajú kocky od hrany OSM vozovky (t ±3.4) po skutočný južný obrubník.
// Odtieň #7f786e je zhodný s odtieňom kociek, ktorý hra kreslí z mapy (cob 1), aby nebolo vidieť švík.
const ROAD_S1 = [[120.1, -178.42], [120.9, -175.63], [116.49, -174.41], [90.66, -163.27], [85.96, -161.08], [84.75, -163.88], [89.52, -165.94], [115.34, -177.08]];
const ROAD_S2 = [[84.75, -163.88], [85.96, -161.08], [77.59, -156.7], [61.5, -148.63], [54.35, -145.32], [53.03, -147.96], [60.07, -151.49], [76.16, -159.56]];
const ROAD_S3 = [[53.03, -147.96], [54.35, -145.32], [47.83, -142.51], [0.85, -118.63], [-0.28, -120.86], [46.7, -144.74]];
// Súvislá dláždená plocha na severe (s 78.5 → 135.7, od obrubníka t 3.5 po fasády a múr t 18.5): žulové kocky v oblúkovom vzore.
// Kreslí sa ako vyvýšený ostrovček s obrubníkom (top 'setts'); prieskum udáva odtieň #b9ac98, ostrovček farbu povrchu zadať nevie.
const PLOCHA_S = [[47.58, -152.93], [37.89, -157.65], [32.13, -162.35], [23.4, -157.47], [-10.21, -140.38], [-3.41, -127.01], [43.57, -150.89]];

// Rad mladých líp na ploche (t ≈ 13.4–14.7, rozostup ~6 m) a smreky pichľavé v parku — zariadenie.txt → trees.
const TREES_S = [
  { p: [33.6, -158.2], k: 10, h: 8 }, { p: [28.6, -155.3], k: 10, h: 8 }, { p: [23.4, -153.1], k: 10, h: 8 },
  { p: [17.8, -150.3], k: 10, h: 8 }, { p: [12.8, -146.7], k: 10, h: 8 }, { p: [7.8, -144.2], k: 10, h: 8 },
  { p: [2.5, -141.3], k: 10, h: 8 }, { p: [-3.0, -138.5], k: 10, h: 8 }, { p: [-8.3, -135.1], k: 10, h: 8 },
  { p: [85.8, -178.3], k: 11, h: 16 }, { p: [87.1, -179.3], k: 11, h: 16 }, { p: [95.4, -189.1], k: 11, h: 17 },
  { p: [97.3, -193.4], k: 11, h: 15 }, { p: [54.0, -163.0], k: 11, h: 13 }, { p: [56.8, -171.4], k: 11, h: 13 },
];
// Lampy: sever 7 dvojramenných kandelábrov (ramená kolmo na ulicu → a = 153 − 90 = 63), juh 5 jednoramenných lucerien.
const LAMPS_S = [
  { p: [110.4, -191.2], t: 'cand2', a: 63 }, { p: [101.9, -182.9], t: 'cand2', a: 63 }, { p: [82.0, -172.4], t: 'cand2', a: 63 },
  { p: [60.1, -161.0], t: 'cand2', a: 63 }, { p: [39.5, -152.0], t: 'cand2', a: 63 }, { p: [19.3, -142.9], t: 'cand2', a: 63 },
  { p: [-2.8, -131.6], t: 'cand2', a: 63 },
  { p: [98.2, -165.9], t: 'lantern' }, { p: [76.7, -155.5], t: 'lantern' }, { p: [55.1, -145.8], t: 'lantern' },
  { p: [33.4, -134.9], t: 'lantern' }, { p: [11.4, -123.5], t: 'lantern' },
];

const lots = {
  clear: [{ ring: CLEAR }, { ring: CLEAR_S }],
  clearLamps: true,                       // v úseku nie sú iné uličné lampy než 3 historické lucerny nižšie
  islands: [
    // h musí byť o kúsok nad chodníkom (WALK_Y = 0.15), inak dlažba chodníka trávnik prekryje
    { ring: LAWN_N, top: 'grass', h: 0.18, kerb: '#a9a59c' },
    { ring: LAWN_S, top: 'grass', h: 0.18, kerb: '#a9a59c' },
    { ring: YARD_WALK, top: 'walk', h: 0.17, kerb: '#a9a59c' },
    // Štefánikova: dláždená plocha na severe s 78.5–135.7 (kocky, hrana k vozovke je obrubník)
    { ring: PLOCHA_S, top: 'setts', h: 0.17, kerb: '#a6a29a' },
  ],
  surfaces: [
    // dvor/parkovisko úradu práce za bránou (s 23.9–35.1, t −8.05…−18): asfalt, nie trávnik
    { ring: [[273.84, -141.48], [283.82, -136.39], [279.3, -127.53], [269.95, -132.29]], m: 'asphalt', c: '#5a5a57', base: true },
    // Plocha z tmavosivých žulových kociek na rohu pri G0 (s 55–62, t 4–10), okolo východného štítu 61000413 a záhonu.
    // Vonkajší polygón z prieskumu (±0.3 m) je SETTS_G0; vnútro je zmenšené o 0.2 m (SETTS_G0_IN) a kreslí sa tmavými
    // kockami, lem tvoria 4 pásy šírky 0.2 m medzi vonkajším a vnútorným polygónom (lichobežníky, rohy na osi uhla,
    // takže medzi nimi nie je ani medzera, ani prekryv). `setts` a `settsDark` sa líšia iba odtieňom, nie veľkosťou kociek.
    { ring: SETTS_G0_IN, m: 'settsDark', c: '#6e6a66', base: true },
    ...SETTS_G0_LEM.map(ring => ({ ring, m: 'setts', base: true })),
    // záhon so štrkom pred východným štítom 61000413 (~0.9 × 2.5 m, biely štrk lemovaný radom žulových kociek)
    { ring: [[309.76, -142.68], [312.46, -143.68], [312.14, -144.52], [309.44, -143.52]], m: 'gravel', c: '#bdb6a8' },
    // Štefánikova: rozšírenie vozovky z kociek na juhu (OSM vozovka je 7.0 m, skutočná 8.7–10.0 m)
    { ring: ROAD_S1, m: 'settsDark', c: '#7f786e', base: true },
    { ring: ROAD_S2, m: 'settsDark', c: '#7f786e', base: true },
    { ring: ROAD_S3, m: 'settsDark', c: '#7f786e', base: true },
  ],
  ribbons: [
    // rigoly z 2–3 radov tmavých žulových kociek pozdĺž obrubníkov
    { pts: [[258.75, -161.15], [306.26, -136.96]], w: 0.35, m: 'settsDark', c: '#6e6a66' },            // Gorkého severný, s 1.5 → 55
    { pts: [[274.73, -147.11], [304.13, -132.13]], w: 0.35, m: 'settsDark', c: '#6e6a66' },            // Gorkého južný, s 22 → 55 (pred súdom zakrytý autami, neisté)
    // Štefánikova: pás 2–3 radov menších kociek pozdĺž oboch obrubníkov
    { pts: [[112.97, -182.59], [82.45, -169.21], [50.25, -153.5]], w: 0.35, m: 'settsDark', c: '#5e5952' },   // sever, s 6.9 → 75.9 (park)
    { pts: [[43.48, -151.07], [-3.32, -127.28]], w: 0.35, m: 'settsDark', c: '#5e5952' },                     // sever, s 83 → 135.5 (plocha)
    { pts: [[118.44, -175.13], [85.88, -161.26], [54.26, -145.5]], w: 0.35, m: 'settsDark', c: '#5e5952' },   // juh, s 4 → 75.9
    { pts: [[47.74, -142.69], [0.94, -118.9]], w: 0.35, m: 'settsDark', c: '#5e5952' },                       // juh, s 83 → 135.5
  ],
  trees: [
    // veľký trs okrasnej trávy (miskant/pennisetum, h ≈ 1.1 m) v štrkovom záhone; hra vie iba generický ker,
    // k 35 (bushC) je z dostupných variantov najnižší, mierka sa zatiaľ zadať nedá — h je tu podľa schémy pre tech/prvky
    { p: [310.9, -143.6], k: 35, h: 1.1 },
    ...TREES_S,
  ],
  // Lampy sa kreslia cez lots.lamps, aby boli vidieť už teraz; tie isté sú aj v kľúči `lamps` podľa schémy.
  lamps: [
    { p: [265.1, -159.0], t: 'lantern' },        // Gorkého s 8.1 t 3.6
    { p: [284.2, -148.6], t: 'lantern' },        // Gorkého s 29.9 t 3.2
    { p: [303.2, -138.9], t: 'lantern' },        // Gorkého s 51.2 t 3.2, nesie značku B33
    ...LAMPS_S,
  ],
};

// -------------------------------------------------------------------- prvky podľa schema_prvkov.md (hra ich zatiaľ nekreslí)
// Historické liatinové stĺpy s lucernou, čierne, v severnom trávnatom páse, rozostup ~21.5 m.
// POZOR pri tech/prvky: tie isté tri lampy sú zatiaľ aj v lots.lamps (iba tak sú dnes vidieť). Keď sa začne kresliť
// kľúč `lamps`, treba lots.lamps z tejto štvrte vypustiť, inak budú lampy dvakrát na tom istom mieste.
const lamps = [
  { p: [265.1, -159.0], dir: 0, t: 'lantern', h: 4.8, color: '#2a2c2e', note: 's 8.1 t 3.6; G3-27 u545 (blízko), G2-297 u461; pod lucernou kovaný držiak so závitnicami na kvetináč (prázdny)' },
  { p: [284.2, -148.6], dir: 0, t: 'lantern', h: 4.8, color: '#2a2c2e', note: 's 29.9 t 3.2; triangulované G2-117 u353 + G1-297 u481 (zhoda 1.2 m s G3-117 u378)' },
  { p: [303.2, -138.9], dir: 0, t: 'lantern', h: 4.7, color: '#2a2c2e', note: 's 51.2 t 3.2; nesie značku B33 (trafficSigns)' },

  // ---- ŠTEFÁNIKOVA: sever 7 dvojramenných historických kandelábrov (rozostup 22–24 m), juh 5 jednoramenných lucerien (rozostup ~24 m).
  // dir 153 / 333 = smer kolmo na ulicu; v lots.lamps je to a = dir − 90 = 63. Výška 5.0 m po vrch lucerny.
  { p: [110.4, -191.2], dir: 153, t: 'cand2', h: 5.0, arm: 0.65, color: '#2a2c2e', note: 's 6.9 t 11.6, za hranou PLAZA pri kiosku; nesie P1 + bielu tabuľku; vedľa kôš' },
  { p: [101.9, -182.9], dir: 153, t: 'cand2', h: 5.0, arm: 0.65, color: '#2a2c2e', note: 's 16.9 t 7.3; nesie B34; vedľa stojan na bicykle a oranžová tabuľa' },
  { p: [82.0, -172.4], dir: 153, t: 'cand2', h: 5.0, arm: 0.65, color: '#2a2c2e', note: 's 39.4 t 5.5, okraj parku' },
  { p: [60.1, -161.0], dir: 153, t: 'cand2', h: 5.0, arm: 0.65, color: '#2a2c2e', note: 's 63.7 t 5.0; nesie P2; vedľa kôš' },
  { p: [39.5, -152.0], dir: 153, t: 'cand2', h: 5.0, arm: 0.65, color: '#2a2c2e', note: 's 86.1 t 6.3, roh plochy pri Jatočnej; nesie B34; vedľa kôš' },
  { p: [19.3, -142.9], dir: 153, t: 'cand2', h: 5.0, arm: 0.65, color: '#2a2c2e', note: 's 108.2 t 7.4 na ploche' },
  { p: [-2.8, -131.6], dir: 153, t: 'cand2', h: 5.0, arm: 0.65, color: '#2a2c2e', note: 's 133.1 t 7.3 pri soche Vinár; nesie P2 + IP6' },
  { p: [98.2, -165.9], dir: 333, t: 'lantern', h: 5.0, arm: 0.6, color: '#2a2c2e', note: 's 27.0 t −6.9 pred radnicou; nesie P2 + modrú tabuľu + držiak na vlajku' },
  { p: [76.7, -155.5], dir: 333, t: 'lantern', h: 5.0, arm: 0.6, color: '#2a2c2e', note: 's 51.3 t −7.3 pred radnicou; malá nečitateľná tabuľka na stĺpe' },
  { p: [55.1, -145.8], dir: 333, t: 'lantern', h: 5.0, arm: 0.6, color: '#2a2c2e', note: 's 75.0 t −6.3 pred 60997383; nesie IP16 + „Mestská polícia“; vedľa kôš' },
  { p: [33.4, -134.9], dir: 333, t: 'lantern', h: 5.0, arm: 0.6, color: '#2a2c2e', note: 's 99.3 t −6.2 pred Pizza Apetito' },
  { p: [11.4, -123.5], dir: 333, t: 'lantern', h: 5.0, arm: 0.6, color: '#2a2c2e', note: 's 124.1 t −6.3 pred 61000307; vedľa kôš' },
];

// Zvislé dopravné značky. dir = smer, ktorým hľadí líce značky (stupne od severu). Kódy podľa vyhl. 9/2009.
// `on: 'lamp' | 'gate'` = značka bez vlastného stĺpika, tabuľa visí vo výške h a líce hľadí podľa dir.
const trafficSigns = [
  { p: [261.2, -161.6], dir: 117, codes: ['P1', 'E2b'], h: 2.3, pole: 'grey', note: 's 3.5 t 4.1, západný koniec sev. trávnika; Daj prednosť v jazde! + dodatková Tvar križovatky; G3-297 u593, G2-297 u449, G3-27 u50; poloha ±1 m' },
  { p: [273.3, -146.0], dir: 310, codes: ['B33', 'A22'], h: 2.2, pole: 'grey', note: 's 21.3 t -4.1, juž. chodník na konci trávnika pred súdom; Zákaz státia + výstražná Deti; G2-207 u280, G3-117 u500; líce k autám od námestia' },
  { p: [303.2, -138.9], dir: 117, codes: ['B33'], h: 2.5, on: 'lamp', note: 'Zákaz státia na stĺpe lampy s 51.2 (G0-297 u343, zozadu G1-117 u343); líce na VJV' },
  { p: [277.7, -139.4], dir: 27, codes: ['B1'], h: 1.8, on: 'gate', note: 's 28.3 t -8.0, Zákaz vjazdu všetkých vozidiel v oboch smeroch, na západnom stĺpiku brány dvora úradu práce (G1-207 u730, G2-117 u656, G1-297 u200); h 1.8 je hodnota z balíka — fotogrametria z G1-207 a G1-297 dáva stred tabule ~2.3 m nad chodníkom, ale rovnaký posun ~+0.7 m vychádza aj pri ostatných značkách úseku, takže ide o systematický rozdiel voči balíku, nie o chybu tejto položky' },
  { p: [315.4, -137.8], dir: 255, codes: ['B34'], h: 2.2, pole: 'white', note: 'MIMO ÚSEKU tesne za križovatkou (s 62.5 t 7.8), trávnik pri rohu 61000168; Zákaz zastavenia, biely šikmo naklonený stĺpik; G0-117 u212, G0-27 u773; dir neisté' },

  // ---- ŠTEFÁNIKOVA: všetkých 9 značiek (v 7 záznamoch) visí na stĺpoch lámp, samostatný stĺpik v úseku nie je.
  { p: [110.4, -191.2], dir: 125, codes: ['P1'], h: 2.4, on: 'lamp', note: 's 6.9 t 11.6; Daj prednosť v jazde + pod ňou malá biela tabuľka (text nečitateľný); Š0-254 aj Š0-344 u197; dir neisté ±20' },
  { p: [101.9, -182.9], dir: 75, codes: ['B34'], h: 2.4, on: 'lamp', note: 's 16.9 t 7.3; Zákaz zastavenia, líce k Š0 (Š0-254 u450); dir neisté ±30' },
  { p: [60.1, -161.0], dir: 63, codes: ['P2'], h: 2.4, on: 'lamp', note: 's 63.7 t 5.0; Hlavná cesta, líce na VSV (Š3-243 u542, Š4-333 u260)' },
  { p: [39.5, -152.0], dir: 114, codes: ['B34'], h: 2.4, on: 'lamp', note: 's 86.1 t 6.3; Zákaz zastavenia, líce k Š5 (Š5-333 u187)' },
  { p: [-2.8, -131.6], dir: 110, codes: ['P2', 'IP6'], h: 2.4, on: 'lamp', note: 's 133.1 t 7.3; Hlavná cesta + Priechod pre chodcov; líce ~VJV (Š8-243, Š9-333)' },
  { p: [98.2, -165.9], dir: 67, codes: ['P2'], h: 2.4, on: 'lamp', note: 's 27.0 t −6.9; Hlavná cesta + modrá obdĺžniková tabuľa (nečitateľná) + držiak na vlajku; Š1-247 u238' },
  { p: [55.1, -145.8], dir: 30, codes: ['IP16', 'E12:Mestská polícia'], h: 2.3, on: 'lamp', note: 's 75.0 t −6.3; Parkovisko + dodatková „Mestská polícia“ (vyhradené státie pred 60997383); Š5-153 u150, Š5-63 u668; dir neisté' },
];

// Tabuľky s názvom ulice a popisné čísla.
const nameplates = [
  { p: [260.1, -166.1], dir: 207, text: 'Gorkého', t: 'street', mount: 'wall', h: 3.3, color: '#c8322d', note: 'červená tabuľka s bielym písmom na nároží Prima banky (60999098), s 0.5; G3-27 u127, G3-297 u645' },
  { p: [288.2, -150.6], dir: 207, text: '2618/1B?', t: 'number', mount: 'wall', h: 3.5, color: '#ffffff', note: '2 tabuľky čísel (červený a čierny rámik) vpravo od západného vchodu 61000413, s 32.5; text nečitateľný (G1-27 u145–160)' },
];

// Priechod pre chodcov cez ústie Gorkého. V OSM existuje (way 9260694064, k=11) a hra ho vie nakresliť automaticky,
// ale leží na dlažbe PLAZA z namestie.js, ktorá sa kreslí neskôr a vyššie, takže ho prekrýva. Zapísané ako dáta, neduplikované.
const crossings = [
  { p: [[257.8, -162.7], [254.5, -156.2]], w: 2.3, t: 'zebra', drops: true, note: 's -1.1…1.2; kocková dlažba PLAZA (hrana), = OSM 9260694064 s tactile_paving; G3-297 u290–470, G4-123 u410–540' },
  // Štefánikova: obe zebry hra už kreslí z OSM (k = 11), tu sú iba ako dáta. Podľa schémy tech/prvky pri kreslení potlačí
  // OSM zebru, ktorá je do 3 m a má podobný smer, takže dvojmo nebudú. Zebra cez ústie Jatočnej patrí ulici Jatočná, nezapisuje sa.
  { p: [[116.0, -175.6], [112.2, -184.3]], w: 2.5, t: 'zebra', drops: true, note: 's 5–7.5 pri námestí, cez celú vozovku, kocky s bielymi pásmi; = OSM 7850321812 (odchýlka stredu 0.3 m); leží tesne za hranou PLAZA, namestie.js zebru nemá; Š0-254 u130–500, Š1-67 u270–440' },
  { p: [[1.1, -118.7], [-3.4, -127.6]], w: 2.5, t: 'zebra', drops: true, note: 's 134.3–136.8 na konci úseku (ústie do Potočnej); = OSM 9343609687 (odchýlka stredu 1.0 m); hranica úsekov – s Potočnou neduplikovať; Š9-243 u250–800, Š8-243 u360–455' },
];

// Vodorovné značenie. Iné značenie v úseku nie je (nápis „Gorkého“ na vozovke v snímkach je popis Google, nie skutočnosť).
const markings = [
  { t: 'dash', p: [[301.5, -132.8], [303.7, -131.6], [310.7, -128.5]], w: 0.15, color: 'yellow', note: 'žltá prerušovaná čiara NA OBRUBNÍKU (zákaz státia), úseky ~1 m žltá / ~1 m sivá, s 52.5 → 62.6 pred východnou časťou úradu práce; G0-207 u270–610, G0-297 u30–80' },
];

const driveways = [
  { road: 'Gorkého', p: [279.9, -138.3], w: 5.0, side: 'R', mat: 'pavers', gate: { t: 'swing', color: '#3c3a38', h: 1.65 },
    note: 'vjazd do dvora úradu práce, s 28.3–33.3, brána v t -8.0; chodník tu 5 m hlboký; zníženie obrubníka NEISTÉ (zo snímok sa nedá určiť, G1-297 ukazuje obrubník pozdĺž celej hrany)' },
];

// Obdĺžniky, v ktorých sa majú zmazať lampy z mapy (to isté robí už lots.clear + lots.clearLamps vyššie).
// Druhý obdĺžnik je Štefánikova; hranica x < 116 ho drží mimo dlažby PLAZA, ktorá si lampy maže sama.
const clearLamps = [[250, -170, 310, -128], [-5, -195, 116, -115]];

// Poklopy, vpuste, skrinky, schránka. Nové typy t podľa schémy, dir v stupňoch od severu.
const furniture = [
  { t: 'manhole', p: [281.0, -145.5], dir: 117, w: 0.9, note: 'štvorcový poklop/záplata v strede vozovky, s 28.4 t -1.1 (G2-117 u462, G1-297 u368)' },
  { t: 'manhole', p: [308.0, -132.3], dir: 0, note: 'okrúhly liatinový poklop vo vozovke, s 58.5 t -0.5 (G0-207 u413)' },
  { t: 'manhole', p: [271.0, -146.2], dir: 117, w: 0.6, note: 'štvorcový liatinový poklop v chodníku pred súdom, s 19.2 t -5.0 (G2-207 u372–405)' },
  { t: 'drain', p: [282.2, -148.7], dir: 117, note: 'uličná vpusť v rigole pri severnom obrubníku, s 28.1 t 2.3 (G2-117 u368)' },
  { t: 'drain', p: [279.4, -144.3], dir: 117, note: 'uličná vpusť pri južnom obrubníku, s 27.6 t -2.9 (G2-117 u520)' },
  { t: 'drain', p: [272.7, -148.1], dir: 117, note: 'okrúhla mriežka/vpusť pri južnom obrubníku pred súdom, s 19.9 t -2.6 (G2-207 u332) – okrúhla, neisté či vpusť alebo poklop' },
  { t: 'drain', p: [269.4, -150.4], dir: 117, note: 'vpusť pri južnom obrubníku, s 15.9 t -2.0..-2.8 (G2-297 u130, pri kolese auta) – neisté' },
  { t: 'drain', p: [305.9, -130.4], dir: 117, note: 'uličná vpusť (mriežka) pri južnom obrubníku pred úradom práce, s 57.5 t -3.1 (G0-207 u439)' },
  { t: 'cabinet', p: [262.4, -165.0], dir: 207, w: 0.35, h: 0.45, color: '#c9c9c4', note: 'svetlosivá elektro skrinka na fasáde Prima banky (s 3.0), spodok ~1.2 m (G3-27 u232)' },
  { t: 'cabinet', p: [262.9, -164.7], dir: 207, w: 0.5, h: 0.6, color: '#d6d6d2', note: 'väčšia svetlá skrinka hneď vedľa (s 3.6), G3-27 u245–275' },
  { t: 'cabinet', p: [279.1, -155.8], dir: 207, w: 0.75, h: 0.55, color: '#d8c27a', note: '2 žlté plechové skrinky meračov na fasáde 61000413 pri s 21.5–22.5, spodok ~0.3 m (G2-27 u475–550)' },
  { t: 'cabinet', p: [290.1, -135.2], dir: 27, w: 0.6, h: 0.5, color: '#bdbdb8', note: 'sivá skrinka na predsadenom koralovom bloku sokla 61003077 pri s 41.3 (G1-207 u280–340)' },
  { t: 'cabinet', p: [285.9, -137.4], dir: 27, w: 0.35, h: 0.45, color: '#e0c24a', note: 'žltá skrinka (HUP plyn?) na sokli 61003077 pri s 36.5 (G1-207 u483–517)' },
  { t: 'mailbox', p: [301.6, -143.4], dir: 207, note: 'čierna schránka + zvončekový panel v ostení východného vchodu 1A, s 47.8, h ≈ 1.8 (G1-27 u760–790, G1-117 u220) – súkromná, nie poštová' },

  // ================= ŠTEFÁNIKOVA =================
  // Koše – čierne kovové na stĺpiku, vždy pri lampe (nové typy, hra ich zatiaľ nekreslí)
  { t: 'litterBin', p: [111.3, -190.9], dir: 153, color: '#2a2a2a', note: 's 6.5 t 11.0, ~1 m od lampy s P1 (Š0-254 u772, Š1-337 u627); ±1 m' },
  { t: 'litterBin', p: [61.0, -161.4], dir: 153, color: '#2a2a2a', note: 's 62.7 t 5.0, hranatý, pri lampe s P2 (Š4-333 u295, Š3-243 u552)' },
  { t: 'litterBin', p: [40.0, -153.1], dir: 153, color: '#2a2a2a', note: 's 85.2 t 7.1, pri lampe s B34 (Š5-333 u237, Š6-333 u575)' },
  { t: 'litterBin', p: [54.8, -144.8], dir: 333, color: '#2a2a2a', note: 's 75.8 t −7.0, južný chodník pri lampe s IP16 (Š5-153 u205–222)' },
  { t: 'litterBin', p: [10.1, -122.7], dir: 333, color: '#2a2a2a', note: 's 125.6 t −6.5, pri lampe pred 61000307 (Š9-153 u90–115, Š9-63 u615–635)' },
  // Poklopy, vpuste, skrinka, kvetináč
  { t: 'manhole', p: [51.1, -150.4], dir: 63, note: 'okrúhly liatinový poklop v strede vozovky, s 76.5 t −0.4 (Š5-63 u345)' },
  { t: 'manhole', p: [22.4, -127.6], dir: 63, w: 0.8, note: 'obdĺžnikový tmavý poklop v chodníku pred prejazdom 61001176/61000307, s 112.4 t −7.7 (Š8-153 u65–100)' },
  { t: 'drain', p: [40.2, -149.3], dir: 63, note: 'uličná vpusť pri severnom obrubníku, s 86.8 t 3.6 (Š6-333 u625, Š6-63 u95)' },
  { t: 'drain', p: [43.2, -143.0], dir: 63, note: 'mriežka vo vozovke ~1.7 m od južného obrubníka, s 86.9 t −3.4 (Š6-63 u610) – vpusť alebo poklop, neisté' },
  { t: 'cabinet', p: [22.0, -125.5], dir: 333, w: 0.3, h: 0.5, color: '#b8b8b4', note: 'sivá skrinka (zvončeky/elektro) na fasáde pri prejazde, s 113.7, spodok ~1.3 m (Š8-153 u180–188)' },
  { t: 'planter', p: [15.5, -148.8], dir: 0, w: 1.0, h: 0.6, color: '#3a3a38', note: 'veľká tmavá okrúhla misa s kríkom na ploche medzi stromami, s 108.9 t 14.3 (Š8-333 u600, Š7-333 u425)' },
  // Lavičky – existujúci typ, hra ich kreslí. `ang` je os sedadla = dir − 180 (sediaci hľadí k ulici, dir 153 → ang 333).
  { t: 'bench', p: [24.8, -151.0], ang: 333, style: 'stone', note: 's 99.7 t 12.1; biely kamenný blok ~1.8 × 0.5 m s drevenou sedacou doskou, bez operadla; dir 153' },
  { t: 'bench', p: [18.1, -147.1], ang: 333, style: 'wood', note: 's 107.4 t 11.7; drevená lavička s operadlom; dir 153; ±0.8 m (iba jeden pohľad + korekcia)' },
  { t: 'bench', p: [13.5, -145.9], ang: 333, style: 'wood', note: 's 112.0 t 12.6; drevená hnedá lavička s operadlom, čierne kovové nohy, ~1.8 m; dir 153' },
  { t: 'bench', p: [8.5, -142.8], ang: 333, style: 'stone', note: 's 118.0 t 12.2; biely kamenný blok s drevenou sedacou doskou; dir 153' },
  { t: 'bench', p: [27.0, -160.2], ang: 333, style: 'wood', note: 's 93.6 t 19.3, pri múre 1488770549; dir 153; ±1.5 m (iba Š5-333)' },
  // Plagátový stĺp – existujúci typ; `rot` je v otáčkach, nie stupňoch: rot = (dir − 90) / 360, dir 153 → 0.175 (jeden plagát hľadí k ulici).
  { t: 'adColumn', p: [41.25, -158.3], rot: 0.175, note: 's 81.7 t 11.2, roh plochy pri Jatočnej; biely valec s plagátmi, sivá kupolovitá strieška, d ≈ 1.0 m, h ≈ 2.8 (Š6-333 u590, Š5-333 u365)' },
];

// Stĺpy vedenia a káble: v úseku žiadne nie sú (skontrolovaných všetkých 20 snímok), preto poles a wires chýbajú.
// Stromy: v úseku s 0–58 nie je žiadny strom; jediná zeleň je trs okrasnej trávy v záhone (lots.trees) a dva trávnaté pásy.

// Čo sa do schémy nezmestí.
const todo = [
  { t: 'stojan s reklamnou tabuľou', p: [300.7, -141.6], note: 's 47.7 t 4.4, na hrane trávnika a chodníka pred vchodom 1A; čierny kovový rám ~0.9 × 1.0 m, dole zvislé priečky (ako stojan na bicykle), hore tabuľa ~0.9×0.35 m (biela s logom modrý trojuholník/zelený štvorec/červený kruh + sivá plocha); triangulované G1-117 u281 + G0-297 u386. Či slúži aj na bicykle – neisté' },
  { t: 'vystrčená tabuľa s logom', p: [301.2, -143.6], note: 's 47.3, na fasáde 61000413, h ≈ 4.3, biela obojstranná ~0.7×0.5 m, logo modrý trojuholník + zelený štvorec + červený kruh, dir 117/297 (kolmo na fasádu)' },
  { t: 'firemné tabule 61000413', p: [285.5, -152.0], note: 'biela svetelná tabuľa pri západnom vchode (s 29.5, h ≈ 3.8) + 2 mosadzné tabuľky (s 32.5, h 2.6–3.0) + plochá modro-bielo-červená tabuľa nad oknom (s 51.5, h ≈ 3.6); texty nečitateľné' },
  { t: 'vstupné schodisko so strieškou (úrad práce)', p: [305.0, -129.5], note: 's 55.9–58.2, t -4.4; ~6 stupňov, šírka ~2.2 m, murované koralové boky, sklenená sedlová strieška na 2 kovových stĺpikoch (~2.5×1.5 m, h ≈ 3.2); G0-207 u410–480' },
  { t: 'vlajka EÚ na držiaku', p: [306.2, -128.1], note: 's 59, na rohu 61003077 pri vstupe, šikmá žrď, h ≈ 5; + modrá informačná tabuľka ~0.4×0.5 m pri vstupe (s 59.6, h ≈ 2), G0-207 u378–398' },
  { t: 'stĺpik bez značky', p: [258.8, -151.4], note: 'pred súdom s 6.1, sivý, h ≈ 2.5 (G3-207 u433); neisté, či nesie značku otočenú bokom' },
  { t: 'sivá skrinka so strieškou na múre podlubia súdu', p: [258.3, -152.2], note: 'dvojkrídlová ~1.4×0.9 m s plechovou strieškou, na koralovom múre oblúka súdu (G3-207 u440–640 v270–310) – vývesná skrinka súdu' },
  { t: 'malá sivozelená rastlina v záhone', p: [311.8, -144.0], note: 'druhá rastlina v štrkovom záhone pred východným štítom 61000413 vedľa trsu okrasnej trávy (G0-27 u200–335); nízka, sivozelená, druh neurčený — hra nemá vhodný typ, generický ker by bol niekoľkonásobne väčší' },
  { t: 'malá tabuľa so štátnym znakom (súd)', p: [268.8, -145.9], note: 's 17.4, na severnej fasáde súdu vedľa veľkej tabule (G3-207 u60)' },
  { t: 'zelené fólie na spodku okien prízemia Prima banky', p: [265.0, -163.0], note: 's 4–14, typické pre banku; hra nevie farebnú fóliu na výplni okna' },
  { t: 'kábel na fasáde súdu', p: [267.5, -147.5], note: 'tenká čiara pri balkóne súdu (G3-117 u510–530 v90–150) – pravdepodobne kábel na fasáde, neisté' },
  { t: 'neoznačený prechod cez bočnú ulicu pri G0', p: [311.5, -137.3], note: 'OSM 12734616111; bez pásov, len znížené obrubníky s bielymi betónovými plochami (G0-297 u310–360 v415–440). Nie je crossing, len zníženie obrubníka — zapísané aj ako roads[0].curb = low' },

  // ---- detaily fasád, ktoré generátor nevie a schéma pre ne nemá pole (61000413, severná strana)
  { t: 'strešné okná 61000413', p: [285.33, -152.36], note: '6 strešných okien do ulice v osiach s ≈ 22.1, 24.4, 29.2, 37.5, 42.5 a ~52 (posledné neisté ±2 m); G2-27 u500/572/720, G1-27 u20/160/360/500, G1-117 u255. Hra kreslí iba holú strešnú rovinu (rh 4.8 = prízemný s obytným podkrovím)' },
  { t: 'antény na hrebeni 61000413', p: [284.28, -152.94], note: 'TV anténa na hrebeni pri s ≈ 28 (G2-27 u690) a tyčová anténa pri s ≈ 33 (G1-27 u215)' },
  { t: 'odkvapový žľab a zvody 61000413', p: [277.44, -156.68], note: 'plechový sivý pozinkovaný žľab po celej dĺžke uličnej fasády; zvody pri s 20.2 (hranica s Prima bankou, = OSM roh 277.5,-156.7) a pri s ≈ 54 (východný roh). Komíny do ulice žiadne' },
  { t: 'zapustené vchody 61000413', p: [286.21, -151.88], note: '2 vchody bez dverí v uličnej fasáde: západný s 30.2–32.1 (pravdepodobne 1B) a východný s 47.3–48.5 (pravdepodobne 1A, p ≈ [301.2,-143.7]); otvor ~1.8 × 3.1 m, lososové ostenie, 6–7 schodov dovnútra, madlo vľavo. Adresné body OSM: 1A (303.0,-145.5), 1B (295.0,-148.9), priradenie k vchodom neisté' },
  { t: 'okná 61000413', p: [281.12, -154.66], note: '6 okien do ulice, 2-krídlové drevené hnedé #6e4a2c so záclonami, lososové šambrány ~12 cm #e8c3a8, ~1.3 × 1.5 m; osi s ≈ 23.8, 27.5, 35.9, 40.8, 45.3, 51.8. Parapet ≈ 1.5 m, nadpražie ≈ 3.5 m. Hra generuje vlastný raster okien' },
  { t: 'vetracie mriežky v sokli 61000413', p: [296.92, -146.02], note: 'mriežka v lososovom sokli pri s ≈ 42.4 (G1-27 u540)' },
  { t: 'východná štítová stena 61000413', p: [309.2, -143.05], note: 'x 307.1 → 311.5: v štíte 1 okno podkrovia (hnedé, 2-krídlové), dole 1 okno so záclonou, svetlosivá neomietnutá/opravená plocha ~2.5 × 2 m (G0-297 u360–610 v450–660), zvod pri rohu. Sokel je nakreslený (retail), zvyšok nie' },

  // ---- detaily fasád (61003077, južná strana)
  { t: 'dvojfarebnosť fasády 61003077', p: [289.43, -135.29], note: 'plochy prízemia medzi oknami biele #eeebe6 (~40 % fasády), koralové zvislé lizény, biela profilovaná rímsa medzi podlažiami, nad oknami poschodia biele trojuholníkové frontóniky, nad oknami prízemia koralové trojuholníky; východná časť s ≈ 47–52 má predsadené biele lizény cez obe podlažia (G1-117 u520–600). Hra kreslí jednu farbu fasády, retail wall by prekryl okná' },
  { t: 'okná 61003077', p: [291.06, -134.52], note: 'drevené medovo-hnedé rámy #b98a4a, 2-krídlové s nadsvetlíkom; osi s ≈ 36.9, 38.7, 40.6, 42.4, 44.2 a úzke okno v osi s ≈ 46.2 na oboch podlažiach, v úseku s 47–52 ďalšie 2 osi úzkych okien. Prízemie vyvýšené, parapet ≈ 1.9 m, rad okien poschodia ≈ 3.05 m nad radom prízemia' },
  { t: 'francúzske balkóny 61003077', p: [288.57, -135.69], note: '2 balkóny s čiernym kovaným zábradlím na poschodí v osiach s ≈ 38.7 a 40.6 (G1-207 u333, u410)' },
  { t: 'mreže na oknách prízemia 61003077', p: [285.72, -137.03], note: 'okná prízemia na západnom konci fasády majú mreže (G2-117 u580–700)' },
  { t: 'štíty a zvody 61003077', p: [301.39, -130.34], note: 'na západnom konci priečny štít do dvora (koralový s okrovými poľami #e6b56c medzi lizénami, G2-117 u610–760) a po jeho výške tmavá zvislá rúra (zvod/dymovod, G2-117 u675); na východnom konci štít do ulice s ≈ 51.7–55.5 (koralový so žltým poľom, veľké kruhové okno rozdelené na 2 polkruhy, malé okrúhle okno v špici, G0-207 u440–590). Sivý zvod pri s ≈ 47.0. Strešné okná z ulice nevidno — neisté' },

  // ======================================== ŠTEFÁNIKOVA ========================================
  // ---- mestské zariadenie, pre ktoré schéma nemá typ
  { t: 'ŠT: novinový stánok (kiosk)', p: [103.3, -189.2], note: 's 13.1 t 12.5, za hranou PLAZA; ~4.5 × 2.5 m, h ≈ 2.8, spodok biele panely, hore presklené vitríny s časopismi v hnedých rámoch, hnedá plochá strieška s presahom; rohy (101.5,−188.0)…(105.2,−190.5); Š0-254 u530–610, Š1-337 u470–545. Chýbajúci typ: Stánky a kiosky' },
  { t: 'ŠT: stojan na bicykle', p: [102.7, -182.9], note: 's 16.2 t 7.0, hneď pri lampe s B34; čierny kovový rám s madlom ~1.0 m + 5–6 zasúvacích držiakov, dĺžka ~1.3 m, kolmo na chodník; Š1-337 u473–507. Chýbajúci typ: Stojany na bicykle' },
  { t: 'ŠT: mestský orientačný smerovník', p: [107.5, -185.4], note: 's 10.8 t 7.4; čierny stĺp h ≈ 3.0 s 5–6 hnedobordovými šípkami s bielym textom; tri Š0-254 u497 + Š1-337 u633 + Š1-67 u113. Chýbajúci typ: Smerové a informačné tabule' },
  { t: 'ŠT: cyklosmerovník', p: [101.3, -184.6], note: 's 16.8 t 9.1 = OSM guidepost 454101667 „Skalica, centrum“; žltý stĺpik s bielymi tabuľkami, h ≈ 2.8; Š0-254 u476, Š1-337 u461. Chýbajúci typ: Smerové a informačné tabule' },
  { t: 'ŠT: oranžová informačná tabuľa', p: [100.8, -182.4], note: 's 18.1 t 7.2; oranžová tabuľa s bielym rámom ~0.6 × 0.5 m na 2 sivých stĺpikoch, spodok ~0.8 m, h ≈ 1.3, líce k ulici (dir 153); pri nej malý záhon ~2 × 1 m; Š1-337 u425–455. Chýbajúci typ: Smerové a informačné tabule' },
  { t: 'ŠT: informačná tabuľa (mapa)', p: [34.0, -155.4], note: 's 89.5 t 11.9; biela plocha so zeleným rámom ~1.2 × 1.0 m na 2 stĺpikoch, h ≈ 2.0, líce ~JJV; Š5-333 u198–223, Š6-333 u365–390. Chýbajúci typ: Smerové a informačné tabule' },
  { t: 'ŠT: Obecná studňa', p: [-0.8, -135.3], note: 's 129.6 t 9.7 = OSM man_made=water_well 6512779637 (historická); okrúhla kamenná obruba d ≈ 2.4 m, h ≈ 0.6, drevený poklop, nad ňou tmavohnedá drevená konštrukcia zo 4 stĺpov s rumpálom a strieškou, h ≈ 3.0; Š8-333 u183, Š9-333 u445. Chýbajúci typ: Studne a rumpály' },
  { t: 'ŠT: socha Vinár (bronz)', p: [-5.7, -137.2], note: 's 133.1 t 13.6 = OSM artwork 6512779638; tmavá kovová postava vinára pri stolíku/lise v životnej veľkosti na nízkom ráme, h ≈ 1.6; Š9-333 u360–380. Chýbajúci typ: Sochy a drobná architektúra' },
  { t: 'ŠT: sivé kamenné stély', p: [27.5, -154.6], note: '2 ks v rade stromov: (27.5,−154.6) s 95.7 t 14.1 a (1.05,−140.8) s 125.5 t 13.7; sivá žula #9a9a96, hranol ~0.5 × 0.5 m, h ≈ 1.6–2.0, jedna strana svetlejšia; účel neznámy (pamätník / pitná fontána?). Chýbajúci typ: Sochy a drobná architektúra' },
  { t: 'ŠT: čierne stĺpiky v rade stromov', p: [10.1, -145.7], note: '3 ks, h ≈ 1.0, d ~0.12: (21.6,−151.2) s 102.4, (10.1,−145.7) s 115.2, (−2.0,−138.8) s 129.1; rozostup ~13 m – možno svietidlá alebo prípojky, neisté. Chýbajúci typ: Patníky a stĺpiky' },
  { t: 'ŠT: letná terasa (stoly, stoličky, slnečníky)', p: [0.0, -139.5], note: 'sezónne, pred 60999883/60998021: s ≈ 122–134, t 9–14; biele plastové stoličky a stolíky, zatvorené biele slnečníky, 2 stojany-tabule (A); Š8-333 u330–400, Š9-333 u550–720. Existuje typ `terrace` (landmarks), ale ide o dočasný stav, preto nekreslené' },
  { t: 'ŠT: reklamné stojany (A) na južnom chodníku', p: [27.0, -130.0], note: 'mobilné: žltý pri Raiffeisen (s ≈ 108, Š7-153 u320–330), žltý v prejazde (Š8-153 u130), čierny pri Pizza Apetito (Š6-153 u690). Chýbajúci typ: Reklamné stojany' },
  { t: 'ŠT: biely prívesný vozík / food truck', p: [30.0, -160.0], note: 'stojí na ploche pri múre 1488770549 (Š5-333 u310–370, Š6-333 u435–470). Prieskum výslovne označil ako DOČASNÝ – neprenáša sa, uvedené len na vysvetlenie snímok' },
  { t: 'ŠT: okrúhly kvetinový záhon v parku', p: [73.0, -185.0], note: 's 41 t 21, priemer ≈ 9 m, červené a žlté kvety, okolo dláždený okruh (satelit + Š3-333 u470–590, Š4-333 u600–750). Hlboko v parku, mimo uličného profilu; kvetinový záhon schéma nepozná (trees je iba na stromy a kry)' },
  { t: 'ŠT: pozdĺžne státie áut pri južnom obrubníku', p: [40.0, -140.0], note: 's ≈ 10–134, bez vodorovného značenia, 1–3 autá pred každým domom; pred 60997383 (s ≈ 70–80) vyhradené pre Mestskú políciu (IP16 + E12 na lampe s 75.0). `parking` ani `markings` sa nepoužívajú, čiary v skutočnosti nie sú' },
  // ---- prvky, ktoré hra postavila inak, než sú v skutočnosti
  { t: 'ŠT: dom nad prejazdom chýba v OSM', p: [25.6, -124.0], note: 's 110–112.9, medzi obrysmi 61001176 a 61000307 je v OSM medzera; doplnené ako extraBuildings id 9000002 (polygón [[25.2,−127.3],[22.8,−125.9],[25.9,−120.6],[28.4,−121.9]], eave 10.6). CHÝBA V OSM – nahlásiť. Hra postaví plný blok od terénu, takže PREJAZD POD DOMOM NIE JE PRIECHODNÝ: dieru v prízemí (2.6 × 3.4 m) engine nevie, `holes` sú len pre dvory. Riešiť v tech/prvky alebo schémou budovy' },
  { t: 'ŠT: prejazd do dvora 60999413 bez brány', p: [49.0, -139.6], note: 's 80.5–85.8, segmentový oblúk, svetlá šírka ≈ 4.8 m, výška vrcholu ≈ 4.3 m, bez brány, vnútri kocky a opadaná omietka; vedie do dvora (OSM footway 841373775 tunnel=building_passage). Obrubník pred ním je súvislý, takže to nie je vjazd (driveways sa nezapisuje). Hra prejazd nekreslí – stena je plná' },
  { t: 'ŠT: dvojfarebnosť 61001176 + 61000307', p: [20.7, -125.0], note: 'prízemie je lososovooranžové #e3b698, poschodie a podkrovie krémovobroskyňové #eccdb5, medzi nimi výrazná rímsa; hra kreslí jednu farbu (#eccdb5). Natrieť prízemie cez retail `wall` by prekrylo výklady aj vchody, rovnako ako pri úrade práce na Gorkého' },
  { t: 'ŠT: detaily fasád južného radu', p: [46.0, -137.0], note: '60997383/60999413: profilovaná korunná a kordónová rímsa, štukové suprafenestry a parapetné polia, 6 okien poschodia v osiach s 72.1/73.2/76.1/78.1/81.8/84.1, 2 okná prízemia, dvojkrídlové dvere s nadsvetlíkom s 72.5, 2 strešné okná, satelitná anténa na hrebeni s 72, zvody s 70.5 a 86. 1174039013/61002459: 4 strešné okná s 88.4/91.1/92.9/98.4, pruhovaná markíza s 96.5–102.4 (spodná hrana 2.4 m), 2 výklady, hnedé dvere s 88.2–90.1, 93.4 a 98.8, 2 čierne menu tabule. 61001176/61000307: veľký sedlový vikier nad Raiffeisen, 2 veľké vikiere + 1 strešné okno na východnej časti, 2 balkóny s kovaným zábradlím na rizalite (s 109.2 a 113.2), okná s 104.5/106.5 a 5 okien východnej časti, zvody s 102.4 a 127.3. 60999339: kovový hrot/makovica na vrchole valby, vetracia taška, 2 plagátové tabule, malé okno s 130.3, zvod s 127.3. Hra kreslí iba generický raster okien a holú strešnú rovinu' },
  { t: 'ŠT: detaily fasád severnej strany', p: [10.0, -150.0], note: '60999883: malá vežička s makovicou na hrebeni pri s ≈ 110, komín na západnom štíte, 7–8 prevádzok s tmavými presklenými výkladmi a hnedými dvermi, červený okrúhly znak na fasáde. 60998021: hnedé okná, hnedé drevené dvere, prevádzka na prízemí (presnosť nízka, 25 m cez stromy). 1488770549: do ulice je vidieť iba múr, za ním biely dom so štítom natočeným na VJV – smer hrebeňa neistý, preto bez ang' },
  { t: 'ŠT: radnica 61001746 – južná fasáda nie je jednofarebná', p: [95.0, -160.0], note: 'v Štefánikovej má radnica 4 odlišné úseky: s 4–25 mätovozelená #c3dcc4 (zodpovedá looks v namestie.js), s 25–35.6 krémová prístavba #f0e4c8 so žltými šambránami, s 35.6–57.9 postmoderná časť s 2 arkiermi obloženými červenými šindľovými panelmi a balkónom, s 57.9–69.5 hladká krémová #efe4cc s oblúkovým vchodom. Radnica je v namestie.js a podľa rozhodnutia vedúceho ju tento PR nemení – ide do vetvy stvrt/namestie-oprava' },
  { t: 'ŠT: ZUŠ 60999034', p: [45.0, -190.0], note: 'ZUŠ/Ľudová škola umenia (Jatočná 140/4, biela, červená sedlová strecha, na štíte veľká maľba stromu a modrý okrúhly znak) má adresu Jatočná a hľadí do parku → patrí ulici Jatočná, looks sa tu nezapisuje' },
  { t: 'ŠT: zebra cez ústie Jatočnej patrí ulici Jatočná', p: [43.25, -167.1], note: 'OSM node 454171252 (way 1012760400), od (40.6,−165.7) po (45.9,−168.5), w 2.5, znížené obrubníky; s 73–79, t ≈ 18 od osi Štefánikovej. Hra ju kreslí z OSM (k = 11), takže v hre JE — vidno ju napr. na Š5-333 u415–500. Do `crossings` centrum1 sa podľa rozhodnutia vedúceho nezapisuje, dáta patria ulici Jatočná; kto bude robiť Jatočnú, nech ju zapíše tam s poznámkou „= OSM 454171252“, aby ju tech/prvky nakreslil namiesto OSM zebry a nezdvojil ju' },
  { t: 'ŠT: nezamerané stromy v parku', p: [70.0, -190.0], note: 'listnaté stromy pri pavilóne 60997157 a pri ZUŠ a ďalšie smreky sú 20–60 m od ulice, prieskum ich jednotlivo NEZAMERAL (priemet ±3–5 m). Zapísaných je 15 stromov pri ulici; zvyšok parku necháva štvrť na procedurálnu zeleň z mapy (lots.clear preto do parku nezasahuje)' },
];

export default {
  name: 'Centrum: Gorkého, Štefánikova, Kráľovská',
  id: 'centrum1',
  spawn: [278.5, -148.2, 5.18],            // v strede Gorkého, pohľad na ZSZ k námestiu
  looks,
  extraBuildings,
  retail,
  roads,
  fences,
  lots,
  // dáta pre tech/prvky (hra ich zatiaľ ignoruje)
  lamps,
  trafficSigns,
  nameplates,
  crossings,
  markings,
  driveways,
  clearLamps,
  furniture,
  todo,
};
