"""Rendery testovacej štvrte nových prvkov (?prvky=test) a kontrolné pohľady na Gorkého.

Testovacia štvrť leží na Strážnickej za mestom a do hry sa dostane len s parametrom ?prvky=test,
takže bežnú hru neovplyvní. Kamery sú v rovnakej geometrii ako prieskumné snímky: 800x516 px
a 90 stupňov zvislého zorného poľa.

  python3 test/prvky_shots.py                 # vypíše JSON pre test/game.py
  python3 test/prvky_shots.py --run OUT       # vyrenderuje a skopíruje do OUT/
  python3 test/prvky_shots.py --run OUT --set centrum1   # kontrolné pohľady na Gorkého (vetva stvrt/centrum1)
"""
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, VFOV = 800, 516, 90
HIDE_HUD = "for(const id of ['hud','touch','mapview']){const e=document.getElementById(id); if(e) e.style.display='none';}"

# testovacia štvrť: lokálny rám ulice (rovnaký ako v src/world/prvky/test_district.js)
O, U, N = (1316.8, -1377.1), (0.6197, -0.7848), (0.7848, 0.6197)


def P(s, t):
    return (round(O[0] + U[0] * s + N[0] * t, 2), round(O[1] + U[1] * s + N[1] * t, 2))


# (názov, poloha kamery, výška nad terénom, smer v stupňoch od severu, sklon)
SETS = {
    'test': [
        ('prvky-ulica', P(-7, 5.5), 1.7, 44, -3),          # pohľad ulicou: značky, lampy, stĺpy, priechod
        ('prvky-priechod', P(3, -7.5), 1.7, 30, 0),        # zebra so zníženými obrubníkmi a stopčiarou
        ('prvky-znacky', P(-3, 2.0), 1.7, 40, 0),          # stĺpiky so značkami spredu + dodatkové tabule
        ('prvky-vjazd', P(46, 3), 1.7, 274, -3),           # vjazdy, brány (slat), plot na podmurovke
        ('prvky-mobiliar', P(62, 8), 1.7, 225, -4),        # koše, hydrant, skrinky, búdka, kvetináče, zastávka
        ('prvky-brana', P(40, 2.5), 1.7, 308, -6),         # vjazd zblízka: znížený obrubník, povrch, brána
        ('prvky-zastavka', P(66, -1.5), 1.7, 128, 0),      # zastávka MHD, semafory, lampy
        ('prvky-zhora', P(2, 0), 13.0, 38, -26),           # celá scéna zhora: povrchy vozovky, značenie
    ],
    'centrum1': [
        ('c1-gorkeho-vychod', (263.1, -157.7), 2.5, 117, 0),     # G3 dopredu: lampy 4.8 m, značka P1
        ('c1-gorkeho-zapad', (291.0, -142.0), 2.5, 297, 0),      # G1 dozadu: brána so značkou B1
        ('c1-brana', (281.5, -144.0), 1.7, 200, -2),             # brána dvora úradu práce zblízka
        ('c1-kocky', (310.7, -137.1), 2.5, 27, -6),              # tmavé žulové kocky pri G0 + trs trávy
        ('c1-namestie', (245.5, -171.4), 2.5, 123, 0),           # ústie Gorkého: zebra (bez duplicity)
    ],
}


def shots(name):
    out = []
    for n, (x, z), y, h, p in SETS[name]:
        out.append({
            'name': n,
            'js': HIDE_HUD + f'GAME.camOverride={{x:{x},z:{z},y:CITY.groundH({x},{z})+{y},h:{h},p:{p},vfov:{VFOV}}}',
            'n': 3,
        })
    return out


if __name__ == '__main__':
    name = 'test'
    if '--set' in sys.argv:
        name = sys.argv[sys.argv.index('--set') + 1]
    S = shots(name)
    if '--run' in sys.argv:
        dst = sys.argv[sys.argv.index('--run') + 1]
        os.makedirs(dst, exist_ok=True)
        qs = 't=0.5' + ('&prvky=test' if name == 'test' else '')
        env = dict(os.environ, QS=qs)
        subprocess.run([sys.executable, os.path.join(ROOT, 'test', 'game.py'), json.dumps(S), str(W), str(H)], check=True, env=env)
        for s in S:
            src = f"/tmp/g_{s['name']}.png"
            if os.path.exists(src):
                shutil.copyfile(src, os.path.join(dst, f"{s['name']}.png"))
        print('uložené do', dst)
    else:
        print(json.dumps(S))
