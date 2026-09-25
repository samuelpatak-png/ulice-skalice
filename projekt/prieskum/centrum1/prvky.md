# Centrum 1 — čo z prieskumu je v hre a čo nie

Súbor má dve časti: **A. Gorkého (1. úsek)** a **B. Štefánikova (1. úsek)**. Kráľovská pribudne neskôr.

# A. Gorkého (1. úsek)

Zdroj: prieskumný balík `centrum1_gorkeho` (`looks.txt` sekcia ## Gorkého, `ploty.txt`, `zariadenie.txt`, `trasa.md`), Street View 10/2022 a satelit `sat_Gorkeho_1.png`.
Cieľový súbor: `projekt/src/world/districts/centrum1.js`. Úsek: OSM way 38417436, (250.0,−163.5) → (308.0,−132.8), s = 0…58.

Stĺpec **v hre** má dve hodnoty:

- **áno** — prvok sa po `npm run build` skutočne vykreslí.
- **nie** — prvok je zapísaný ako dáta podľa `technik/schema_prvkov.md`, ale hra preň zatiaľ nemá kód. Pri každom takom riadku je uvedený názov chýbajúceho typu prvku a miesto v dátach.

Priradenie OSM ID každého domu je overené `prieskum/ray3.py` z kalibrovaných polôh kamier
(G0 310.7,−137.1 · G1 291.0,−142.0 · G2 273.5,−151.8 · G3 263.1,−157.7 · G4 245.5,−171.4) s ohniskom f = 258 px.

Stav: po **kole 1 opráv Kontrolóra** (kontrolovaný head 3ba4c2c). Zmenené riadky: 1.1, 1.2, 1.5–1.8, 2.2, 2.9, 2.9b, 2.15,
3.5, 4.1–4.3, 4.5–4.10, 4.13, 4.16, 5.1–5.3, 6.4, 7.1, 9.1, 11.1, 11.3, 11.4, 11.4b a zoznam ostávajúcich rozdielov.

---

## 1. Domy (`looks`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 1.1 | 61000413 Gorkého 1A + 1B (2618), biely prízemný dom s obytným podkrovím, `wall #efeae0`, `fh 3.6`, `eave 5.0`, sedlová, `rh 4.8`, `roofColor #a0473a`, `ang 27`, `ft 1`, `mat PLASTER` | áno | `looks[61000413]`. `ang 27` = smer hrebeňa 117° od severu prepočítaný na konvenciu `city.js` (matematický uhol `atan2(z, x)`), teda 117 − 90. Lúče G2‑27 u460–790, G1‑27 u10–790, G0‑297 u440–600, G0‑27 u100–250 trafili obrys 61000413 (hrana e6 = uličná fasáda, e5 = východný štít) — priradenie potvrdené. |
| 1.2 | 61003077 Gorkého 2 (2045/2) Úrad práce, koralová dvojpodlažná budova, `wall #dc7b68`, `fh 3.9`, `eave 8.6`, sedlová, `rh 3.6`, `roofColor #9a5444`, `ang 27`, `ft 2`, `mat PLASTER` | áno | `looks[61003077]`. `ang 27` ako pri 1.1; `ft: 2` namiesto „bez ft“ preto, že OSM značka obchodu (`fac 4`) by prízemiu dala presklené výklady. Lúče G1‑207 u50–520, G0‑207 u440–700, G2‑117 u470–700 trafili obrys 61003077 (hrana e14 = uličná fasáda). |
| 1.3 | 60999098 Prima banka (nárožný dom do námestia) | áno | Looks je v `namestie.js`, v centrum1 sa neduplikuje (pokyn Stavbára). Lúče G3‑27 u127–740 potvrdili obrys. Doplnky viď 2.1–2.5. V `namestie.js` mu bolo doplnené `ft: 2` — viď 1.11. |
| 1.4 | 61000733 okresný súd (nárožný dom do námestia) | áno | Looks je v `namestie.js`, v centrum1 sa neduplikuje. Lúče G2‑207 u280–600 a G3‑207 u60–433 potvrdili obrys (hrana e3 = severná fasáda do Gorkého). Doplnky viď 2.6–2.8. V `namestie.js` mu bolo doplnené `ft: 15` — viď 1.11. |
| 1.5 | Strešné okná 61000413 (6 ks pri s 22.1, 24.4, 29.2, 37.5, 42.5 a ~52), TV a tyčová anténa na hrebeni, odkvapový žľab a zvody | nie | Hra kreslí iba tvar strechy; jednotlivé strešné okná, antény ani zvody nevie. `rh 4.8` je podľa tabuľky v NAVOD riadok „prízemný s obytným podkrovím (strešné okná, vikiere)“, takže objem strechy sedí. Dáta: `todo` — „strešné okná 61000413“, „antény na hrebeni 61000413“, „odkvapový žľab a zvody 61000413“. |
| 1.6 | Dvojfarebnosť 61003077 (koralové poschodie + biele plochy prízemia `#eeebe6`, biele lizény, frontóniky, rímsa medzi podlažiami, kruhové okno vo východnom štíte) | nie | Hra kreslí jednu farbu fasády; `wall` je koralová, lebo je jej najviac. Biele pole prízemia by sa cez `retail.wall` dalo natrieť, ale prekrylo by okná prízemia (rovnaký problém má súd v `namestie.js`), preto nie je použité. Zostáva ako rozdiel voči Street View. Dáta: `todo` — „dvojfarebnosť fasády 61003077“. |
| 1.7 | 6 okien 61000413 a okná/balkóny 61003077 (polohy osí, farby rámov, francúzske balkóny, mreže) | nie | Hra generuje rozostup okien sama z fasádneho shaderu; presné osi sa zadať nedajú. Dáta: `todo` — „okná 61000413“, „okná 61003077“, „francúzske balkóny 61003077“, „mreže na oknách prízemia 61003077“, „štíty a zvody 61003077“, „východná štítová stena 61000413“. |
| 1.8 | 2 zapustené vchody 61000413 (s 30.2–32.1 a 47.3–48.5) a vstup 61003077 | nie | Zapustené vchody bez dverí hra nevie; `sc.doors` funguje iba pre budovy s presným staviteľom (`schemes`), nie pre `looks`. Dáta: `todo` — „zapustené vchody 61000413“; vstupné schodisko úradu práce viď 2.17. |
| 1.9 | Domy „CHÝBA V OSM?“ | — | Žiadne. Každá budova viditeľná v úseku má obrys v OSM (potvrdené balíkom aj `ray3.py`). |
| 1.10 | 61000168 Gorkého 10/1 a 906612344 (č. 2947) za koncom úseku | — | Mimo úseku, patria do ďalšieho úseku Gorkého. Prenesené nie sú, sú len v komentároch balíka. |
| 1.11 | Presklené výklady na prízemí Prima banky a súdu | áno (opravené) | Obidva domy majú v OSM značku obchodu (`fac = 4`), preto im generátor dával na prízemie tmavé výklady, ktoré v skutočnosti nemajú. V `namestie.js` im bolo doplnené iba pole `ft` — `60999098: ft: 2` (fasáda starého mesta) a `61000733: ft: 15` (občianska stavba); ostatné polia ich `looks` sa nemenili. Prízemie má teraz bežné okná. Overené renderom z G3, G4 a z námestia na obe hlavné fasády; porovnanie pred/po ukazuje zmenu len na týchto dvoch domoch, zvyšok námestia (dlažba, lampy, stromy, lavičky, veža, karner, tabule) je pixel po pixeli rovnaký. |

## 2. Doplnky k domom, ktoré looks nemajú (`retail`, `furniture`, `nameplates`, `todo`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 2.1 | Nápis „Prima Banka“ + logo na bočnej fasáde (s 4.6–7.2, h ≈ 4.1) | áno | `retail[0]`, položka `sign` s presetom `primaBanka`, `cut: true`. |
| 2.2 | Lososový sokel Prima banky ~0.9 m | áno | `retail[0]`, položka `wall` `[0,21.6] × [0,1.05]`, `#e8c9ae`. `v` sa meria od terénu, chodník je o 0.15 m vyššie, takže nad chodníkom ostane ~0.9 m. |
| 2.3 | Vetracie mriežky v sokli Prima banky (G3‑27 u213 a u740 → s ≈ 2.6 a 14.5) | áno | `retail[0]`, dve položky `box` v sokli. |
| 2.4 | 2 svetlosivé elektro skrinky na fasáde Prima banky (s 3.0 a 3.6) | nie | Chýbajúci typ: **Elektrické skrine, rozvádzače**. Dáta: `furniture` — dva záznamy `t: 'cabinet'` na `[262.4,−165.0]` a `[262.9,−164.7]`. |
| 2.5 | Zelené fólie na spodku okien prízemia Prima banky | nie | Do schémy sa nezmestí. Dáta: `todo` — „zelené fólie na spodku okien prízemia Prima banky“. |
| 2.6 | Tabuľa „OKRESNÝ SÚD SKALICA“ so štátnym znakom pri vchode (s ≈ 17.8) | áno | `retail[4]`, položka `sign` s presetom `board`. Štátny znak hra nemá, je nahradený dvojriadkovým textom. |
| 2.7 | Malá tabuľa so znakom na fasáde súdu (G3‑207 u60, s ≈ 17.4) | nie | Do schémy sa nezmestí. Dáta: `todo` — „malá tabuľa so štátnym znakom (súd)“. |
| 2.8 | Sivá skrinka so strieškou na koralovom múre podlubia súdu | nie | Do schémy sa nezmestí (vývesná skrinka so strieškou). Dáta: `todo` — „sivá skrinka so strieškou na múre podlubia súdu“. |
| 2.9 | Lososový sokel 61000413 ~1.0 m (`#ecc6ac`) | áno | `retail[1]`, položka `wall` `[0,33.7] × [0,1.15]` (0.15 z toho je pod chodníkom). |
| 2.9b | Lososový sokel na východnej štítovej stene 61000413 (x 307.1 → 311.5) | áno | `retail[2]`, samostatné líce `path [[307.0,−140.5],[311.4,−145.6]]`, `wall` `[0,6.74] × [0,1.15]`, `#ecc6ac`. |
| 2.10 | Truhlíky s červenými muškátmi na oknách 61000413 (s ≈ 27.5 a 35.9) | áno | `retail[1]`, dve položky `sign` s presetom `flowers`, `cut: true`. |
| 2.11 | 2 žlté plechové skrinky meračov na fasáde 61000413 (s 21.5–22.5) | nie | Chýbajúci typ: **Elektrické skrine, rozvádzače**. Dáta: `furniture`, `t: 'cabinet'` na `[279.1,−155.8]`. |
| 2.12 | Čierna schránka + zvončekový panel v ostení východného vchodu 1A (s 47.8) | nie | Chýbajúci typ: **Schránky (poštové)**. Dáta: `furniture`, `t: 'mailbox'` na `[301.6,−143.4]`. |
| 2.13 | Biela svetelná tabuľa pri západnom vchode (s 29.5), 2 tabuľky čísel + 2 mosadzné tabuľky (s 32.5), plochá modro‑bielo‑červená tabuľa nad oknom (s 51.5) | nie | Do schémy sa nezmestí (firemné tabule bez čitateľného textu). Dáta: `todo` — „firemné tabule 61000413“. Tabuľky čísel navyše aj v `nameplates` (viď 8.2). |
| 2.14 | Vystrčená obojstranná tabuľa s logom na fasáde 61000413 (s 47.3, h ≈ 4.3) | nie | Do schémy sa nezmestí. Dáta: `todo` — „vystrčená tabuľa s logom“. |
| 2.15 | Koralový sokel 61003077 ~1.0 m (`#cf7a68`) | áno | `retail[3]`, položka `wall` `[0,20.0] × [0,1.15]` (0.15 z toho je pod chodníkom). |
| 2.16 | Sivá skrinka na predsadenom bloku sokla 61003077 (s 41.3) a žltá skrinka HUP (s 36.5) | nie | Chýbajúci typ: **Elektrické skrine, rozvádzače**. Dáta: `furniture`, `t: 'cabinet'` na `[290.1,−135.2]` a `[285.9,−137.4]`. |
| 2.17 | Vstupné schodisko úradu práce so sklenenou strieškou (s 55.9–58.2) | nie | Chýbajúce typy: **Schody** a **Zastávky MHD / prístrešky** (prístrešok sa dá odvodiť z `buildShelter`). Dáta: `todo` — „vstupné schodisko so strieškou (úrad práce)“. |
| 2.18 | Vlajka EÚ na šikmom držiaku (s 59) + modrá informačná tabuľka pri vstupe (s 59.6) | nie | Do schémy sa nezmestí (vlajkový držiak); tabuľka patrí k chýbajúcemu typu **Smerové a informačné tabule**. Dáta: `todo` — „vlajka EÚ na držiaku“. |
| 2.19 | Kábel na fasáde súdu (G3‑117 u510–530) | nie | Chýbajúci typ: **Vedenia (káble)**. Neisté, či ide o kábel. Dáta: `todo` — „kábel na fasáde súdu“. |

## 3. Ploty, múry a brána (`fences`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 3.1 | Severná strana bez plotov (domy na uličnej čiare) | áno | Nič sa nekreslí — zodpovedá skutočnosti. Overené na všetkých 20 snímkach. |
| 3.2 | Súd 61000733 na uličnej čiare, s −1…22.4, bez plotu | áno | Nič sa nekreslí. |
| 3.3 | Nadväznosť roh súdu (273.3,−143.8) → začiatok múru (273.7,−141.5), s 22.4–23.8 | nie | Pripojenie múru na roh súdu nevidno (zakryté autom), preto sa nekreslí nič. **Neisté** — poznámka je v `fences` komentári. |
| 3.4 | Múr zo sivých betónových tvárnic so štiepaným povrchom, h 1.7, `#9a9288`, s 23.8–28.3 | áno | `fences[0]`, `type: 'block'`, `p: [[273.7,−141.5],[277.7,−139.4]]`. Typ `block` pridáva stĺpiky, ktoré múr v skutočnosti nemá, a nemá krycí kameň — malý rozdiel. |
| 3.5 | Dvojkrídlová otváravá brána dvora úradu práce, čierna oceľ `#3c3a38`, h 1.65, s 28.3–33.3 | áno (náhradou) | `fences[1]`, `type: 'slat'` (zvislé laty). Chýbajúci typ: **Brány a bránky** (krídla, stredný stĺpik, priehľadnosť medzi tyčkami). Pôvodný `rail` kreslil iba 2 vodorovné rúrky a brána bola na renderi takmer neviditeľná; `slat` je hustejší a tmavší než skutočná tyčková brána. Brána je zapísaná aj v `driveways[0].gate` podľa schémy. |
| 3.6 | Murovaný pilier / krátky múr zo sivých tvárnic, h 1.8, s 33.3–34.6 | áno | `fences[2]`, `type: 'stoneblock'`, `p: [[282.1,−137.1],[283.3,−136.5]]`. |
| 3.7 | Napojenie piliera na západný roh 61003077 (s 34.6–35.5) | áno | Vyplnené samotnou budovou, nič sa nekreslí. |
| 3.8 | 61003077 na uličnej čiare, s 35.5–55.5, bez plotu; s 55.5–60 otvorený priestor pred schodiskom | áno | Nič sa nekreslí. |
| 3.9 | Podmurovka pod plotom (`fences[].y0`, `base`) | — | V úseku nie je žiadny plot na podmurovke, pole sa nepoužíva. |
| 3.10 | Živý plot a čierny tyčkový plot parkoviska za koncom úseku (s ≈ 60–72) | — | Mimo úseku (iba z diaľky, ±1 m), neprenesené. Patrí do ďalšieho úseku Gorkého. |

## 4. Vozovka, chodníky, obrubníky, rigoly, trávniky (`roads`, `lots`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 4.1 | Vozovka asfalt `#9a958c`, obojsmerná, bez vodorovného značenia, šírka 5.4–5.7 m | áno (čiastočne) | `roads[1]` (`mat` neuvedený = asfaltová vozovka z OSM). OSM udáva šírku 6.0 m; obrubníky sú posunuté dnu cez `off: [−0.05, −0.6]`, takže viditeľná vozovka je ~5.35 m. Farbu vozovky sa zadať nedá (je z generátora). |
| 4.2 | Obrubníky betónové svetlosivé, `curbH ≈ 0.12` (**neisté** ±0.03) | nie | Chýbajúci typ: **Obrubníky – výška, typ, znížené pri vjazdoch**. Hodnota je zapísaná ako `curbH: 0.12` v oboch záznamoch `roads`; hra zatiaľ kreslí pevných 0.15 m. Poloha obrubníkov v pôdoryse je riešená cez `off` (juh t −2.95, sever t +2.4). |
| 4.3 | Zníženie obrubníka na konci trávnika pri križovatke G0 (s 55–57, sever, OSM 12734616111) | nie | Chýbajúci typ: **Obrubníky – výška, typ, znížené pri vjazdoch**. Dáta: `roads[0]` = samostatný malý box `[309.5,−139.5,313.5,−135]` s `curb: 'low'` podľa schémy (pole hra zatiaľ ignoruje); popis je aj v `todo` — „neoznačený prechod cez bočnú ulicu pri G0“. |
| 4.4 | Zníženie obrubníka pred bránou dvora (s 28.3–33.3) — **neisté** | nie | Chýbajúci typ: **Vjazdy do dvorov** (zníženie je jeho súčasťou). Dáta: `driveways[0]`, poznámka „zníženie obrubníka NEISTÉ“. |
| 4.5 | Severný chodník: betónová zámková dlažba s dekorom červených kociek, 2.0 m pri fasáde, s −1.5 → 55 | áno (čiastočne) | `roads[1].sw[1] = 5.4` (od obrubníka t +2.4 po uličnú čiaru), trávnik z toho ukrajuje (4.6). Voľnej dlažby pri fasáde ostáva 2.0 m pri s < 5 a 1.6–2.3 m ďalej (merané na renderi G1‑27: 2.04 m, SV 2.21 m); manko pri s 20–26 je tým, že obrys 61000413 v OSM leží o ~0.2–0.3 m bližšie k ceste než skutočná fasáda. Chýbajúci typ: **Chodníky – materiály** — vzor a farba zámkovej dlažby ani červený dekor sa zadať nedajú, hra má jednu textúru dlažby `#8c877e`. |
| 4.6 | Severný trávnatý pás medzi chodníkom a obrubníkom, s 1.8 → 54.8, šírka 2.8–2.9 m (s < 26) a 2.2 m (s > 31), oblé konce | áno (čiastočne) | `lots.islands[0]` (`LAWN_N`), vyvýšený ostrovček, `top: 'grass'`, `h: 0.18` (musí byť nad chodníkom `WALK_Y = 0.15`, inak ho dlažba prekryje). Hrany podľa balíka: vnútorná hneď za obrubníkom (t 2.6 pri s < 26, 2.4 pri s > 31), vonkajšia t 5.65 / 5.39 / 4.48 / 4.35. Oblé konce hra nevie (ostrovček je mnohouholník). |
| 4.7 | Južný chodník pri ústí k námestiu, s −1 → 4.5, ~3.5 m — **neisté** (autá) | áno | `roads[1].sw[0] = 3.5`. Pri križovatke chodník zvažuje generátor sám (zóna križovatky). |
| 4.8 | Južný chodník pred súdom 2.3 m + trávnatý pás 1.25 m pri obrubníku, s 4.5 → 21.9 | áno | `roads[1].sw[0] = 3.5` + `lots.islands[1]` (`LAWN_S`, `h: 0.18`). Začiatok pásu s ≈ 4.5 je **neistý ±1 m** (medzi autami), poznámka je v komentári nad `LAWN_S`. |
| 4.9 | Južná súvislá dlažba pred dvorom úradu práce, s 21.9 → 35.5, 5.0 m od obrubníka po múr | áno | `lots.islands[2]` (`YARD_WALK`), `top: 'walk'`, `h: 0.17` — vyvýšená dlažba nadväzujúca na chodník. |
| 4.10 | Južný chodník pred 61003077, 3.0 m, s 35.5 → 55.5, a dlažba pred schodiskom s 55.5 → 60 | áno | `roads[1].sw[0] = 3.5` (o 0.5 m viac, presah je skrytý pod budovou). |
| 4.11 | Rigol z 2–3 radov tmavých žulových kociek pozdĺž severného obrubníka, s 1.5–55 | áno | `lots.ribbons[0]`, `m: 'settsDark'`, šírka 0.35 m. |
| 4.12 | Rovnaký rigol pozdĺž južného obrubníka, s 22–55 (pred súdom s 4–22 zakrytý autami — **neisté**) | áno (iba istá časť) | `lots.ribbons[1]`, s 22–55. Neistý úsek s 4–22 nie je nakreslený, poznámka je v komentári. |
| 4.13 | Plocha z tmavosivých žulových kociek na rohu pri G0 (s 55–62, t 4–10) | áno (čiastočne) | `lots.surfaces[1]`, `m: 'settsDark'` `#6e6a66` — pás ~1.8 m pozdĺž východného štítu 61000413 a okolo záhonu. Širšia plocha podľa balíka sa nakresliť nedá: od s ≈ 57 ďalej je tam vozovka bočnej ulice (od jej osi ostáva > 3.3 m). Lem z väčších kociek chýba. Celý popis je aj v `todo` — „plocha zo žulových kociek na rohu“. |
| 4.16 | Dvor / parkovisko úradu práce za bránou (s 23.9–35.1, t −8…−18): asfalt | áno | `lots.surfaces[0]`, `m: 'asphalt'` `#5a5a57`. Predtým tu bol trávnik z terénu. Rozsah dvora smerom na juh sa zo snímok nedá určiť, polygón je konzervatívny (~11 × 10 m). |
| 4.14 | Plocha trávnika ako polygón (`lots/areaKinds`) | áno | Riešené cez `lots.islands`, nie cez `areaKinds` — ostrovček má obrubník a správnu výšku, `areaKinds` iba prepisuje značku existujúcej OSM plochy (tu žiadna nie je). |
| 4.15 | Spomaľovače | — | V úseku nie sú. |

## 5. Lampy (`lamps`, `lots.lamps`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 5.1 | Historická liatinová lampa s lucernou, s 8.1 t 3.6, h 4.8, `#2a2c2e`, pod lucernou kovaný držiak na kvetináč | áno (čiastočne) | `lamps[0]` podľa schémy (`p`, `dir: 0`, `t: 'lantern'`, `h: 4.8`, `color`) **aj** `lots.lamps[0]` na `[265.1,−159.0]`, aby bola lampa vidieť už teraz. Chýbajúci typ: **Stĺpy verejného osvetlenia – typy** — výška (`lantern` má pevných 3.7 m, nie 4.8), farba ani držiak na kvetináč sa zatiaľ zadať nedajú. Po tech/prvky treba `lots.lamps` z tejto štvrte vypustiť, inak sa lampy nakreslia dvakrát (upozornenie je v komentári nad `lamps`). |
| 5.2 | Rovnaká lampa, s 29.9 t 3.2, h 4.8 | áno (čiastočne) | `lamps[1]` + `lots.lamps[1]` na `[284.2,−148.6]`, to isté obmedzenie. |
| 5.3 | Rovnaká lampa, s 51.2 t 3.2, h 4.7, nesie značku B33 | áno (čiastočne) | `lamps[2]` + `lots.lamps[2]` na `[303.2,−138.9]`, to isté obmedzenie. Značka na stĺpe viď 6.3. |
| 5.4 | Zmazanie lámp z mapy v úseku | áno | `lots.clear` (koridor ulice s −3…60, t −13…+12) + `lots.clearLamps: true`. Zmazali sa 2 lampy z OSM na južnej strane (`[274.4,−145.6]`, `[301.1,−131.9]`), ktoré v Street View nie sú, a procedurálny ihličnan z mapy vo dvore úradu práce (`[275.1,−136.0]`), ktorý v zábere G1‑207 (17 m) tiež nie je. Pole podľa schémy je aj v `clearLamps: [[250,−170,310,−128]]`. |
| 5.5 | Iné lampy v úseku | — | Nie sú (na južnej strane žiadna) — potvrdené balíkom. |

## 6. Zvislé dopravné značky (`trafficSigns`)

Všetkých päť riadkov je **v hre nie**, chýbajúci typ: **Zvislé dopravné značky**. Dáta sú v `trafficSigns` v `centrum1.js`.
Uchytenie na bránu, plot alebo stenu schéma po rozšírení Technikom pozná (`on: 'gate'` / `'fence'` / `'wall'`), v úseku sa používa iba `on: 'gate'` pri B1 (6.4) a `on: 'lamp'` pri B33 (6.3).

| # | Položka | Kde v dátach |
|---|---|---|
| 6.1 | P1 „Daj prednosť v jazde!“ + E2b (tvar križovatky), s 3.5 t 4.1, h 2.3, sivý stĺpik; poloha ±1 m | `trafficSigns[0]`, `p: [261.2,−161.6]`, `dir: 117` |
| 6.2 | B33 Zákaz státia + A22 Deti, s 21.3 t −4.1, h 2.2, sivý stĺpik | `trafficSigns[1]`, `p: [273.3,−146.0]`, `dir: 310` |
| 6.3 | B33 Zákaz státia na stĺpe lampy, s 51.2, h 2.5 | `trafficSigns[2]`, `p: [303.2,−138.9]`, `on: 'lamp'` |
| 6.4 | B1 Zákaz vjazdu na západnom stĺpiku brány dvora, s 28.3 t −8.0, h 1.8 | `trafficSigns[3]`, `p: [277.7,−139.4]`, `dir: 27`, `on: 'gate'`. Technik schému rozšíril o `on: 'gate'` / `'fence'` / `'wall'` (značka bez vlastného stĺpika, tabuľa vo výške `h`, líce podľa `dir`), takže záznam je odteraz schémový a ostáva nezmenený. **Overenie `h`:** `h: 1.8`, `dir: 27` aj `p` sú presne hodnoty z `zariadenie.txt` (strojové porovnanie). Nezávislá fotogrametria z dvoch pohľadov (G1‑207 u723–736 v252–265 a G1‑297 u192–201 v253–264; kamera 2.5 m, f = 258 px) dáva priemer tabule 0.45 m a stred 2.47 / 2.48 m nad vozovkou, teda ~2.3 m nad chodníkom — o ~0.7 m viac než `h` z balíka. Rovnaký posun +0.7 až +0.9 m vychádza aj pri P1 (6.1) a B33+A22 (6.2), takže ide o systematický rozdiel voči balíku, nie o chybu tejto položky; vzájomné výšky značiek sedia. Hodnota sa preto nemenila. |
| 6.5 | B34 Zákaz zastavenia, biely naklonený stĺpik, s 62.5 t 7.8 — **mimo úseku**, `dir` neisté | `trafficSigns[4]`, `p: [315.4,−137.8]` |
| 6.6 | Sivý stĺpik bez viditeľnej značky pred súdom (s 6.1, h ≈ 2.5) — **neisté**, či nesie značku otočenú hranou | `todo` — „stĺpik bez značky“ |
| 6.7 | Semafory | — v úseku nie sú |

## 7. Priechody a vodorovné značenie (`crossings`, `markings`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 7.1 | Zebra cez ústie Gorkého pri námestí (s −1.1…1.2, w 2.3, znížené obrubníky), OSM 9260694064 | nie | Hra síce zebru z OSM generuje (`r.k === 11` v `CITY.buildRoads`), ale dlažba námestia (PLAZA) ju prekryje: na renderi G3‑297 z nej vidno len 2 krátke čiarky na okraji asfaltu. Vyrieši ju tech/prvky z `crossings[0]` (`w 2.3`, `drops: true`) — pri kreslení treba dbať na to, aby sa nezdvojila s automatickou zebrou z `k = 11`. V dátach zdvojená nie je: `namestie.js` zebru nemá a v centrum1 je len raz. Chýbajúci typ: **Priechody pre chodcov**. |
| 7.2 | Žltá prerušovaná čiara na obrubníku (zákaz státia), s 52.5 → 62.6, `w 0.15` | nie | Chýbajúci typ: **Vodorovné značenie** (žlté značenie sa nedá zadať). Dáta: `markings[0]`. |
| 7.3 | Iné vodorovné značenie | — | V úseku nie je. Nápis „Gorkého“ na vozovke v snímkach je popis Google, nie skutočnosť. |

## 8. Tabuľky s názvom ulice a čísla (`nameplates`)

Oba riadky sú **v hre nie**, chýbajúci typ: **Názvy ulíc** (uličné tabuľky na fasádach a popisné čísla). Dáta sú v `nameplates`.

| # | Položka | Kde v dátach |
|---|---|---|
| 8.1 | Červená tabuľka „Gorkého“ s bielym písmom na nároží Prima banky, s 0.5, h 3.3 | `nameplates[0]`, `p: [260.1,−166.1]` |
| 8.2 | 2 tabuľky čísel (červený a čierny rámik) vpravo od západného vchodu 61000413, s 32.5, h 3.5, text nečitateľný | `nameplates[1]`, `p: [288.2,−150.6]` |

## 9. Vjazd do dvora (`driveways`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 9.1 | Vjazd do dvora úradu práce, s 28.3–33.3, šírka 5.0 m, dlažba, brána swing `#3c3a38` h 1.65 | nie (ako prvok) | Chýbajúci typ: **Vjazdy do dvorov**. Dáta: `driveways[0]`, `p: [279.9,−138.3]`. Viditeľné náhrady: samotná brána je nakreslená ako `fences[1]` (typ `slat`), 5 m hlboká spevnená plocha pred ňou ako `lots.islands[2]` a asfalt dvora za bránou ako `lots.surfaces[0]`. Zníženie obrubníka a iný povrch vjazdu cez chodník sa zatiaľ nekreslia; zníženie je aj tak **neisté**. |

## 10. Poklopy, vpuste, skrinky, schránka (`furniture`)

Poklopy a vpuste sú **v hre nie**, chýbajúci typ: **Poklopy, kanály, uličné vpuste**. Skrinky viď 2.4/2.11/2.16 (**Elektrické skrine, rozvádzače**), schránka viď 2.12 (**Schránky (poštové)**). Všetko je v `furniture`.

| # | Položka | Kde v dátach |
|---|---|---|
| 10.1 | Štvorcový poklop/záplata v strede vozovky, s 28.4 t −1.1, w 0.9 | `furniture`, `t: 'manhole'`, `[281.0,−145.5]` |
| 10.2 | Okrúhly liatinový poklop vo vozovke, s 58.5 t −0.5 | `furniture`, `t: 'manhole'`, `[308.0,−132.3]` |
| 10.3 | Štvorcový liatinový poklop v chodníku pred súdom, s 19.2 t −5.0, w 0.6 | `furniture`, `t: 'manhole'`, `[271.0,−146.2]` |
| 10.4 | Uličná vpusť v rigole pri severnom obrubníku, s 28.1 t 2.3 | `furniture`, `t: 'drain'`, `[282.2,−148.7]` |
| 10.5 | Uličná vpusť pri južnom obrubníku, s 27.6 t −2.9 | `furniture`, `t: 'drain'`, `[279.4,−144.3]` |
| 10.6 | Okrúhla mriežka/vpusť pri južnom obrubníku pred súdom, s 19.9 t −2.6 — **neisté**, či vpusť alebo poklop | `furniture`, `t: 'drain'`, `[272.7,−148.1]` |
| 10.7 | Vpusť pri južnom obrubníku, s 15.9 — **neisté** (pri kolese auta) | `furniture`, `t: 'drain'`, `[269.4,−150.4]` |
| 10.8 | Uličná vpusť pri južnom obrubníku pred úradom práce, s 57.5 t −3.1 | `furniture`, `t: 'drain'`, `[305.9,−130.4]` |
| 10.9 | Lavičky, smetné koše, kontajnery na ulici, hydranty, poštové schránky, informačné tabule, reklamné plochy | — v úseku nie sú (overené) |
| 10.10 | Modré a čierne kontajnery vo dvore úradu práce za bránou (s ≈ 29–33, t ≈ −10) | — nie sú na ulici, neprenesené |

## 11. Zeleň a `todo`

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 11.1 | Stromy v úseku s 0–58 | — | Žiadny strom nie je. `lots.trees` v štvrti je, ale obsahuje iba trs okrasnej trávy zo záhonu (11.4). |
| 11.2 | Malý okrasný strom pri s 71.6 (mimo úseku) | — | Mimo úseku, neprenesené. |
| 11.3 | Záhon so štrkom pred východným štítom 61000413 (~0.9 × 2.5 m, biely štrk lemovaný žulovými kockami) | áno (čiastočne) | `lots.surfaces[2]`, `m: 'gravel'`. Lem z kociek sa nekreslí; okolo záhonu je plocha zo žulových kociek (4.13). |
| 11.4 | Trs okrasnej trávy (miskant/pennisetum, h ≈ 1.1, priemer 0.9) v záhone | áno (náhradou) | `lots.trees[0]`, `p: [310.9,−143.6]`, `k: 35` (bushC, základ 1.7 m — najnižší dostupný variant) a `h: 1.1` podľa schémy `trees` (hra `h` zatiaľ ignoruje). Chýbajúci typ: **Stromy – veľkosti a presná podoba** — mierku sa zadať nedá (hra ju losuje 0,75–1,3), takže ker vyjde ~1,3–2,2 m namiesto 1,1 m; druh okrasnej trávy hra nepozná. Vidno to na renderi `312.2_-136.4_27.png`. |
| 11.4b | Malá sivozelená rastlina v záhone vedľa trsu | nie | Dáta: `todo` — „malá sivozelená rastlina v záhone“, `p: [311.8,−144.0]` (poloha odvodená zo záhonu, ±0.5 m). Nekreslí sa: hra nemá nízku rastlinu, najmenší ker by bol niekoľkonásobne väčší. Chýbajúci typ: **Stromy – veľkosti a presná podoba**. |
| 11.5 | Voľné kvetináče na ulici | — | Nie sú; muškáty sú na oknách (2.10). |
| 11.6 | Stojan s reklamnou tabuľou pred vchodom 1A (s 47.7 t 4.4) | nie | Do schémy sa nezmestí. Dáta: `todo` — „stojan s reklamnou tabuľou“. |

Ostatné položky `todo` sú vymenované pri 1.5, 1.6, 1.7, 1.8, 2.5, 2.7, 2.8, 2.13, 2.14, 2.17, 2.18, 2.19, 4.3, 4.13, 6.6 a 11.4b. Spolu má `todo` 25 položiek.

## 12. Parkovanie, stĺpy vedenia

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 12.1 | Vyznačené parkovacie miesta | — | V úseku nie sú. `parking` ani `streetParking` sa nepoužívajú. |
| 12.2 | Autá stojace pozdĺžne pri južnom obrubníku pred súdom (bez značenia) | nie zámerne | Zaparkované autá sú v hre vypnuté (`?cars=1`), a `lots.clear` ich v koridore ulice aj tak maže. |
| 12.3 | Stĺpy elektrického a telefónneho vedenia, vedenia nad ulicou | — | V úseku žiadne nie sú (skontrolovaných všetkých 20 snímok), preto `poles` ani `wires` v súbore nie sú. Poznámka je v komentári. |

---

## Rozdiely voči Street View, ktoré ostali

Rendery: 5 stanovísk × 4 smery, 800 × 516 px, zvislé zorné pole 90° (f = 258 px), kamera 2.5 m nad vozovkou,
kalibrované polohy kamier, čas v hre 13:12 (`?t=0.55`). Skript: `prieskum/centrum1/render_gorkeho.py`.

1. **Osvetlenie.** Snímky sú zamračené (október), hra má vždy slnko. Gorkého vedie VJV–ZSZ, takže severná strana (líce 207°) sa dá nasvietiť, ale južná strana (líce 27°, súd a úrad práce) je v hre vždy v tieni a jej farba vychádza tmavšia a sýtejšia než na snímkach. Časom dňa sa to nedá vyriešiť.
2. **Rozmiestnenie a veľkosť okien.** Hra generuje osi okien sama; 61000413 má v hre menšie a hustejšie okná než v skutočnosti (6 veľkých s hnedými rámami), 61003077 má 3 okná na podlažie namiesto 5 + úzke. Nedá sa zadať.
3. **Dvojfarebnosť 61003077** (biele plochy prízemia, lizény, frontóniky, kruhové okno vo východnom štíte) chýba, budova je celokoralová.
4. **Zámková dlažba** chodníkov je v hre jedna sivá textúra bez červeného dekoru z kosoštvorcov.
5. **Trs okrasnej trávy** v záhone je vykreslený ako generický ker (`k 35`) asi 1,3–2,2 m vysoký namiesto 1,1 m (pozri 11.4); malá sivozelená rastlina vedľa neho chýba.
6. **Výška lámp** je 3.7 m namiesto 4.8 m (typ `lantern` má pevnú výšku), poloha aj tvar sedia.
7. **Nárožné domy z `namestie.js`:** presklené výklady na prízemí Prima banky a súdu sú opravené doplnením `ft` do ich `looks` (viď 1.11). Ostatné rozdiely týchto dvoch domov (súd je v hre koralový, v skutočnosti bielo‑sivý s koralovým soklom, a nemá podlubie) vyplývajú z ich `looks` v `namestie.js` a tento PR ich nemení.
8. **Poloha severného obrubníka.** Prieskum udáva t 2.7 pri s < 26 a 2.35 pri s > 31. Hra vie pre celý úsek iba jednu hodnotu: OSM way Gorkého nemá medzi námestím a križovatkou pri G0 vrchol a `CITY.buildRoads` vyhodnocuje `roadOverride` na strede prevzorkovaného úseku (nové body vkladá len pri križovatkách). Zvolené je t 2.4 (`off[1] = −0.6`), takže pri s < 26 je obrubník o ~0.3 m bližšie k osi než v skutočnosti; pri s > 31 sedí. Opačná voľba (2.7) by pri s > 31 nechala trávnik ležať na vozovke.
9. **Prvky mimo úseku** (dom 61000168 na rohu, parkovisko za úradom práce, veža na obzore) nie sú spracované a v renderoch sa líšia; patria do ďalších úsekov.
10. Všetko, čo je v tabuľkách vyššie označené „v hre nie“ (značky, tabuľky, poklopy, vpuste, skrinky, žlté značenie, vjazd, schodisko úradu práce, stojan s tabuľou) v renderoch prirodzene chýba.

## Zhrnutie neistôt prenesených z balíka

- `curbH 0.12` je odhad ±0.03 (bez kolmého pohľadu na čelo obrubníka) — `roads[].curbH`, komentár „neisté“ v `prvky.md` 4.2.
- Rozsah asfaltového dvora úradu práce smerom na juh sa zo snímok nedá určiť; polygón `lots.surfaces[0]` je konzervatívny (11 × 10 m) — komentár v `lots.surfaces`.
- Zníženie obrubníka pred bránou dvora sa zo snímok nedá určiť — `driveways[0].note`.
- Začiatok južného trávnika pred súdom (s ≈ 4.5) je neistý ±1 m — komentár nad `LAWN_S`.
- Pripojenie múru na roh súdu (s 22.4–23.8) nevidno — komentár v `fences`.
- Výšky zvislých značiek z balíka vychádzajú pri fotogrametrickom prepočte o ~0.7–0.9 m nižšie, než kde tabule v skutočnosti sú (overené pri B1, P1 a B33+A22 z dvoch pohľadov). Prevzaté sú hodnoty z balíka; posun je systematický, nie chyba jednej položky — na rozhodnutie pre Prieskumníka.
- Južný rigol v úseku s 4–22 je zakrytý autami — kreslený je len od s 22.
- `dir` značky B34 (mimo úseku) je neisté — `trafficSigns[4].note`.
- Okrúhla mriežka pri s 19.9 a vpusť pri s 15.9 sú neisté — `furniture` `note`.
- Stĺpik bez značky pred súdom (s 6.1) — `todo`.

---

# B. Štefánikova (1. úsek)

Zdroj: prieskumný balík `centrum1_stefanikova` (sekcie `## Štefánikova` v `looks.txt`, `ploty.txt`, `zariadenie.txt`, `trasa.md`,
`poznamky_timu.md`), Street View 10/2022 zo stanovísk Š0–Š9 (40 snímok) a satelit `sat_Stefanikova_1.png`.
Úsek: OSM way 1299698076, (120.6,−182.1) → (−1.8,−123.9), dĺžka 135.7 m. Os je lomená, lomy pri s 6.9, 40.2 a 75.9.
`s` = vzdialenosť pozdĺž osi od námestia, `t` = kolmo (+ sever = park a dláždená plocha, − juh = radnica a rad domov).
Sekciu „## Námestie – oprava“ z balíka tento PR nespracúva (patrí do vetvy `stvrt/namestie-oprava`).

## Prepočet smerov na konvenciu kódu

Prieskum udáva `dir` v stupňoch od severu (0 = sever, rastie v smere hodinových ručičiek). Kód pracuje s matematickým
uhlom v rovine x–z (0 = +x = východ, rastie k +z = juh). Platí:

**uhol_kódu = dir − 90**

| Kľúč | Čo uhol znamená | Vzorec | Štefánikova |
|---|---|---|---|
| `looks[].ang` | smer hrebeňa strechy | `dir − 90` | hrebeň 243° → `ang 153` (Gorkého 117° → 27) |
| `lots.lamps[].a` | os ramien kandelábra | `dir − 90` | ramená kolmo na ulicu, dir 153 → `a 63` |
| `furniture` `t: 'bench'` `ang` | os **sedadla**, nie smer pohľadu; sediaci hľadí o 90° vedľa | `dir − 180` | sediaci k ulici dir 153 → `ang 333` |
| `furniture` `t: 'adColumn'` `rot` | natočenie plagátov, jednotka je **otáčka**, nie stupeň | `(dir − 90) / 360` | dir 153 → `rot 0.175` |

Overené renderom: pri `ang 333` je operadlo lavičky na severnej strane a sediaci hľadí na JJV k ulici
(kontrolný pohľad z (15.77,−141.44) smerom 333° ukazuje lavičku spredu, operadlo za ňou).

## Š1. Domy (`looks`, `extraBuildings`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| Š1.1 | 60997383 Štefánikova 136/1, biely historický dom so štukovou výzdobou, `wall #e2dfd6`, 2 podl., `fh 3.7`, `eave 7.9`, sedlová, `rh 4.5`, `roofColor #a97873` | áno | `looks[60997383]`, `ang 153`, `ft 2`, `mat PLASTER`. Rovnaké hodnoty ako 60999413 — obidva obrysy tvoria vizuálne jeden dom (spoločná rímsa aj strecha), preto ani na hranici s 80 nie je vidieť švík. |
| Š1.2 | 60999413 východná časť toho istého domu s prejazdom | áno | `looks[60999413]`, hodnoty zhodné s Š1.1. |
| Š1.3 | 1174039013 Štefánikova 2600/3A, žltá prízemná reštaurácia TÁČKAREŇ, `wall #efc585`, `fh 3.4`, `eave 4.7`, sedlová, `rh 4.0`, `roofColor #b48f88` | áno | `looks[1174039013]`, `ang 153`, `ft 2`. |
| Š1.4 | 61002459 Štefánikova 135/3, PIZZA APETITO, to isté farebné riešenie | áno | `looks[61002459]`, hodnoty zhodné s Š1.3. **`ft: 2` je doplnené zámerne:** v OSM má obchodnú značku (`fac 4`) a bez `ft` by dostala presklené prízemie, kým TÁČKAREŇ nie, takže by bol na hranici obrysov vidieť švík (bod 4 zadania). Výklady Apetita nahrádza tabuľa (Š2.4). |
| Š1.5 | 61001176 Štefánikova 2163/5 (Raiffeisen BANK), `wall #eccdb5`, 2 podl., `fh 3.6`, `eave 7.9`, sedlová, `rh 4.5`, `roofColor #966f66` | áno | `looks[61001176]`, `ang 153`, `ft 2`. |
| Š1.6 | 61000307 Štefánikova 134/7, to isté farebné riešenie | áno | `looks[61000307]`, hodnoty zhodné s Š1.5. |
| Š1.7 | Časť bloku nad prejazdom (s 110 → 112.9), vyšší rizalit s balkónmi, `eave ≥ 10.5` | áno (náhradou) | **CHÝBA V OSM.** `extraBuildings[0]`, id `9000002`, `like: 61001176`, polygón `[[25.2,−127.3],[22.8,−125.9],[25.9,−120.6],[28.4,−121.9]]`, `look` s `eave 10.6`, `floors 3`, `rh 3.2`. Prejazd pod ním (2.6 × 3.4 m) v hre **nie je priechodný** — engine vie diery iba ako dvory (`holes` v obryse), nie otvor v prízemí; zapísané v `todo` („dom nad prejazdom chýba v OSM“). |
| Š1.8 | 60999339 Štefánikova 133/7A, MÄSIARSTVO U BÝKA, koralová prízemná predajňa, `wall #da7f6d`, `eave 3.8`, valbová, `rh 5.0`, `roofColor #b87260` | áno | `looks[60999339]`, `ang 153`, `ft 2` (OSM `fac 4` by dal celopresklené prízemie, v skutočnosti je tam múr s jedným výkladom a dverami). |
| Š1.9 | 60999883 Štefánikova 138/10, dlhý biely obchodný dom (Orange, La Donuteria), `wall #f2eee2`, `eave 3.6`, valbová, `rh 3.0`, `roofColor #b5623f` | áno | `looks[60999883]`, `ang 153`, **`ft 4`** — má 7–8 prevádzok s presklenými výkladmi, ale OSM `cat 5` by ich sám nedal. |
| Š1.10 | 1488770549 Štefánikova 138/8, biely dom so štítom za múrom | áno (čiastočne) | `looks[1488770549]`, bez `ang` — smer hrebeňa je zo snímok neistý (do ulice vidno iba múr, viď Š3.1). |
| Š1.11 | 60998021 Potočná 195/31, nárožný dom na konci úseku | áno | `looks[60998021]`, `ft 2`, bez `ang` (valbová strecha, smer hrebeňa sa z 25 m cez stromy neurčil). Podľa rozhodnutia vedúceho patrí k Štefánikovej, nie k Potočnej. |
| Š1.12 | 60997157 Štefánikova 2597/2, pavilón/kaviareň v parku | áno | `looks[60997157]`, `ft 2`, bez `ang`. Presnosť nízka (35–40 m od kamery). |
| Š1.13 | 61001746 radnica — južná fasáda do Štefánikovej nie je jednofarebná (4 úseky) | nie | Radnica má `looks` v `namestie.js` a podľa rozhodnutia vedúceho ju tento PR **nemení**; ide do vetvy `stvrt/namestie-oprava`. Popis všetkých štyroch úsekov je v `todo` — „ŠT: radnica 61001746 – južná fasáda nie je jednofarebná“. |
| Š1.14 | 60999034 ZUŠ / Ľudová škola umenia | — | Adresa Jatočná, hľadí do parku → patrí ulici Jatočná. `looks` sa nezapisuje, popis je v `todo`. |
| Š1.15 | Domy „CHÝBA V OSM?“ okrem Š1.7 | — | Žiadne ďalšie. Každý ostatný dom viditeľný v úseku má obrys v OSM (overené v `data/game.json`). |

## Š2. Doplnky na fasádach (`retail`)

Pri všetkých platí: `v` sa meria od terénu, chodník je o 0.15 m vyššie, takže sokel 0.6 m nad chodníkom = `v [0, 0.75]`.
Južné fasády hľadia na SSZ (333°), pri `path` v smere rastúceho `s` je to `side: 1`; severné hľadia na JJV (153°) → `side: -1`.

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| Š2.1 | Svetlosivý sokel 60997383 + 60999413, ~0.6 m (`#c3bdb9`) | áno | `retail`, `path [[61.1,−144.5],[46.4,−138.1]]`, `wall [0,16.03] × [0,0.75]`. |
| Š2.2 | Okrový sokel 1174039013 + 61002459, ~0.4 m (`#dfa159`) | áno | `retail`, `path [[46.4,−138.1],[32.2,−131.1]]`, `wall [0,15.83] × [0,0.55]`. |
| Š2.3 | Tabuľa „TÁČKAREŇ“ nad vchodom (s 88–90.5, h ≈ 3.3) | áno | `retail`, `sign` s presetom `board`. Logo (kruh s príborom) hra nevie, je nahradené textom. |
| Š2.4 | Nápis „PIZZA APETITO“ (s 97–100.5, h ≈ 3.8) | áno | `retail`, `sign` `board`. Dvojfarebný nápis (zelené PIZZA + červené APETITO) a logo kuchára hra nevie; pruhovaná markíza pod ním chýba — `todo`. |
| Š2.5 | Sivý sokel 61001176 + rizalit + 61000307, ~0.5 m (`#a99891`) | áno | `retail`, `path [[32.2,−131.1],[9.3,−118.9]]`, `wall [0,25.95] × [0,0.65]` — jedno líce cez všetky tri časti, aby nebol vidieť švík. |
| Š2.6 | Tabuľa „Raiffeisen BANK“ (s 103.6–106.3, h ≈ 3.4) | áno | `retail`, `sign` `board` (čierna so žltým textom). |
| Š2.7 | Tabuľa „KANCELÁRSKE POTREBY“ s erbom (s 116–119.5) | áno | `retail`, `sign` `board` (zelená). Erb hra nevie. |
| Š2.8 | Tabule „CENTRUM POISTENIA“ + „CENTRUM ÚVEROV“ (s 120–124.5) | áno | `retail`, jeden `sign` `board` s dvoma riadkami namiesto dvoch tabúľ. |
| Š2.9 | Tmavočervený sokel 60999339, ~0.3 m (`#ab3d29`) | áno | `retail`, `path [[9.3,−118.9],[0.1,−112.8]]`, `wall [0,11.04] × [0,0.45]`. |
| Š2.10 | Červený pás s nápisom „MÄSIARSTVO U BÝKA“ (s 131–134, h ≈ 3.0) | áno | `retail`, `sign` `board`. |
| Š2.11 | Okrovohnedá podmurovka 60999883, ~0.5 m (`#c49a70`) | áno | `retail`, `path [[22.9,−157.5],[−2.5,−143.4]]`, `wall [0,29.05] × [0,0.65]`, `side: -1`. |
| Š2.12 | Modrý svetelný výklad Orange (s ≈ 110.5) | áno | `retail`, `sign` `board` (oranžová). |
| Š2.13 | Sivá skrinka (zvončeky/elektro) na fasáde pri prejazde, s 113.7 | nie | Chýbajúci typ: **Elektrické skrine, rozvádzače**. Dáta: `furniture`, `t: 'cabinet'`, `[22.0,−125.5]`. |
| Š2.14 | Dvojfarebnosť 61001176/61000307 (prízemie lososové `#e3b698`) | nie | Hra kreslí jednu farbu fasády; natrieť prízemie cez `retail.wall` by prekrylo výklady aj vchody (rovnaký problém ako pri úrade práce na Gorkého). Dáta: `todo`. |
| Š2.15 | Ostatné detaily fasád (rímsy, suprafenestry, vikiere, strešné okná, balkóny, markíza, menu tabule, zvody, komíny, makovice, mreže) | nie | Hra generuje raster okien sama a kreslí holú strešnú rovinu. Dáta: `todo` — „ŠT: detaily fasád južného radu“ a „ŠT: detaily fasád severnej strany“ (položka po položke s osami `s`). |

## Š3. Ploty, múry a brány (`fences`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| Š3.1 | Múr pred 1488770549, s 88–98, h 2.3, oranžovolososový `#d9a07c` s tmavou krycou doskou `#6e5a50`, 1 murovaný pilier pri s ≈ 90 | áno (čiastočne) | `fences`, `p: [[32.27,−162.31],[23.35,−157.56]]`, **`type: 'wall'`** (omietnutý múr s krycou doskou). Balík navrhuje `brick`, ten však kreslí tehlovú textúru a pevne sivú dosku — `wall` vie zadať farbu dosky. Samostatný pilier hra nevie. |
| Š3.2 | Dvojkrídlová kovaná mreža v prejazde pod rizalitom, s 110–112.9, h 3.2, `#2a2a2a` | áno (náhradou) | `fences`, `p: [[25.17,−127.51],[22.58,−126.2]]`, `type: 'slat'` (zvislé laty). Chýbajúci typ: **Brány a bránky** (krídla, oblúkový vrch podľa oblúka prejazdu, priehľadnosť). Leží 0.3 m pred uličnou čiarou, aby bola pred čelom domu `9000002` vidieť. |
| Š3.3 | Nízke drevené zábradlie terasy pri pavilóne v parku, s 27–34, t ≈ 32, h 1.0, `#8a6a4e` | áno | `fences`, `p: [[76.6,−198.8],[82.6,−202.7]]`, `type: 'wood'`. Poloha ±2 m (35–40 m od kamery). |
| Š3.4 | Iné ploty | — | Južná strana je celá na uličnej čiare bez plotov; severná tiež (park je voľne prístupný, bez plôtika aj obrubníka). Živé ploty v úseku nie sú. |

## Š4. Vozovka, chodníky, obrubníky, plochy (`roads`, `lots`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| Š4.1 | Vozovka celá zo žulových kociek (sett), sivá `#a19991`, kladená v oblúkoch, bez vodorovného značenia | áno (čiastočne) | Hra ju kreslí kockami už z OSM (`surface=sett` → `cob 1`, odtieň `#7f786e`). Podľa rozhodnutia vedúceho je v dátach `roads[].surface: 'settsDark'` na všetkých troch záznamoch Štefánikovej aj na ústí Jatočnej; hra toto pole zatiaľ nečíta, nakreslí ho tech/prvky. Presný odtieň z prieskumu (`#a19991`) a oblúkové kladenie sa v schéme zadať nedajú. |
| Š4.2 | Šírka medzi obrubníkmi 8.7–10.0 m (sever +2.0…+4.1, juh −5.1…−6.8) | áno (čiastočne) | OSM udáva `w 7.0` a os leží ~1.8 m severne od skutočnej osi vozovky. Obrubníky sú posunuté cez `off`: `[2.8, −0.7]` (s 0–40), `[3.1, −1.35]` (s 40–68), `[2.4, 0]` (s 83–136). Kladné `off` na juhu znamená, že obrubník je mimo OSM vozovky — pás medzi nimi dopĺňajú tri polygóny `lots.surfaces` s `m: 'settsDark'` a odtieňom `#7f786e` (zhodným s kockami z mapy), takže švík nie je vidieť. Namerané na renderi Š7‑153: obrubník t −5.9…−6.2, fasáda t −9.4 (prieskum −5.9…−6.2 a −9.3). |
| Š4.3 | Obrubníky kamenné sivé, `curbH ≈ 0.12–0.15` (**neisté** ±0.03) | nie | Chýbajúci typ: **Obrubníky – výška, typ**. Hodnota `curbH: 0.13` je vo všetkých štyroch záznamoch `roads`; hra zatiaľ kreslí pevných 0.15 m. |
| Š4.4 | Zníženia obrubníka pri oboch zebrách (`drops`) | nie | Chýbajúci typ: **Priechody pre chodcov**. Dáta: `crossings[].drops: true`. |
| Š4.5 | Južný chodník, betónová dlažba, 3.1–4.4 m (s 5–35: 3.7 m, s 50–70: 3.1–3.4 m, s 100–136: 3.3 m) | áno | `roads[].sw[0]` = 3.7 / 3.3 / 3.4 podľa boxu. Chýbajúci typ: **Chodníky – materiály** (obdĺžnikové sivé dlaždice vs. veľké štvorcové od s 100 sa zadať nedajú, hra má jednu textúru). |
| Š4.6 | Severný chodník pri parku, betónové dlaždice `#c2beb6`, 1.7–2.0 m (s 5–80) | áno | `roads[].sw[1]` = 1.9 v prvých dvoch boxoch. |
| Š4.7 | Súvislá dláždená plocha na severe (s 86–136, od obrubníka t ≈ 4 po fasády a múr t 18.5–21), žulové kocky `#b9ac98` v oblúkovom vzore | áno (čiastočne) | `lots.islands` `PLOCHA_S`, `top: 'setts'`, `h: 0.17`, `kerb: '#a6a29a'` — vyvýšená plocha s obrubníkom po celom obvode, teda hrana k vozovke je obrubník ako v skutočnosti. V tomto úseku má preto `roads[].sw[1] = 0` (chodník by plochu prekryl). Odtieň sa pri ostrovčeku zadať nedá (materiál `setts` má pevných `#77726a`), vnútorná hrana je na t 3.5 namiesto 4.0, aby medzi vozovkou a obrubníkom nezostal pás terénu. Oblúkový vzor kladenia hra pre ostrovček nevie (`fan` má iba `surfaces`). |
| Š4.8 | Rigol z 2–3 radov menších kociek pozdĺž oboch obrubníkov (~0.3 m, na strane chodníka) | áno (čiastočne) | `lots.ribbons` — 4 pásy (sever park, sever plocha, juh s 4–76, juh s 83–136), `w 0.35`, `m: 'settsDark'`, `c: '#5e5952'`. Kreslené sú na strane vozovky, nie chodníka: chodník je vyvýšený o 0.15 m a pás pod ním by nebolo vidieť. |
| Š4.9 | Park (trávnik) severne od chodníka, s 5–80 | áno | OSM `village_green 38422243` — plocha už v hre je, štvrť ju nemení. `lots.clear` do parku zámerne nezasahuje, aby v ňom ostala procedurálna zeleň. |
| Š4.10 | Ústie Jatočnej (kocky, oblé nárožia obrubníkov), s 80–88 | áno (čiastočne) | Samostatný záznam `roads` `name: 'Jatočná'` s `box` iba na ústie, `surface: 'settsDark'`, `sw` a `off` ponechané na predvolených hodnotách. Oblé nárožia kreslí generátor z výplne križovatky. |
| Š4.11 | Diagonálne dláždené chodníky cez trávnik parku | áno | OSM footway 38422222/…224/…228/…233/…238 — kreslí ich generátor, štvrť ich nemení. |
| Š4.12 | Spomaľovače, zrkadlá, parkovacie čiary, stredová čiara | — | V úseku nie sú (overené na všetkých 40 snímkach). |

## Š5. Lampy (`lamps`, `lots.lamps`)

Všetkých 12 lámp je zapísaných dvakrát: v kľúči `lamps` podľa schémy (`p`, `dir`, `t`, `h`, `arm`, `color`) a v `lots.lamps`,
aby boli vidieť už teraz. **Po PR tech/prvky treba `lots.lamps` z tejto štvrte vypustiť**, inak sa nakreslia dvakrát
(upozornenie je aj v komentári nad `lamps` v `centrum1.js`).

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| Š5.1–Š5.7 | 7 dvojramenných historických kandelábrov na severnej strane (s 6.9, 16.9, 39.4, 63.7, 86.1, 108.2, 133.1), čierne liatinové, 2 lucerny na oblúkových ramenách (rozpätie ~1.3 m), ramená kolmo na ulicu, h 5.0 | áno (čiastočne) | `lamps` + `lots.lamps`, `t: 'cand2'`, `a: 63` (= dir 153 − 90). Chýbajúci typ: **Stĺpy verejného osvetlenia – typy** — `cand2` má pevnú výšku 3.55 m namiesto 5.0 a farbu ani rozpätie ramien sa zadať nedá. |
| Š5.8–Š5.12 | 5 jednoramenných lucerien na južnej strane pri obrubníku (s 27.0, 51.3, 75.0, 99.3, 124.1), h 5.0 | áno (čiastočne) | `lamps` + `lots.lamps`, `t: 'lantern'`. `lantern` má pevnú výšku 3.7 m; rameno nad chodník hra nevie (lucerna sedí priamo na stĺpe). |
| Š5.13 | Zmazanie lámp z mapy v úseku | áno | `lots.clear` (druhý polygón) + `lots.clearLamps: true`; podľa schémy aj `clearLamps: [[−5,−195,116,−115]]`. Hranica x < 116 drží obdĺžnik mimo dlažby PLAZA, ktorá si lampy maže sama. |
| Š5.14 | Iné lampy v úseku | — | Nie sú (overené na všetkých 40 snímkach). |

## Š6. Zvislé dopravné značky (`trafficSigns`)

Všetkých 9 značiek (v 7 záznamoch) visí na stĺpoch lámp, samostatný stĺpik v úseku nie je. Všetky sú **v hre nie**,
chýbajúci typ: **Zvislé dopravné značky**. Dáta sú v `trafficSigns`, `on: 'lamp'` podľa rozšírenej schémy.

| # | Položka | Kde v dátach |
|---|---|---|
| Š6.1 | P1 Daj prednosť v jazde + malá biela tabuľka (text nečitateľný), s 6.9 t 11.6, h 2.4; `dir` neisté ±20 | `p: [110.4,−191.2]`, `dir: 125` |
| Š6.2 | B34 Zákaz zastavenia, s 16.9 t 7.3, h 2.4; `dir` neisté ±30 | `p: [101.9,−182.9]`, `dir: 75` |
| Š6.3 | P2 Hlavná cesta, s 63.7 t 5.0, h 2.4 | `p: [60.1,−161.0]`, `dir: 63` |
| Š6.4 | B34 Zákaz zastavenia, s 86.1 t 6.3, h 2.4 | `p: [39.5,−152.0]`, `dir: 114` |
| Š6.5 | P2 Hlavná cesta + IP6 Priechod pre chodcov, s 133.1 t 7.3, h 2.4 | `p: [−2.8,−131.6]`, `dir: 110` |
| Š6.6 | P2 Hlavná cesta + modrá obdĺžniková tabuľa (nečitateľná) + držiak na vlajku, s 27.0 t −6.9, h 2.4 | `p: [98.2,−165.9]`, `dir: 67` |
| Š6.7 | IP16 Parkovisko + E12 „Mestská polícia“, s 75.0 t −6.3, h 2.3; `dir` neisté | `p: [55.1,−145.8]`, `dir: 30` |

## Š7. Priechody a vodorovné značenie (`crossings`, `markings`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| Š7.1 | Zebra pri námestí, s 5–7.5, w 2.5, znížené obrubníky; OSM 7850321812 | áno | Hra ju kreslí automaticky z OSM (`k = 11`) a na renderi Š0‑254 aj Š1‑67 je dobre viditeľná (leží mimo dlažby PLAZA, na rozdiel od zebry na Gorkého). Zapísaná je aj ako `crossings[1]` s poznámkou „= OSM 7850321812“ — podľa schémy tech/prvky pri kreslení potlačí OSM zebru do 3 m, takže dvojmo nebude. Odchýlka stredu zápisu od OSM je 0.3 m. |
| Š7.2 | Zebra pri Potočnej, s 134.3–136.8, w 2.5; OSM 9343609687 | áno | To isté, `crossings[2]`, odchýlka stredu 1.0 m. Hranica úsekov — s Potočnou neduplikovať. |
| Š7.3 | Zebra cez ústie Jatočnej; OSM 1012760400 / node 454171252 | áno | Hra ju kreslí z OSM. Do `crossings` centrum1 sa podľa rozhodnutia vedúceho **nezapisuje**, patrí ulici Jatočná. Poznámka je v `todo`. |
| Š7.4 | Iné vodorovné značenie | — | Okrem zebier žiadne (ani parkovacie čiary, ani stredová čiara) — overené na všetkých pozdĺžnych snímkach. `markings` pre Štefánikovu preto nie je. Nápis „Štefánikova“ na vozovke v snímkach je popis Google. |

## Š8. Tabuľky s názvom ulice (`nameplates`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| Š8.1 | Tabuľky s názvom ulice a popisné čísla | — | Prieskum na fasádach v úseku žiadne nenašiel (z 8–10 m by červená tabuľka ako „Gorkého“ bola viditeľná). Neisté iba nárožie 60999339/Potočná (vidno ho iba šikmo zo Š8‑243). `nameplates` pre Štefánikovu preto nie je. |

## Š9. Vjazdy, stĺpy vedenia, parkovanie

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| Š9.1 | Prejazd do dvora 60999413 (s 80.5–85.8, otvorený oblúk, bez brány) | nie | Obrubník pred ním je súvislý → nejde o vjazd, `driveways` sa nezapisuje. Hra prejazd nekreslí, stena je plná. Dáta: `todo`. |
| Š9.2 | Prejazd pod rizalitom (s 110–112.9, kovaná brána) | nie | To isté; brána je ako `fences` (Š3.2), otvor v prízemí hra nevie. Dáta: `todo`. |
| Š9.3 | Stĺpy elektrického/telefónneho vedenia, vedenia nad ulicou | — | V úseku nie sú (overených všetkých 40 snímok), vedenie je zrejme v zemi. `poles` ani `wires` preto nie sú. |
| Š9.4 | Pozdĺžne státie áut pri južnom obrubníku (s ≈ 10–134, bez značenia) | nie zámerne | Zaparkované autá sú v hre vypnuté a `lots.clear` ich v koridore aj tak maže. Vyhradené státie Mestskej polície (s ≈ 70–80) je v `todo`. |

## Š10. Poklopy, vpuste, koše, skrinky, lavičky, plagátový stĺp (`furniture`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| Š10.1 | 5 čiernych kovových košov na stĺpiku, vždy pri lampe (s 6.5, 62.7, 85.2, 75.8, 125.6) | nie | Chýbajúci typ: **Odpadkové koše**. Dáta: `furniture`, `t: 'litterBin'`. |
| Š10.2 | Okrúhly poklop v strede vozovky (s 76.5) a obdĺžnikový poklop v chodníku pred prejazdom (s 112.4) | nie | Chýbajúci typ: **Poklopy, kanály, uličné vpuste**. Dáta: `furniture`, `t: 'manhole'`. |
| Š10.3 | Uličná vpusť pri severnom obrubníku (s 86.8) a mriežka vo vozovke pri južnom obrubníku (s 86.9, **neisté** či vpusť alebo poklop) | nie | To isté, `t: 'drain'`. |
| Š10.4 | Sivá skrinka na fasáde pri prejazde (s 113.7) | nie | Viď Š2.13. |
| Š10.5 | Veľká tmavá okrúhla misa s kríkom na ploche (s 108.9 t 14.3) | nie | Chýbajúci typ: **Kvetináče**. Dáta: `furniture`, `t: 'planter'`. |
| Š10.6 | 5 lavičiek na ploche (s 99.7, 107.4, 112.0, 118.0, 93.6): 2 biele kamenné bloky s drevenou doskou, 3 drevené s operadlom | áno | `furniture`, `t: 'bench'`, `style` `stone` / `wood`, `ang: 333` (= dir 153 − 180). Kamenný typ hra kreslí ako hladký blok bez drevenej dosky. Poloha lavičiek pri s 107.4 a 93.6 je neistá (±0.8 a ±1.5 m, iba jeden pohľad). |
| Š10.7 | Plagátový stĺp na rohu plochy pri Jatočnej (s 81.7 t 11.2, d ≈ 1.0 m, h ≈ 2.8) | áno | `furniture`, `t: 'adColumn'`, `rot: 0.175` (= (153 − 90) / 360). Hra kreslí vlastné plagáty a tmavozelenú kupolu; skutočný stĺp je biely so sivou strieškou. |
| Š10.8 | Kontajnery, hydranty, poštové schránky, zastávky, parkovacie automaty, telefónne búdky | — | V úseku nie sú (overené). |

## Š11. Zeleň (`lots.trees`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| Š11.1 | Rad 9 mladých líp na dláždenej ploche (s 88.6 → 136, t 13.4–14.7, h ≈ 8 m, koruna 4.5–5 m) | áno | `lots.trees`, `k: 10`, `h: 8`. Druh (lipa) sa zadať nedá, `k 10` je najbližší listnatý typ; výšku hra losuje (0,75–1,3 × základ). |
| Š11.2 | 6 smrekov pichľavých v parku (s 17–68, h 13–17 m) | áno | `lots.trees`, `k: 11` (smrek), `h` 13–17. Polohy ±1.5–2 m (triangulované z 2–3 stanovísk). |
| Š11.3 | Ostatné stromy parku (listnaté pri pavilóne a pri ZUŠ, ďalšie smreky 20–60 m od ulice) | áno (procedurálne) | Prieskum ich jednotlivo nezameral (priemet ±3–5 m). `lots.clear` preto do parku nezasahuje a zeleň tam necháva na generátor. Dáta: `todo`. |
| Š11.4 | Okrúhly kvetinový záhon v parku (stred ≈ (73,−185), priemer ≈ 9 m) | nie | Kvetinový záhon schéma nepozná (`trees` je iba na stromy a kry). Dáta: `todo`. |
| Š11.5 | Nízky záhon pri orientačnej tabuli pri kiosku (~2 × 1 m) | nie | To isté; spomenuté v `todo` pri oranžovej informačnej tabuli. |
| Š11.6 | Stromy na južnej strane | — | Žiadne nie sú. |

## Š12. Položky `todo` (čo sa do schémy nezmestí)

V `centrum1.js` je 23 položiek `todo` s prefixom „ŠT:“. Prvých 13 je priamo zo sekcie `### todo` balíka
(kiosk, stojan na bicykle, orientačný smerovník, cyklosmerovník, oranžová informačná tabuľa, informačná tabuľa s mapou,
Obecná studňa, socha Vinár, 2 sivé kamenné stély, 3 čierne stĺpiky, letná terasa, reklamné stojany A, food truck),
zvyšných 10 doplnil Stavbár (kvetinový záhon, pozdĺžne státie, dom chýbajúci v OSM aj s poznámkou o nepriechodnom prejazde,
prejazd 60999413, dvojfarebnosť bloku, detaily fasád juh a sever, radnica, ZUŠ + zebra cez Jatočnú, nezamerané stromy parku).
Pri každej je uvedený chýbajúci typ prvku menom.

Poznámka: Obecná studňa (OSM `man_made=water_well` 6512779637) je v hre vidieť — kreslí ju generátor z mapy,
nie štvrť. Zápis v `todo` sa týka jej presnej podoby (kamenná obruba, rumpál, strieška).

## Rendery Štefánikovej

Skript `prieskum/centrum1/render_stefanikova.py`, 10 stanovísk × 4 smery, 800 × 516 px, zvislé zorné pole 90° (f = 258 px),
kamera 2.5 m nad terénom, kalibrované polohy kamier z balíka (nie polohy z názvov snímok), čas v hre **07:12 (`?t=0.30`)**.
Iný čas než pri Gorkého má dôvod: hlavný rad domov na južnej strane hľadí na SSZ (333°) a na poludnie je celý v tieni;
pri `t = 0.30` ho osvetlí slnko od VJV a farby fasád sa dajú porovnať, pričom severná strana (líce 153°) ostáva nasvietená.

## Rozdiely voči Street View, ktoré ostali (Štefánikova)

1. **Osi a veľkosť okien** si generátor určuje sám; presné osi z prieskumu sa zadať nedajú (Š2.15).
2. **Dvojfarebnosť bloku 61001176/61000307** chýba, blok je celý krémovobroskyňový (Š2.14).
3. **Oba prejazdy** (s 80.5–85.8 a s 110–112.9) sú v hre zamurované; oblúk ani otvor v prízemí engine nevie (Š1.7, Š9.1).
4. **Oblúkové kladenie kociek** vozovky a plochy hra pre ostrovček nevie; plocha má rovný vzor a odtieň `#77726a` namiesto `#b9ac98` (Š4.7).
5. **Výška lámp** je 3.55 m (cand2) a 3.7 m (lantern) namiesto 5.0 m; poloha a typ sedia (Š5).
6. **Radnica** je v hre celá mätovozelená, v skutočnosti má v Štefánikovej štyri rôzne úseky — patrí do `namestie.js` a tento PR ju nemení (Š1.13).
7. **Sezónne a dočasné veci** (letná terasa, stojany A, food truck, zaparkované autá) sa zámerne neprenášajú.
8. Všetko, čo je vyššie označené „v hre nie“, v renderoch prirodzene chýba.

## Vedľajší účinok na rendery Gorkého

`lots.clear` Štefánikovej maže 16 stromov z mapy v koridore ulice. `vegetation.js` odvodzuje variant, mierku a natočenie
každého stromu z jeho **poradia v poli `D.t`** (`hashU(i, seed)`), takže vypustenie stromov posunie indexy všetkých
neskorších stromov a procedurálna zeleň sa v celom meste prelosuje. Na renderoch Gorkého sa preto zmenili iba stromy
(porovnanie pred/po: budovy, vozovka, chodníky, obrubníky, sokle aj tabule sú pixel po pixeli rovnaké).
Dáta Gorkého sa v tomto kroku nemenili.
