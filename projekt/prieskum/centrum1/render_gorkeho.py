"""Rendery hry z 5 stanovísk Gorkého v rovnakej geometrii ako snímky Street View (krok 7 z NAVOD).

Snímky prieskumu majú 800x516 px a 90 stupňov zorného poľa VO ZVISLOM smere (vodorovne ~114), teda ohnisko
f = (516/2) / tan(45) = 258 px. three.js PerspectiveCamera.fov je tiež zvislý, preto test/game.py s vfov 90
a rozlíšením 800x516 dáva presne tú istú geometriu ako panoráma (a ako ray3.py, ktoré počíta s f = 258).

Kamery sú kalibrované polohy od Prieskumníka, nie polohy z panoramy.json (tie sú posunuté ~1.8 m na VJV).
Názov renderu = názov zodpovedajúcej snímky, aby sa dali klásť vedľa seba.

  python3 prieskum/centrum1/render_gorkeho.py            # vypíše JSON pre test/game.py
  python3 prieskum/centrum1/render_gorkeho.py --run OUT  # vyrenderuje a skopíruje do OUT/
"""
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# stanovisko: (kalibrovaná poloha kamery x, z), predpona názvu snímky, 4 smery (dopredu, vpravo, dozadu, vľavo)
STATIONS = [
    ((310.7, -137.1), '312.2_-136.4', [297, 27, 117, 207]),   # G0
    ((291.0, -142.0), '292.9_-141.6', [297, 27, 117, 207]),   # G1
    ((273.5, -151.8), '275.3_-151.5', [297, 27, 117, 207]),   # G2
    ((263.1, -157.7), '264.9_-157.2', [297, 27, 117, 207]),   # G3
    ((245.5, -171.4), '248.1_-170.6', [303, 33, 123, 213]),   # G4 = Kráľovská 0, na námestí
]
W, H, VFOV = 800, 516, 90
# Snímky sú zamračené (október), hra má vždy slnko. t = 0.55 (13:12) osvetlí severnú fasádu (líce 207°) podobne
# ako rozptýlené svetlo na snímkach; skoršie časy ju nechávajú v tieni a farby sa porovnať nedajú.
TIME = 't=0.55'
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
