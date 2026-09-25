"""Run the built game headless and take scenario screenshots.
usage: python3 test/game.py '[{"name":"a","js":"...","n":30,"dt":0.033}]' [W H]
"""
import sys, time, json, os, socket, subprocess
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def up():
    s = socket.socket(); r = s.connect_ex(('127.0.0.1', 8765)); s.close(); return r == 0
if not up():
    subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        if up(): break
        time.sleep(0.1)
shots = json.loads(sys.argv[1]) if len(sys.argv) > 1 else []
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1280
H = int(sys.argv[3]) if len(sys.argv) > 3 else 720
Q = os.environ.get('Q', 'medium')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning', 'log') and 'GPU stall' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=''))
    pg.add_init_script('window.__TEST = true;')
    t0 = time.time()
    pg.goto(f'http://127.0.0.1:8765/dist/test.html?q={Q}&' + os.environ.get('QS', ''))
    try:
        pg.wait_for_function("() => window.__READY === true || document.getElementById('load-step').textContent.startsWith('Chyba')", timeout=600000, polling=1000)
    except Exception as e:
        print('TIMEOUT')
    print('ready in', round(time.time() - t0, 1), 's |', pg.inner_text('#load-step'))
    if os.environ.get('INTRO'): pg.screenshot(path='/tmp/g_intro.png')
    try:
        print('stats', pg.evaluate('() => ({city: CITY.stats, tiles: CITY.tiles.size})'))
        pg.evaluate('() => window.__start()')
    except Exception as e: print('start failed', e)
    for sh in shots:
        try:
            if 'js' in sh: pg.evaluate(sh['js'])
            info = pg.evaluate("(a) => { const r = window.__frame(a[0], a[1]); return {calls: r.calls, tris: r.tris, pos: [Math.round(GAME.pos.x), Math.round(GAME.pos.z)], clock: ENV.clockString()}; }", [sh.get('n', 3), sh.get('dt', 1/30)])
            print(sh['name'], info)
            pg.screenshot(path=f"/tmp/g_{sh['name']}.png", timeout=180000)
        except Exception as e: print('ERR', sh['name'], e)
    for l in logs[:40]: print(l)
    b.close()
