# Ulice Skalice — návod

Tento balík obsahuje hotovú hru (`hra/`), celý projekt so zdrojovým kódom (`projekt/`) a tento návod. Návod má dve časti: ako hru spustiť a ako ju ďalej stavať, teda presne ten postup, ktorým som robil Námestie slobody, Pelíškovu, Mallého, Jednoradovú, Horskú a Mýtnu.

---

## 1. Spustenie hry

### Prečo nestačí dvojklik na index.html

Hra si pri štarte sťahuje dáta mesta (`data/game.json`), textúry a oblohu. Prehliadače z bezpečnostných dôvodov nedovolia stránke otvorenej zo súboru (`file://…`) načítať ďalšie súbory, takže hra by zamrzla na načítavaní. Treba ju spustiť cez malý lokálny server. Na to sú v balíku pripravené spúšťače:

| Systém | Čo spustiť | Čo treba mať |
|---|---|---|
| Windows | `SPUSTIT-Windows.bat` (dvojklik) | Python (python.org, pri inštalácii zaškrtni *Add python.exe to PATH*) alebo Node.js |
| macOS | `SPUSTIT-Mac.command` (pravý klik → Otvoriť, prvýkrát to macOS vyžaduje) | Python 3 (na macOS býva, inak `xcode-select --install`) |
| Linux | `./SPUSTIT-Linux.sh` | Python 3 |

Spúšťač otvorí prehliadač na `http://localhost:8080`. Okno so serverom nechaj otvorené, kým hráš.

Ručne to isté: v priečinku `hra/` spusti `python -m http.server 8080` a otvor `http://localhost:8080`.

Hru potrebuje prehliadač s WebGL2 (Chrome, Edge, Firefox, Safari 16+). Na slabšom počítači pridaj do adresy `?q=low`.

### Ovládanie

| Kláves | Akcia |
|---|---|
| WASD | chôdza / jazda |
| Shift | beh / plyn naplno |
| F | nastúpiť / vystúpiť z auta |
| Medzerník | ručná brzda |
| M | mapa (klik = cieľ, dvojklik = teleport) |
| N | posun času |
| H | klaksón |
| R | rádio |
| C | vzdialenosť kamery |
| Esc | menu |

### Parametre v adrese

Pridávajú sa za adresu, napr. `http://localhost:8080/?q=high&t=0.7#namestie`.

| Parameter | Význam |
|---|---|
| `?q=low` / `medium` / `high` | kvalita grafiky |
| `?t=0.42` | čas dňa (0 = polnoc, 0.5 = poludnie) |
| `?at=143,-181.5` | začni na súradniciach x,z (metre) |
| `?cars=1` | zapne zaparkované a jazdiace autá (zatiaľ len na testovanie) |
| `#namestie`, `#peliskova`, `#malleho`, `#jednoradova` | začni priamo v spracovanej štvrti |

---

## 2. Čo je v balíku

```
ulice-skalice/
├── NAVOD.md                  tento návod
├── SPUSTIT-*.bat/.command/.sh spúšťače
├── hra/                      hotová hra, stačí ju spustiť
│   ├── index.html            celý kód hry v jednom súbore
│   ├── assets/               textúry (webp), obloha (HDR ako PNG), meta.json
│   └── data/game.json        mesto: budovy, cesty, plochy, stromy (z OpenStreetMap)
└── projekt/                  zdrojový kód, z ktorého sa hra stavia
    ├── src/                  JavaScript (three.js)
    │   ├── main.js           štart, načítanie, parametre
    │   ├── world/city.js     generátor mesta: budovy, strechy, cesty, chodníky, obrubníky
    │   ├── world/districts/  RUČNE SPRACOVANÉ ŠTVRTE (tu vzniká väčšina práce)
    │   ├── world/vegetation.js, props.js, signs.js
    │   ├── render/           materiály, obloha, svetlo, post-processing
    │   ├── actors/, game/    chodec, autá, fyzika, kamera
    │   └── ui/               menu, minimapa, HUD
    ├── tools/
    │   ├── prep.py           OSM → data/game.json
    │   ├── fetch_assets.py   stiahne a spracuje textúry z Poly Haven
    │   └── build.mjs         zabalí hru do dist/
    ├── public/             vstupy pre build (textúry sem skopíruj z hra/assets, pozri časť 6)
    ├── data/                 osm_compact.json (surové OSM), game.json (výstup prep.py)
    ├── test/game.py          bezhlavý render: snímky hry z presných pozícií
    └── prieskum/             moje pomocné skripty na prieskum ulíc + poznámky
```

---

## 3. Ako je hra postavená

1. **Mapa.** Základ je OpenStreetMap: obrysy budov, cesty s názvami, plochy (trávniky, parkoviská), stromy. `tools/prep.py` ich prevedie do kompaktného `data/game.json`.
2. **Generátor.** `src/world/city.js` z týchto dát postaví celé mesto automaticky: steny, strechy, okná, cesty, chodníky, obrubníky. Bez ďalšej práce vyzerá každý dom „priemerne“: odhadnutá farba, odhadnutý počet podlaží, všeobecná strecha.
3. **Štvrte (districts).** Tu vzniká realizmus. Pre každú spracovanú oblasť je súbor v `src/world/districts/`, ktorý pre konkrétne budovy (podľa ich OSM ID) povie skutočnú farbu fasády, počet podlaží, typ a farbu strechy, a pridá ploty, povrchy, lampy, stromy, lavičky, parkoviská atď. Generátor potom namiesto odhadov použije tieto údaje.
4. **Build.** `npm run build` zabalí všetok kód do jedného `dist/index.html` a skopíruje textúry a dáta.

### Súradnice

Celá hra je v metroch, stred je pri Námestí slobody.

- x = (zemepisná dĺžka − 17.2266) × 73279 → rastie na **východ**
- z = (48.8446 − zemepisná šírka) × 110540 → rastie na **juh**
- smer (heading) v stupňoch v smere hodinových ručičiek od severu (0 = sever, 90 = východ), rovnako ako v Google Street View

Prevod z GPS: `python3 prieskum/ll2xz.py 48.84612,17.23412`.

---

## 4. Postup: ako spracúvam ulicu

Toto je presný pracovný postup. Každý krok sa opiera o to, čo je v skutočnosti vidieť, nie o odhad.

### Krok 1 — Vymedzenie oblasti a trasa prieskumu

Vyberiem ulice a zakreslím ich os ako lomenú čiaru v herných súradniciach (vzor v `prieskum/walk.py`, premenná `lines`). Skript vygeneruje body každých ~28 m aj so smerom ulice a GPS súradnicami:

```bash
python3 prieskum/walk.py 28     # vypíše body a uloží walk.json
```

Každý bod je jedno stanovisko, z ktorého sa pozerám do Street View na obe strany ulice.

### Krok 2 — Street View snímky

Pre každé stanovisko otvorím Google Street View v prehliadači s presnou pozíciou a smerom. Adresu vyrobí:

```bash
python3 prieskum/sv.py 590 -128 45        # x z smer → odkaz na Street View
python3 prieskum/sv.py sat 590 -128 120   # satelit, 120 m výrez
```

Snímky robím vždy v rovnakej veľkosti okna (800×516 px, zorné pole 90°), pretože z toho vychádzajú prepočty v ďalších krokoch. Kvôli rýchlosti ich robím dávkovo, `prieskum/fgen.py` vyrobí zoznam krokov (navigácia → počkať → snímka) pre viac smerov z jedného bodu. Zapisujem si aj **dátum snímky** (Street View má na rôznych miestach rôzne staré zábery, niekde až z roku 2012) a skutočnú pozíciu panorámy, ktorá sa od požadovanej trochu líši.

### Krok 3 — Ktorý dom je ktorý

Na snímke vidím dom, ale potrebujem jeho OSM ID. `ray3.py` vystrelí z pozície kamery lúč cez daný stĺpec pixelov a vráti prvú budovu, ktorú trafí:

```bash
python3 prieskum/ray3.py 590 -128 45   120 400 690
#                         x    z   smer  stĺpce pixelov na snímke
# → 120 17.5 (14.2, 60998087, 'e2', ..., 'eave3.1')
```

Tak priradím každý dom na snímke k jeho obrysu v mape. Keď lúč netrafí nič, a na snímke dom je, znamená to, že **v OSM chýba** (stáva sa to pri novostavbách) a treba ho doplniť ručne (`extraBuildings`).

### Krok 4 — Zápis vzhľadu domov (`looks`)

Pre každý dom zapíšem, čo vidím:

```js
60998087: { wall: '#e6bea2', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9,
            roofColor: '#8e4a36', ang: 40.7, ft: 1 },  // Mýtna 15, lososová, hnedá brána
```

| Pole | Význam | Ako zistím |
|---|---|---|
| `wall` | farba fasády | zo snímky na slnkom neosvetlenom, nie tieňovanom mieste; skôr svetlejšie, lebo hra farbu ešte mierne stmaví |
| `floors`, `fh` | počet podlaží, výška podlažia (m) | spočítam rady okien; rodinné domy 2.9–3.1 m |
| `roof` | `gable` sedlová, `hip` valbová, `flat` plochá | zo snímky, pri nejasnosti zo satelitu |
| `rh` | výška strechy (m) | pevné stropy, pozri nižšie |
| `roofColor`, `roofMat` | farba a materiál krytiny (`grey` = plech/betón) | zo snímky, satelit pomáha |
| `ang` | smer hrebeňa v stupňoch | hrebeň rovnobežne s ulicou, ak je odkvap k ulici; kolmo, ak dom ukazuje štít |
| `ft` | typ fasády: `1` = rodinný dom | bez neho by OSM značka obchodu dala domu výklady |
| `eave` | výška odkvapu, ak je v OSM zlá | |

**Výšky striech, ktoré fungujú** (hlboké pôdorysy by inak podľa sklonu dostali 6–8 m vysoké strechy):

| Dom | `rh` |
|---|---|
| prízemný, sedlová | 3.9 |
| prízemný s obytným podkrovím (strešné okná, vikiere) | 4.8 |
| dvojpodlažný, sedlová | 3.6 |
| dvojpodlažný, valbová | 3.0 |

Poznámky píšem priebežne do textového súboru (vzor: `prieskum/looks_jhm.txt`, `prieskum/namestie_survey.md`).

### Krok 5 — Ploty, povrchy, zariadenie ulice

Pre všetko, čo nie je budova, potrebujem polohu na zemi. `gp.py` / `fp.sh` prepočíta bod na snímke (napr. päta plotu) na herné súradnice, za predpokladu že kamera je 2.5 m nad zemou ako auto Street View:

```bash
./prieskum/fp.sh 48.8457,17.2346 45   310,400  520,395
# → (602.3, -241.0) ...
```

`fx2.py` robí to isté pre čiaru rovnobežnú s ulicou (napr. línia plotov v známej vzdialenosti od osi).

Na kontrolu mám **satelitný prekryv** `ov.js`: vložený do stránky Google Máp nakreslí na satelitný snímok mriežku herných súradníc, takže vidím, kde presne je plot, dvor, parkovisko alebo strom.

Výsledok zapisujem ako úseky pozdĺž ulice (vzor `prieskum/fences_notes.txt`):

```
788-792 brána antracit hliníkové lamely #4a4d52 v1.6
792-808 kamenný blok, sivý #9a9894 v1.5 so stĺpikmi
817-826 drevo, hnedé zvislé dosky #6a3f2c v1.8
```

### Krok 6 — Súbor štvrte

Všetko zapíšem do nového súboru v `src/world/districts/`, napr. `jednoradova_horska_mytna.js`, a zaregistrujem ho v `src/world/districts/index.js`:

```js
import JHM from './jednoradova_horska_mytna.js';
export const DISTRICTS = [PZ, ML, NS, JHM];
```

Kostra súboru:

```js
const looks = { /* krok 4 */ };

export default {
  name: 'Jednoradová, Horská, Mýtna',    // zobrazí sa v menu
  id: 'jednoradova',                       // odkaz #jednoradova
  spawn: [590, -128, 0.45],                // x, z, smer v radiánoch
  looks,
  fences: [
    { road: 'Mýtna', box: [520, -222, 600, -112], off: -9.5, h: 1.4, type: 'mesh' },
    { p: [[792, -300], [808, -304]], h: 1.5, type: 'stoneblock', color: '#9a9894', clip: 3 },
  ],
  roads: [
    { name: 'Horská', box: [590, -350, 1160, -230], sw: [2.0, 0], off: [0, 0], mat: 'asphalt' },
  ],
  areaKinds: [{ p: [575, -40], from: 'track', kind: 'grass' }],  // oprava zlej OSM značky
  // ďalej podľa potreby: trees, lamps, furniture, bins, parking, lots, landmarks, extraBuildings…
};
```

**Ploty** (`fences`): buď pozdĺž ulice (`road` + `box` + `off` = odsadenie od osi v metroch, záporné = ľavá strana), alebo presnou lomenou čiarou `p`. `clip` = hĺbka (m), do ktorej sa plot automaticky preruší, kde stojí budova, takže netreba plot ručne deliť okolo domov na uličnej čiare. Typy: `panel`, `mesh` (pletivo), `rail`, `block`, `stoneblock`, `sheet` (plech), `wood`, `slat` (lamely), `wall` (omietnutý múr), `stone`, `brick`, `hedge` (živý plot), `creeper` (múrik s popínavkou).

**Cesty** (`roads`): úprava chodníkov na danom úseku ulice. `sw: [ľavý, pravý]` šírka chodníka (0 = bez chodníka), `off` posun okraja, `mat: 'asphalt'` asfaltový chodník, `mat: 'gravel'` štrková krajnica bez obrubníka, `flat: true` bez obrubníka.

Najlepšie je pozrieť si hotové štvrte, každá ukazuje iné možnosti:
- `namestie.js`: dlažba, kostol, veža, morový stĺp, lampy, stromy, lavičky (pamiatky sú v `landmarks.js`)
- `pelisk_zahradna.js`: panelové domy po sekciách, balkóny, parkoviská, potok
- `malleho_lucky.js`, `retail.js`: obchody, parkoviská, billboardy
- `jednoradova_horska_mytna.js`: rodinné domy, ploty, dopravné ihrisko

### Krok 7 — Porovnanie so skutočnosťou

```bash
cd projekt
npm run build
python3 prieskum/poses2.py h3:640,-258,20 > pozicie.json   # rovnaká pozícia ako panoráma
python3 test/game.py "$(cat pozicie.json)" 800 516
```

Hra sa vyrenderuje bez okna z presne tej istej pozície, výšky a zorného poľa ako snímka Street View (obrázky padnú do `/tmp/g_*.png`). Obe snímky dám vedľa seba a hľadám rozdiely: farby, výšky, strechy, chýbajúce ploty. Opravím súbor štvrte a opakujem, kým to sedí.

Rýchla kontrola hodnôt v bežiacej hre: `python3 prieskum/evalgame.py "CITY.buildingAt(600,-240)"`.

### Krok 8 — Uloženie a zverejnenie

Projekt je v gite, po každej hotovej štvrti commit. Hotové `dist/` sa dá nahrať na akýkoľvek statický hosting (Netlify, GitHub Pages, Vercel, vlastný web). Stačí nahrať obsah `hra/`.

---

## 5. Na čo si dávať pozor

- **OSM nie je vždy pravda.** Chýbajú novostavby, niekde je zlá značka (dopravné ihrisko pri Vaľoch je v OSM ako atletická dráha), výška odkvapu môže byť nezmyselná. Rozhoduje Street View a satelit.
- **Street View je rôzne starý.** Vždy si zapíš rok záberu. Keď sa zábery z rôznych rokov líšia, ber najnovší.
- **Farby treba zosvetliť.** Hra fasády mierne stmavuje (osvetlenie, textúra omietky), preto zapisujem odtieň, aký má stena na slnku, radšej o kúsok svetlejší.
- **Obchodná značka v OSM dá domu výklady.** Rodinné domy preto majú `ft: 1`, skutočné obchody a krčmy ho nemajú.
- **Rob po krokoch.** Jedna ulica, render, porovnanie, oprava, commit. Veľké dávky naraz sa zle kontrolujú.
- **Papierová verzia** (Skalica z papiera) je samostatný projekt, tento balík sa jej netýka.

---

## 6. Príprava prostredia (ak chceš stavať sám)

```bash
cd projekt
# textúry sú v balíku len raz (v hra/assets), build ich čaká v projekt/public/assets:
#   Windows:     xcopy /E /I ..\hra\assets public\assets
#   macOS/Linux: cp -r ../hra/assets public/assets
npm install                                   # three.js, esbuild, n8ao, postprocessing
pip install numpy pillow opencv-python playwright
npm run build                                 # → dist/
npm run serve                                 # → http://localhost:8080
```

- `npm run prep`: znova prepočíta mapu z OSM (treba len pri zmene OSM dát)
- `npm run assets`: znova stiahne textúry z Poly Haven (treba len pri zmene textúr)
- `test/game.py` a `prieskum/evalgame.py` potrebujú Playwright s Chromiom (`python -m playwright install chromium`)

Na úpravu kódu stačí akýkoľvek editor (VS Code). Po každej zmene v `src/` treba znova `npm run build` a obnoviť stránku.

---

## 7. Licencie

- Mapové dáta © prispievatelia OpenStreetMap, licencia ODbL.
- Textúry a obloha: Poly Haven, CC0.
- Knižnice: three.js (MIT), n8ao (MIT), postprocessing (Zlib).
- Street View a satelit Google slúžia len ako predloha na prieskum, v hre z nich nie je žiadny obrázok.
