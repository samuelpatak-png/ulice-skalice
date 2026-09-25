// Centrum 1 — Gorkého, Štefánikova (1. úsek), Kráľovská.
// Zatiaľ je spracovaný iba 1. úsek Gorkého (OSM way 38417436, (250.0,-163.5) -> (308.0,-132.8)), Street View 10/2022 + satelit.
// Prieskum: balík centrum1/Gorkého (looks.txt, ploty.txt, zariadenie.txt, trasa.md). Stanoviská G0..G4, kalibrované polohy kamier
// G0 (310.7,-137.1) G1 (291.0,-142.0) G2 (273.5,-151.8) G3 (263.1,-157.7) G4 (245.5,-171.4) — o ~1.8 m západnejšie ako panoramy.json.
//
// Pomocné súradnice prieskumu: s = vzdialenosť pozdĺž osi ulice od (256.2,-159.5) smerom 117° (VJV), t = kolmo (+ sever, − juh).
// Herné x = východ, z = juh. Prepočet: p = (256.2 + 0.8910·s + 0.4540·t, −159.5 + 0.4540·s − 0.8910·t).
//
// Nárožné domy do námestia (60999098 Prima banka, 61000733 okresný súd) majú looks už v namestie.js — tu sú len ich doplnky
// do Gorkého (nápis banky, sokle, mriežky, tabuľa súdu, skrinky). Zariadenie ulice začína za hranou dlažby PLAZA (s ≈ 0–1.5).
//
// Kľúče trafficSigns, nameplates, crossings, markings, driveways, clearLamps, furniture (nové typy) a todo zapisuje Stavbár podľa
// zmrazenej schémy technik/schema_prvkov.md. Hra ich zatiaľ nevykresľuje; zobrazia sa po PR tech/prvky bez prepisovania štvrte.
// Prehľad „v hre áno / v hre nie“ pre každú položku je v projekt/prieskum/centrum1/prvky.md.

// -------------------------------------------------------------------- vzhľad domov (looks)
const looks = {
  // Gorkého 1A + 1B (súp. č. 2618), severná strana, dlhý biely prízemný dom s lososovým soklom a obytným podkrovím.
  // fh 3.6 + eave 5.0: vyvýšené prízemie (~7 schodov do vchodov) a vysoká nadmurovka nad oknami; rh 4.8 = prízemný s obytným podkrovím.
  61000413: { wall: '#efeae0', floors: 1, fh: 3.6, eave: 5.0, roof: 'gable', rh: 4.8, roofColor: '#a0473a', ang: 27, ft: 1 },
  // Gorkého 2 (2045/2) Úrad práce, soc. vecí a rodiny, južná strana; koralová dvojpodlažná budova, bez ft (nie je rodinný dom)
  61003077: { wall: '#dc7b68', floors: 2, fh: 3.9, eave: 8.6, roof: 'gable', rh: 3.6, roofColor: '#9a5444', ang: 27, ft: 2 },
};

// Hrebeň rovnobežne s ulicou: prieskum udáva smer 117° od severu, ale kľúč `ang` v city.js je matematický uhol
// atan2(z, x) v stupňoch (hrebeň smeruje (cos ang, sin ang)), teda 117 − 90 = 27. So 117 by hrebeň stál kolmo na ulicu.
// Obidva domy sú po obnove s hladkou omietkou, preto mat: 'PLASTER' (bez neho dá cat 1 zvetranú hrubú omietku).
for (const id in looks) looks[id] = { mat: 'PLASTER', ...looks[id] };

// -------------------------------------------------------------------- doplnky na fasádach (nápisy, sokle, mriežky, truhlíky)
// path = skutočná uličná čiara podľa obrysu OSM. side určuje normálu líca: pre domy na severnej strane (fasáda hľadí na JJZ)
// je to side 1, pre domy na južnej strane (fasáda hľadí na SSV) side -1. Pri opačnej hodnote sa prvky nakreslia dovnútra domu.
const sign = (s, v, preset, arg, extra = {}) => ({ t: 'sign', s, v, preset, arg, glow: 0, ...extra });
const wall = (s, v, c, extra = {}) => ({ t: 'wall', s, v, c, m: 'PLASTER', ...extra });

const retail = [
  // 60999098 Prima banka — bočná fasáda do Gorkého (s -1.5 → 20.2). Face s = s + 1.49.
  { path: [[258.4, -167.1], [277.4, -156.7]], side: 1, items: [
    wall([0, 21.6], [0, 0.9], '#e8c9ae'),                                        // lososový sokel ~0.9 m
    sign([6.1, 8.7], [3.85, 4.4], 'primaBanka', null, { cut: true }),            // nápis „Prima banka“ + logo na fasáde, h ≈ 4.1
    ...[4.1, 16.0].map(s => ({ t: 'box', s: [s - 0.25, s + 0.25], d: [0, 0.06], v: [0.35, 0.6], c: '#6d6a64', m: 'PLASTER' })),  // vetracie mriežky v sokli
  ] },
  // 61000413 Gorkého 1A/1B — uličná fasáda (s 20.2 → 53.9). Face s = s − 20.16.
  { path: [[277.4, -156.7], [307.0, -140.5]], side: 1, items: [
    wall([0, 33.7], [0, 1.0], '#ecc6ac'),                                        // lososový sokel ~1.0 m
    ...[7.3, 15.7].map(s => sign([s - 0.75, s + 0.75], [1.35, 1.85], 'flowers', null, { cut: true, dd: 0.4 })),  // truhlíky s muškátmi (s ≈ 27.5 a 35.9)
  ] },
  // 61003077 Úrad práce — uličná fasáda (s 35.4 → 55.4). Face s = s − 35.38.
  { path: [[284.7, -137.5], [295.8, -132.3], [303.2, -129.7]], side: -1, items: [
    wall([0, 20.0], [0, 1.0], '#cf7a68'),                                        // koralový sokel ~1.0 m
  ] },
  // 61000733 okresný súd — severná fasáda do Gorkého (s 3.9 → 22.4). Face s = s − 3.90.
  { path: [[256.6, -151.7], [273.3, -143.8]], side: -1, items: [
    sign([13.3, 14.9], [1.95, 2.75], 'board', ['#e9e5d9', '#2e2b28', 'OKRESNÝ SÚD', 'SKALICA', 'Georgia']),   // tabuľa so štátnym znakom pri vchode (s ≈ 17.8)
  ] },
];

// -------------------------------------------------------------------- vozovka a chodníky
// OSM vozovka je 6.0 m široká, v skutočnosti 5.4–5.7 m: off posúva obrubník dnu na skutočné miesto (sever t +2.7, juh t −2.95).
// sw[0] = južná strana (vpravo v smere jazdy od námestia), sw[1] = severná strana.
// sever: 5.0 m od obrubníka po uličnú čiaru (v tom trávnatý pás, viď lots.islands);
// juh: 3.5 m (pri ústí ~3.5, pred súdom 2.3 + 1.25 trávnik, pred úradom 3.0; pred dvorom 5.0 = lots.islands).
const roads = [
  { name: 'Gorkého', box: [250, -170, 312, -125], sw: [3.5, 5.0], off: [-0.05, -0.3], curbH: 0.12, mat: undefined },
];

// -------------------------------------------------------------------- ploty, múry, brána (južná strana, medzi súdom a úradom práce)
const fences = [
  // s 23.8 … 28.3 múr zo sivých betónových tvárnic so štiepaným povrchom, krycia doska, bez stĺpikov
  { p: [[273.7, -141.5], [277.7, -139.4]], h: 1.7, type: 'block', color: '#9a9288' },
  // s 28.3 … 33.3 dvojkrídlová otváravá brána do dvora úradu práce (čierna oceľ, zvislé tyčky, stredný stĺpik pri s ≈ 30.8)
  { p: [[277.7, -139.4], [282.1, -137.1]], h: 1.65, type: 'rail', color: '#3c3a38' },
  // s 33.3 … 34.6 murovaný pilier/krátky múr, napája sa priamo na západný roh 61003077
  { p: [[282.1, -137.1], [283.3, -136.5]], h: 1.8, type: 'stoneblock', color: '#9a9288' },
  // Severná strana: bez plotov, domy stoja na uličnej čiare (overené na všetkých 20 snímkach).
];

// -------------------------------------------------------------------- povrchy, trávniky, lampy (lots)
// clear = koridor ulice v s −3…60, t −13…+12: zmažú sa v ňom lampy z mapy (clearLamps) a procedurálne stromy a autá.
// Patrí sem aj ihličnan z mapy vo dvore úradu práce [275.1,−136.0], ktorý v Street View (G1-207, 17 m) nie je.
const CLEAR = [[247.62, -149.28], [303.75, -120.68], [315.11, -142.95], [258.97, -171.55]];
// Severný trávnatý pás medzi chodníkom a obrubníkom (s 1.8 → 54.8). Prieskum udáva šírku 2.8–2.9 m (s < 26) a 2.2 m (s > 31);
// v hre je vozovka o ~0.5 m širšia a obrys OSM o kúsok bližšie, preto je pás úmerne zúžený, aby pri fasáde ostal chodník ~2 m.
const LAWN_N = [[259.14, -161.31], [260.95, -163.09], [262.0, -162.94], [281.77, -152.41], [286.08, -149.85], [306.41, -139.1], [306.98, -138.45], [306.37, -137.25]];
// Južný trávnatý pás pri obrubníku pred súdom (s 4.5 → 21.9, šírka 1.25 m). Začiatok s ≈ 4.5 je neistý ±1 m (zakryté autami).
const LAWN_S = [[258.78, -154.65], [258.75, -153.26], [273.36, -145.82], [274.28, -146.75]];
// Spevnená plocha pred bránou dvora úradu práce (s 21.9 → 35.5, 5.0 m od obrubníka po múr) — pokračovanie južného chodníka.
const YARD_WALK = [[273.41, -143.72], [284.82, -137.91], [284.0, -136.3], [273.39, -141.7], [273.02, -142.96]];

const lots = {
  clear: [{ ring: CLEAR }],
  clearLamps: true,                       // v úseku nie sú iné uličné lampy než 3 historické lucerny nižšie
  islands: [
    // h musí byť o kúsok nad chodníkom (WALK_Y = 0.15), inak dlažba chodníka trávnik prekryje
    { ring: LAWN_N, top: 'grass', h: 0.18, kerb: '#a9a59c' },
    { ring: LAWN_S, top: 'grass', h: 0.18, kerb: '#a9a59c' },
    { ring: YARD_WALK, top: 'walk', h: 0.17, kerb: '#a9a59c' },
  ],
  surfaces: [
    // záhon so štrkom pred východným štítom 61000413 (~0.9 × 2.5 m, biely štrk lemovaný radom žulových kociek)
    { ring: [[309.76, -142.68], [312.46, -143.68], [312.14, -144.52], [309.44, -143.52]], m: 'gravel', c: '#bdb6a8' },
  ],
  ribbons: [
    // rigoly z 2–3 radov tmavých žulových kociek pozdĺž obrubníkov
    { pts: [[258.75, -161.15], [306.26, -136.96]], w: 0.35, m: 'settsDark', c: '#6e6a66' },            // severný, s 1.5 → 55
    { pts: [[274.73, -147.11], [304.13, -132.13]], w: 0.35, m: 'settsDark', c: '#6e6a66' },            // južný, s 22 → 55 (pred súdom zakrytý autami, neisté)
  ],
  trees: [
    // veľký trs okrasnej trávy (miskant/pennisetum, h ≈ 1.1 m) v štrkovom záhone; hra vie iba generický ker
    { p: [310.9, -143.6], k: 25 },
  ],
  lamps: [
    // historické liatinové stĺpy s lucernou, čierne, v severnom trávnatom páse, rozostup ~21.5 m
    { p: [265.1, -159.0], t: 'lantern' },        // s 8.1 t 3.6
    { p: [284.2, -148.6], t: 'lantern' },        // s 29.9 t 3.2
    { p: [303.2, -138.9], t: 'lantern' },        // s 51.2 t 3.2, nesie značku B33
  ],
};

// -------------------------------------------------------------------- prvky podľa schema_prvkov.md (hra ich zatiaľ nekreslí)
// Zvislé dopravné značky. dir = smer, ktorým hľadí líce značky (stupne od severu). Kódy podľa vyhl. 9/2009.
const trafficSigns = [
  { p: [261.2, -161.6], dir: 117, codes: ['P1', 'E2b'], h: 2.3, pole: 'grey', note: 's 3.5 t 4.1, západný koniec sev. trávnika; Daj prednosť v jazde! + dodatková Tvar križovatky; G3-297 u593, G2-297 u449, G3-27 u50; poloha ±1 m' },
  { p: [273.3, -146.0], dir: 310, codes: ['B33', 'A22'], h: 2.2, pole: 'grey', note: 's 21.3 t -4.1, juž. chodník na konci trávnika pred súdom; Zákaz státia + výstražná Deti; G2-207 u280, G3-117 u500; líce k autám od námestia' },
  { p: [303.2, -138.9], dir: 117, codes: ['B33'], h: 2.5, on: 'lamp', note: 'Zákaz státia na stĺpe lampy s 51.2 (G0-297 u343, zozadu G1-117 u343); líce na VJV' },
  { p: [277.7, -139.4], dir: 27, codes: ['B1'], h: 1.8, on: 'gate', note: 's 28.3 t -8.0, Zákaz vjazdu všetkých vozidiel v oboch smeroch, na západnom stĺpiku brány dvora úradu práce (G1-207 u730, G2-117 u656, G1-297 u200); uchytenie na bránu schéma nepozná' },
  { p: [315.4, -137.8], dir: 255, codes: ['B34'], h: 2.2, pole: 'white', note: 'MIMO ÚSEKU tesne za križovatkou (s 62.5 t 7.8), trávnik pri rohu 61000168; Zákaz zastavenia, biely šikmo naklonený stĺpik; G0-117 u212, G0-27 u773; dir neisté' },
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
const clearLamps = [[250, -170, 310, -128]];

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
  { t: 'plocha zo žulových kociek na rohu', p: [309.0, -140.0], note: 's 55–62, t 4–10, okolo východného štítu 61000413 a záhonu; tmavosivé kocky #6e6a66, lemované radom väčších kociek (G0-297 u490–800 v390–516, G0-27 u0–250); nekreslené, prekrývalo by ústie bočnej ulice' },
  { t: 'malá tabuľa so štátnym znakom (súd)', p: [268.8, -145.9], note: 's 17.4, na severnej fasáde súdu vedľa veľkej tabule (G3-207 u60)' },
  { t: 'zelené fólie na spodku okien prízemia Prima banky', p: [265.0, -163.0], note: 's 4–14, typické pre banku; hra nevie farebnú fóliu na výplni okna' },
  { t: 'kábel na fasáde súdu', p: [267.5, -147.5], note: 'tenká čiara pri balkóne súdu (G3-117 u510–530 v90–150) – pravdepodobne kábel na fasáde, neisté' },
  { t: 'neoznačený prechod cez bočnú ulicu pri G0', p: [311.5, -137.3], note: 'OSM 12734616111; bez pásov, len znížené obrubníky s bielymi betónovými plochami (G0-297 u310–360 v415–440). Nie je crossing, len zníženie obrubníka' },
];

export default {
  name: 'Centrum: Gorkého, Štefánikova, Kráľovská',
  id: 'centrum1',
  spawn: [278.5, -148.2, 5.18],            // v strede Gorkého, pohľad na ZSZ k námestiu
  looks,
  retail,
  roads,
  fences,
  lots,
  // dáta pre tech/prvky (hra ich zatiaľ ignoruje)
  trafficSigns,
  nameplates,
  crossings,
  markings,
  driveways,
  clearLamps,
  furniture,
  todo,
};
