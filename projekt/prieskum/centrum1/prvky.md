# Centrum 1 / Gorkého (1. úsek) — čo z prieskumu je v hre a čo nie

Zdroj: prieskumný balík `centrum1_gorkeho` (`looks.txt` sekcia ## Gorkého, `ploty.txt`, `zariadenie.txt`, `trasa.md`), Street View 10/2022 a satelit `sat_Gorkeho_1.png`.
Cieľový súbor: `projekt/src/world/districts/centrum1.js`. Úsek: OSM way 38417436, (250.0,−163.5) → (308.0,−132.8), s = 0…58.

Stĺpec **v hre** má dve hodnoty:

- **áno** — prvok sa po `npm run build` skutočne vykreslí.
- **nie** — prvok je zapísaný ako dáta podľa `technik/schema_prvkov.md`, ale hra preň zatiaľ nemá kód. Pri každom takom riadku je uvedený názov chýbajúceho typu prvku a miesto v dátach.

Priradenie OSM ID každého domu je overené `prieskum/ray3.py` z kalibrovaných polôh kamier
(G0 310.7,−137.1 · G1 291.0,−142.0 · G2 273.5,−151.8 · G3 263.1,−157.7 · G4 245.5,−171.4) s ohniskom f = 258 px.

---

## 1. Domy (`looks`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 1.1 | 61000413 Gorkého 1A + 1B (2618), biely prízemný dom s obytným podkrovím, `wall #efeae0`, `fh 3.6`, `eave 5.0`, sedlová, `rh 4.8`, `roofColor #a0473a`, `ang 117`, `ft 1` | áno | `looks[61000413]`. Lúče G2‑27 u460–790, G1‑27 u10–790, G0‑297 u440–600, G0‑27 u100–250 trafili obrys 61000413 (hrana e6 = uličná fasáda, e5 = východný štít) — priradenie potvrdené. |
| 1.2 | 61003077 Gorkého 2 (2045/2) Úrad práce, koralová dvojpodlažná budova, `wall #dc7b68`, `fh 3.9`, `eave 8.6`, sedlová, `rh 3.6`, `roofColor #9a5444`, `ang 117`, bez `ft` | áno | `looks[61003077]`. Lúče G1‑207 u50–520, G0‑207 u440–700, G2‑117 u470–700 trafili obrys 61003077 (hrana e14 = uličná fasáda). |
| 1.3 | 60999098 Prima banka (nárožný dom do námestia) | áno | Looks je v `namestie.js`, v centrum1 sa neduplikuje (pokyn Stavbára). Lúče G3‑27 u127–740 potvrdili obrys. Doplnky viď 2.1–2.5. V `namestie.js` mu bolo doplnené `ft: 2` — viď 1.11. |
| 1.4 | 61000733 okresný súd (nárožný dom do námestia) | áno | Looks je v `namestie.js`, v centrum1 sa neduplikuje. Lúče G2‑207 u280–600 a G3‑207 u60–433 potvrdili obrys (hrana e3 = severná fasáda do Gorkého). Doplnky viď 2.6–2.8. V `namestie.js` mu bolo doplnené `ft: 15` — viď 1.11. |
| 1.5 | Strešné okná 61000413 (5 ks pri s 22.1, 24.4, 29.2, 37.5, 42.5 + 1 pri s ≈ 52), TV a tyčová anténa na hrebeni, plechové zvody | nie | Zapísané slovne v komentári `looks` a v hlavičke súboru. Hra kreslí iba tvar strechy; jednotlivé strešné okná, antény ani zvody nevie. `rh 4.8` je podľa tabuľky v NAVOD riadok „prízemný s obytným podkrovím (strešné okná, vikiere)“, takže objem strechy sedí. |
| 1.6 | Dvojfarebnosť 61003077 (koralové poschodie + biele plochy prízemia `#eeebe6`, biele lizény, frontóniky, rímsa medzi podlažiami, kruhové okno vo východnom štíte) | nie | Hra kreslí jednu farbu fasády; `wall` je koralová, lebo je jej najviac. Biele pole prízemia by sa cez `retail.wall` dalo natrieť, ale prekrylo by okná prízemia (rovnaký problém má súd v `namestie.js`), preto nie je použité. Zostáva ako rozdiel voči Street View. |
| 1.7 | 6 okien 61000413 a okná/balkóny 61003077 (polohy osí, francúzske balkóny, mreže) | nie | Hra generuje rozostup okien sama z fasádneho shaderu; presné osi sa zadať nedajú. Poznámky sú v komentároch balíka, v dátach nie sú. |
| 1.8 | 2 zapustené vchody 61000413 (s 30.2–32.1 a 47.3–48.5) a vstup 61003077 | nie | Vstupné schodisko úradu práce je v `todo` (11.4). Zapustené vchody bez dverí hra nevie; `sc.doors` funguje iba pre budovy s presným staviteľom (`schemes`), nie pre `looks`. |
| 1.9 | Domy „CHÝBA V OSM?“ | — | Žiadne. Každá budova viditeľná v úseku má obrys v OSM (potvrdené balíkom aj `ray3.py`). |
| 1.10 | 61000168 Gorkého 10/1 a 906612344 (č. 2947) za koncom úseku | — | Mimo úseku, patria do ďalšieho úseku Gorkého. Prenesené nie sú, sú len v komentároch balíka. |
| 1.11 | Presklené výklady na prízemí Prima banky a súdu | áno (opravené) | Obidva domy majú v OSM značku obchodu (`fac = 4`), preto im generátor dával na prízemie tmavé výklady, ktoré v skutočnosti nemajú. V `namestie.js` im bolo doplnené iba pole `ft` — `60999098: ft: 2` (fasáda starého mesta) a `61000733: ft: 15` (občianska stavba); ostatné polia ich `looks` sa nemenili. Prízemie má teraz bežné okná. Overené renderom z G3, G4 a z námestia na obe hlavné fasády; porovnanie pred/po ukazuje zmenu len na týchto dvoch domoch, zvyšok námestia (dlažba, lampy, stromy, lavičky, veža, karner, tabule) je pixel po pixeli rovnaký. |

## 2. Doplnky k domom, ktoré looks nemajú (`retail`, `furniture`, `nameplates`, `todo`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 2.1 | Nápis „Prima Banka“ + logo na bočnej fasáde (s 4.6–7.2, h ≈ 4.1) | áno | `retail[0]`, položka `sign` s presetom `primaBanka`, `cut: true`. |
| 2.2 | Lososový sokel Prima banky ~0.9 m | áno | `retail[0]`, položka `wall` `[0,21.6] × [0,0.9]`, `#e8c9ae`. |
| 2.3 | Vetracie mriežky v sokli Prima banky (G3‑27 u213 a u740 → s ≈ 2.6 a 14.5) | áno | `retail[0]`, dve položky `box` v sokli. |
| 2.4 | 2 svetlosivé elektro skrinky na fasáde Prima banky (s 3.0 a 3.6) | nie | Chýbajúci typ: **Elektrické skrine, rozvádzače**. Dáta: `furniture` — dva záznamy `t: 'cabinet'` na `[262.4,−165.0]` a `[262.9,−164.7]`. |
| 2.5 | Zelené fólie na spodku okien prízemia Prima banky | nie | Do schémy sa nezmestí. Dáta: `todo` — „zelené fólie na spodku okien prízemia Prima banky“. |
| 2.6 | Tabuľa „OKRESNÝ SÚD SKALICA“ so štátnym znakom pri vchode (s ≈ 17.8) | áno | `retail[3]`, položka `sign` s presetom `board`. Štátny znak hra nemá, je nahradený dvojriadkovým textom. |
| 2.7 | Malá tabuľa so znakom na fasáde súdu (G3‑207 u60, s ≈ 17.4) | nie | Do schémy sa nezmestí. Dáta: `todo` — „malá tabuľa so štátnym znakom (súd)“. |
| 2.8 | Sivá skrinka so strieškou na koralovom múre podlubia súdu | nie | Do schémy sa nezmestí (vývesná skrinka so strieškou). Dáta: `todo` — „sivá skrinka so strieškou na múre podlubia súdu“. |
| 2.9 | Lososový sokel 61000413 ~1.0 m (`#ecc6ac`) | áno | `retail[1]`, položka `wall` `[0,33.7] × [0,1.0]`. |
| 2.10 | Truhlíky s červenými muškátmi na oknách 61000413 (s ≈ 27.5 a 35.9) | áno | `retail[1]`, dve položky `sign` s presetom `flowers`, `cut: true`. |
| 2.11 | 2 žlté plechové skrinky meračov na fasáde 61000413 (s 21.5–22.5) | nie | Chýbajúci typ: **Elektrické skrine, rozvádzače**. Dáta: `furniture`, `t: 'cabinet'` na `[279.1,−155.8]`. |
| 2.12 | Čierna schránka + zvončekový panel v ostení východného vchodu 1A (s 47.8) | nie | Chýbajúci typ: **Schránky (poštové)**. Dáta: `furniture`, `t: 'mailbox'` na `[301.6,−143.4]`. |
| 2.13 | Biela svetelná tabuľa pri západnom vchode (s 29.5), 2 tabuľky čísel + 2 mosadzné tabuľky (s 32.5), plochá modro‑bielo‑červená tabuľa nad oknom (s 51.5) | nie | Do schémy sa nezmestí (firemné tabule bez čitateľného textu). Dáta: `todo` — „firemné tabule 61000413“. Tabuľky čísel navyše aj v `nameplates` (viď 8.2). |
| 2.14 | Vystrčená obojstranná tabuľa s logom na fasáde 61000413 (s 47.3, h ≈ 4.3) | nie | Do schémy sa nezmestí. Dáta: `todo` — „vystrčená tabuľa s logom“. |
| 2.15 | Koralový sokel 61003077 ~1.0 m (`#cf7a68`) | áno | `retail[2]`, položka `wall` `[0,20.0] × [0,1.0]`. |
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
| 3.5 | Dvojkrídlová otváravá brána dvora úradu práce, čierna oceľ `#3c3a38`, h 1.65, s 28.3–33.3 | áno (náhradou) | `fences[1]`, `type: 'rail'`. Chýbajúci typ: **Brány a bránky** (krídla, stredný stĺpik, zvislé tyčky). `rail` kreslí iba 2 vodorovné rúrky a stĺpiky každých 2.2 m. Brána je zapísaná aj v `driveways[0].gate` podľa schémy. |
| 3.6 | Murovaný pilier / krátky múr zo sivých tvárnic, h 1.8, s 33.3–34.6 | áno | `fences[2]`, `type: 'stoneblock'`, `p: [[282.1,−137.1],[283.3,−136.5]]`. |
| 3.7 | Napojenie piliera na západný roh 61003077 (s 34.6–35.5) | áno | Vyplnené samotnou budovou, nič sa nekreslí. |
| 3.8 | 61003077 na uličnej čiare, s 35.5–55.5, bez plotu; s 55.5–60 otvorený priestor pred schodiskom | áno | Nič sa nekreslí. |
| 3.9 | Podmurovka pod plotom (`fences[].y0`, `base`) | — | V úseku nie je žiadny plot na podmurovke, pole sa nepoužíva. |
| 3.10 | Živý plot a čierny tyčkový plot parkoviska za koncom úseku (s ≈ 60–72) | — | Mimo úseku (iba z diaľky, ±1 m), neprenesené. Patrí do ďalšieho úseku Gorkého. |

## 4. Vozovka, chodníky, obrubníky, rigoly, trávniky (`roads`, `lots`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 4.1 | Vozovka asfalt `#9a958c`, obojsmerná, bez vodorovného značenia, šírka 5.4–5.7 m | áno (čiastočne) | `roads[0]` (`mat` neuvedený = asfaltová vozovka z OSM). OSM udáva šírku 6.0 m; obrubníky sú posunuté dnu cez `off: [−0.05, −0.3]`, takže viditeľná vozovka je ~5.6 m. Farbu vozovky sa zadať nedá (je z generátora). |
| 4.2 | Obrubníky betónové svetlosivé, `curbH ≈ 0.12` (**neisté** ±0.03) | nie | Chýbajúci typ: **Obrubníky – výška, typ, znížené pri vjazdoch**. Hodnota je zapísaná ako `roads[0].curbH: 0.12`; hra zatiaľ kreslí pevných 0.15 m. |
| 4.3 | Zníženie obrubníka na konci trávnika pri križovatke G0 (s 55–57, sever, OSM 12734616111) | nie | Chýbajúci typ: **Obrubníky – výška, typ, znížené pri vjazdoch**. Dáta: `todo` — „neoznačený prechod cez bočnú ulicu pri G0“. |
| 4.4 | Zníženie obrubníka pred bránou dvora (s 28.3–33.3) — **neisté** | nie | Chýbajúci typ: **Vjazdy do dvorov** (zníženie je jeho súčasťou). Dáta: `driveways[0]`, poznámka „zníženie obrubníka NEISTÉ“. |
| 4.5 | Severný chodník: betónová zámková dlažba s dekorom červených kociek, 2.0 m pri fasáde, s −1.5 → 55 | áno (čiastočne) | `roads[0].sw[1] = 5.0` (od obrubníka po uličnú čiaru), trávnik z toho ukrajuje (4.6). Chýbajúci typ: **Chodníky – materiály** — vzor a farba zámkovej dlažby ani červený dekor sa zadať nedajú, hra má jednu textúru dlažby `#8c877e`. |
| 4.6 | Severný trávnatý pás medzi chodníkom a obrubníkom, s 1.8 → 54.8, šírka 2.8–2.9 m (s < 26) a 2.2 m (s > 31), oblé konce | áno (čiastočne) | `lots.islands[0]` (`LAWN_N`), vyvýšený ostrovček s obrubníkom, `top: 'grass'`, `h: 0.12`. Pás je úmerne zúžený: OSM vozovka je o ~0.5 m širšia a obrys 61000413 je o kúsok bližšie k ceste, takže na plnú šírku pásu aj 2 m chodníka pri fasáde nie je miesto. Oblé konce hra nevie (ostrovček je mnohouholník), konce sú skosené. |
| 4.7 | Južný chodník pri ústí k námestiu, s −1 → 4.5, ~3.5 m — **neisté** (autá) | áno | `roads[0].sw[0] = 3.5`. Pri križovatke chodník zvažuje generátor sám (zóna križovatky). |
| 4.8 | Južný chodník pred súdom 2.3 m + trávnatý pás 1.25 m pri obrubníku, s 4.5 → 21.9 | áno | `roads[0].sw[0] = 3.5` + `lots.islands[1]` (`LAWN_S`). Začiatok pásu s ≈ 4.5 je **neistý ±1 m** (medzi autami), poznámka je v komentári nad `LAWN_S`. |
| 4.9 | Južná súvislá dlažba pred dvorom úradu práce, s 21.9 → 35.5, 5.0 m od obrubníka po múr | áno | `lots.islands[2]` (`YARD_WALK`), `top: 'walk'`, `h: 0.15` — vyvýšená dlažba nadväzujúca na chodník. |
| 4.10 | Južný chodník pred 61003077, 3.0 m, s 35.5 → 55.5, a dlažba pred schodiskom s 55.5 → 60 | áno | `roads[0].sw[0] = 3.5` (o 0.5 m viac, presah je skrytý pod budovou). |
| 4.11 | Rigol z 2–3 radov tmavých žulových kociek pozdĺž severného obrubníka, s 1.5–55 | áno | `lots.ribbons[0]`, `m: 'settsDark'`, šírka 0.35 m. |
| 4.12 | Rovnaký rigol pozdĺž južného obrubníka, s 22–55 (pred súdom s 4–22 zakrytý autami — **neisté**) | áno (iba istá časť) | `lots.ribbons[1]`, s 22–55. Neistý úsek s 4–22 nie je nakreslený, poznámka je v komentári. |
| 4.13 | Plocha z tmavosivých žulových kociek na rohu pri G0 (s 55–62, t 4–10) | nie | Do schémy sa nezmestí. Dáta: `todo` — „plocha zo žulových kociek na rohu“. Nekreslí sa zámerne: v týchto súradniciach je ústie bočnej ulice, dlažba by prekryla križovatku. |
| 4.14 | Plocha trávnika ako polygón (`lots/areaKinds`) | áno | Riešené cez `lots.islands`, nie cez `areaKinds` — ostrovček má obrubník a správnu výšku, `areaKinds` iba prepisuje značku existujúcej OSM plochy (tu žiadna nie je). |
| 4.15 | Spomaľovače | — | V úseku nie sú. |

## 5. Lampy (`lots.lamps`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 5.1 | Historická liatinová lampa s lucernou, s 8.1 t 3.6, h 4.8, `#2a2c2e`, pod lucernou kovaný držiak na kvetináč | áno (čiastočne) | `lots.lamps[0]` na `[265.1,−159.0]`, typ `lantern`. Chýbajúci typ: **Stĺpy verejného osvetlenia – typy** — výška (`lantern` má pevných 3.7 m, nie 4.8), farba ani držiak na kvetináč sa zadať nedajú. |
| 5.2 | Rovnaká lampa, s 29.9 t 3.2, h 4.8 | áno (čiastočne) | `lots.lamps[1]` na `[284.2,−148.6]`, to isté obmedzenie. |
| 5.3 | Rovnaká lampa, s 51.2 t 3.2, h 4.7, nesie značku B33 | áno (čiastočne) | `lots.lamps[2]` na `[303.2,−138.9]`, to isté obmedzenie. Značka na stĺpe viď 6.3. |
| 5.4 | Zmazanie lámp z mapy v úseku | áno | `lots.clear` (koridor ulice s −3…60, t −13…+12) + `lots.clearLamps: true`. Zmazali sa 2 lampy z OSM na južnej strane (`[274.4,−145.6]`, `[301.1,−131.9]`), ktoré v Street View nie sú, a procedurálny ihličnan z mapy vo dvore úradu práce (`[275.1,−136.0]`), ktorý v zábere G1‑207 (17 m) tiež nie je. Pole podľa schémy je aj v `clearLamps: [[250,−170,310,−128]]`. |
| 5.5 | Iné lampy v úseku | — | Nie sú (na južnej strane žiadna) — potvrdené balíkom. |

## 6. Zvislé dopravné značky (`trafficSigns`)

Všetkých päť riadkov je **v hre nie**, chýbajúci typ: **Zvislé dopravné značky**. Dáta sú v `trafficSigns` v `centrum1.js`.

| # | Položka | Kde v dátach |
|---|---|---|
| 6.1 | P1 „Daj prednosť v jazde!“ + E2b (tvar križovatky), s 3.5 t 4.1, h 2.3, sivý stĺpik; poloha ±1 m | `trafficSigns[0]`, `p: [261.2,−161.6]`, `dir: 117` |
| 6.2 | B33 Zákaz státia + A22 Deti, s 21.3 t −4.1, h 2.2, sivý stĺpik | `trafficSigns[1]`, `p: [273.3,−146.0]`, `dir: 310` |
| 6.3 | B33 Zákaz státia na stĺpe lampy, s 51.2, h 2.5 | `trafficSigns[2]`, `p: [303.2,−138.9]`, `on: 'lamp'` |
| 6.4 | B1 Zákaz vjazdu na západnom stĺpiku brány dvora, s 28.3 t −8.0, h 1.8 | `trafficSigns[3]`, `p: [277.7,−139.4]`, `on: 'gate'`. Pozn.: uchytenie značky na bránu schéma nepozná (pozná iba `pole`, `on: 'lamp'` alebo id stĺpa z `poles`); zapísané ako `on: 'gate'` a vysvetlené v `note`. |
| 6.5 | B34 Zákaz zastavenia, biely naklonený stĺpik, s 62.5 t 7.8 — **mimo úseku**, `dir` neisté | `trafficSigns[4]`, `p: [315.4,−137.8]` |
| 6.6 | Sivý stĺpik bez viditeľnej značky pred súdom (s 6.1, h ≈ 2.5) — **neisté**, či nesie značku otočenú hranou | `todo` — „stĺpik bez značky“ |
| 6.7 | Semafory | — v úseku nie sú |

## 7. Priechody a vodorovné značenie (`crossings`, `markings`)

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 7.1 | Zebra cez ústie Gorkého pri námestí (s −1.1…1.2, w 2.3, znížené obrubníky), OSM 9260694064 | áno | Kreslí sa automaticky z OSM (`r.k === 11` v `CITY.buildRoads`) a na dlažbe PLAZA je viditeľná — overené pohľadom zhora na ústie aj renderom G3‑297. `namestie.js` ju v dátach nemá, v centrum1 sa **neduplikuje**; je zapísaná len ako `crossings[0]` podľa schémy (šírka 2.3 m a `drops: true` sa zatiaľ nepoužijú, hra kreslí pevnú šírku a zníženie obrubníka nevie — chýbajúci typ **Priechody pre chodcov**). |
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
| 9.1 | Vjazd do dvora úradu práce, s 28.3–33.3, šírka 5.0 m, dlažba, brána swing `#3c3a38` h 1.65 | nie (ako prvok) | Chýbajúci typ: **Vjazdy do dvorov**. Dáta: `driveways[0]`, `p: [279.9,−138.3]`. Viditeľné náhrady: samotná brána je nakreslená ako `fences[1]` (typ `rail`) a 5 m hlboká spevnená plocha pred ňou ako `lots.islands[2]`. Zníženie obrubníka a iný povrch vjazdu cez chodník sa zatiaľ nekreslia; zníženie je aj tak **neisté**. |

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
| 11.1 | Stromy v úseku s 0–58 | — | Žiadny strom nie je. Nič sa nekreslí, `trees` v štvrti nie je. |
| 11.2 | Malý okrasný strom pri s 71.6 (mimo úseku) | — | Mimo úseku, neprenesené. |
| 11.3 | Záhon so štrkom pred východným štítom 61000413 (~0.9 × 2.5 m, biely štrk lemovaný žulovými kockami) | áno (čiastočne) | `lots.surfaces[0]`, `m: 'gravel'`. Lem z kociek sa nekreslí. |
| 11.4 | Trs okrasnej trávy (miskant/pennisetum, h ≈ 1.1, priemer 0.9) + malá sivozelená rastlina v záhone | áno (náhradou) | `lots.trees[0]`, `k: 25` (generický ker). Chýbajúci typ: **Stromy – veľkosti a presná podoba** — mierka sa zadať nedá (hra ju losuje 0,75–1,3), takže ker vyjde asi 2,5 m vysoký namiesto 1,1 m; druh okrasnej trávy hra nepozná a malá rastlina nie je nakreslená. Vidno to na renderi `312.2_-136.4_27.png`. |
| 11.5 | Voľné kvetináče na ulici | — | Nie sú; muškáty sú na oknách (2.10). |
| 11.6 | Stojan s reklamnou tabuľou pred vchodom 1A (s 47.7 t 4.4) | nie | Do schémy sa nezmestí. Dáta: `todo` — „stojan s reklamnou tabuľou“. |

Ostatné položky `todo` sú vymenované pri 2.5, 2.7, 2.8, 2.13, 2.14, 2.17, 2.18, 2.19, 4.3, 4.13 a 6.6.

## 12. Parkovanie, stĺpy vedenia

| # | Položka | v hre | Kde v dátach / poznámka |
|---|---|---|---|
| 12.1 | Vyznačené parkovacie miesta | — | V úseku nie sú. `parking` ani `streetParking` sa nepoužívajú. |
| 12.2 | Autá stojace pozdĺžne pri južnom obrubníku pred súdom (bez značenia) | nie zámerne | Zaparkované autá sú v hre vypnuté (`?cars=1`), a `lots.clear` ich v koridore ulice aj tak maže. |
| 12.3 | Stĺpy elektrického a telefónneho vedenia, vedenia nad ulicou | — | V úseku žiadne nie sú (skontrolovaných všetkých 20 snímok), preto `poles` ani `wires` v súbore nie sú. Poznámka je v komentári. |

---

## Rozdiely voči Street View, ktoré po troch kolách renderov ostali

Rendery: 5 stanovísk × 4 smery, 800 × 516 px, zvislé zorné pole 90° (f = 258 px), kamera 2.5 m nad vozovkou,
kalibrované polohy kamier, čas v hre 13:12 (`?t=0.55`). Skript: `prieskum/centrum1/render_gorkeho.py`.

1. **Osvetlenie.** Snímky sú zamračené (október), hra má vždy slnko. Gorkého vedie VJV–ZSZ, takže severná strana (líce 207°) sa dá nasvietiť, ale južná strana (líce 27°, súd a úrad práce) je v hre vždy v tieni a jej farba vychádza tmavšia a sýtejšia než na snímkach. Časom dňa sa to nedá vyriešiť.
2. **Rozmiestnenie a veľkosť okien.** Hra generuje osi okien sama; 61000413 má v hre menšie a hustejšie okná než v skutočnosti (6 veľkých s hnedými rámami), 61003077 má 3 okná na podlažie namiesto 5 + úzke. Nedá sa zadať.
3. **Dvojfarebnosť 61003077** (biele plochy prízemia, lizény, frontóniky, kruhové okno vo východnom štíte) chýba, budova je celokoralová.
4. **Zámková dlažba** chodníkov je v hre jedna sivá textúra bez červeného dekoru z kosoštvorcov.
5. **Trs okrasnej trávy** v záhone je vykreslený ako generický ker asi 2,5 m vysoký (pozri 11.4).
6. **Výška lámp** je 3.7 m namiesto 4.8 m (typ `lantern` má pevnú výšku), poloha aj tvar sedia.
7. **Nárožné domy z `namestie.js`:** presklené výklady na prízemí Prima banky a súdu sú opravené doplnením `ft` do ich `looks` (viď 1.11). Ostatné rozdiely týchto dvoch domov (súd je v hre koralový, v skutočnosti bielo‑sivý s koralovým soklom, a nemá podlubie) vyplývajú z ich `looks` v `namestie.js` a tento PR ich nemení.
8. **Prvky mimo úseku** (dom 61000168 na rohu, parkovisko za úradom práce, veža na obzore) nie sú spracované a v renderoch sa líšia; patria do ďalších úsekov.
9. Všetko, čo je v tabuľkách vyššie označené „v hre nie“ (značky, tabuľky, poklopy, vpuste, skrinky, žlté značenie, vjazd, schodisko úradu práce, stojan s tabuľou) v renderoch prirodzene chýba.

## Zhrnutie neistôt prenesených z balíka

- `curbH 0.12` je odhad ±0.03 (bez kolmého pohľadu na čelo obrubníka) — `roads[0].curbH`, komentár „neisté“ v `prvky.md` 4.2.
- Zníženie obrubníka pred bránou dvora sa zo snímok nedá určiť — `driveways[0].note`.
- Začiatok južného trávnika pred súdom (s ≈ 4.5) je neistý ±1 m — komentár nad `LAWN_S`.
- Pripojenie múru na roh súdu (s 22.4–23.8) nevidno — komentár v `fences`.
- Južný rigol v úseku s 4–22 je zakrytý autami — kreslený je len od s 22.
- `dir` značky B34 (mimo úseku) je neisté — `trafficSigns[4].note`.
- Okrúhla mriežka pri s 19.9 a vpusť pri s 15.9 sú neisté — `furniture` `note`.
- Stĺpik bez značky pred súdom (s 6.1) — `todo`.
