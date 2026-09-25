"""Rendery hry z 10 stanovísk Štefánikovej v rovnakej geometrii ako snímky Street View (krok 7 z NAVOD).

Rovnaká geometria ako render_gorkeho.py: snímky prieskumu majú 800x516 px a 90 stupňov zorného poľa VO ZVISLOM
smere (vodorovne ~114), teda ohnisko f = (516/2) / tan(45) = 258 px. three.js PerspectiveCamera.fov je tiež zvislý,
preto test/game.py s vfov 90 a rozlíšením 800x516 dáva presne tú istú geometriu ako panoráma.

Kamery sú kalibrované polohy od Prieskumníka (zariadenie.txt, sekcia Štefánikova), nie polohy z panoramy.json
ani z názvov súborov — tie sú posunuté o 0.5 až 1.4 m, prevažne k námestiu. Názov renderu = názov zodpovedajúcej
snímky Street View (teda poloha panorámy), aby sa dali klásť vedľa seba.

  python3 prieskum/centrum1/render_stefanikova.py            # vypíše JSON pre test/game.py
  python3 prieskum/centrum1/render_stefanikova.py --run OUT  # vyrenderuje 40 pohľadov a skopíruje do OUT/
"""
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# stanovisko: (kalibrovaná poloha kamery x, z), predpona názvu snímky, 4 smery (dopredu, vpravo, dozadu, vľavo)
STATIONS = [
    ((119.65, -184.46), '120.1_-184.2', [254, 344, 74, 164]),   # Š0 (na námestí, vnútri PLAZA)
    ((103.27, -173.19), '104.0_-173.9', [247, 337, 67, 157]),   # Š1
    ((94.68, -169.68), '95.4_-170.1', [247, 337, 67, 157]),     # Š2
    ((76.07, -160.46), '77.1_-161.5', [243, 333, 63, 153]),     # Š3
    ((66.79, -156.39), '67.8_-157.1', [243, 333, 63, 153]),     # Š4
    ((48.31, -148.11), '49.3_-148.3', [243, 333, 63, 153]),     # Š5
    ((38.88, -143.92), '40.1_-143.9', [243, 333, 63, 153]),     # Š6
    ((21.23, -134.31), '21.9_-134.8', [243, 333, 63, 153]),     # Š7
    ((11.92, -129.83), '12.8_-130.1', [243, 333, 63, 153]),     # Š8
    ((2.70, -124.57), '3.3_-125.6', [243, 333, 63, 153]),       # Š9
]
W, H, VFOV = 800, 516, 90
# Snímky sú zamračené (október), hra má vždy slnko. Štefánikova vedie VSV–ZJZ, takže hlavný rad domov na južnej strane
# hľadí na SSZ (333°) a na poludnie je celý v tieni. t = 0.30 (07:12) dáva slnko od VJV, ktoré tento rad osvetlí zboku
# a farby fasád sa dajú porovnať; severná strana (líce 153°) je v tomto čase nasvietená tiež. Preto iný čas než pri Gorkého.
TIME = 't=0.30'
HIDE_HUD = "for(const id of ['hud','touch','mapview']){const e=document.getElementById(id); if(e) e.style.display='none';}"


def shots():
    out = []
    for (x, z), name, dirs in STATIONS:
        for h in dirs:
            out.append({
                'name': f'{name}_{h}',
                'js': HIDE_HUD + f'GAME.camOverride={{x:{x},z:{z},y:CITY.groundH({x},{z})+2.5,h:{h},p:0,vfov:{VFOV}}}',
                'n': 3,
            })
    return out


if __name__ == '__main__':
    S = shots()
    if len(sys.argv) > 2 and sys.argv[1] == '--run':
        dst = sys.argv[2]
        os.makedirs(dst, exist_ok=True)
        env = dict(os.environ, QS=TIME)
        subprocess.run([sys.executable, os.path.join(ROOT, 'test', 'game.py'), json.dumps(S), str(W), str(H)], check=True, env=env)
        for s in S:
            shutil.copyfile(f"/tmp/g_{s['name']}.png", os.path.join(dst, f"{s['name']}.png"))
        print('uložené do', dst)
    else:
        print(json.dumps(S))
