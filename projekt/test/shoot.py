"""Generic headless screenshot helper (swiftshader WebGL).
usage: python3 test/shoot.py <path-under-repo e.g. test/cars/index.html> <out.png> [W] [H] [timeout_s]
The page must set window.__READY = true when it is ready to be captured
(optionally window.__INFO = {...} which is printed). Console output and page errors are printed.
A static server on :8765 serving the repo root is started automatically if not running.
"""
import sys, time, os, json, socket, subprocess
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def up():
    s = socket.socket(); r = s.connect_ex(('127.0.0.1', 8765)); s.close(); return r == 0
if not up():
    subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        if up(): break
        time.sleep(0.1)
path, out = sys.argv[1], sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1280
H = int(sys.argv[4]) if len(sys.argv) > 4 else 720
TO = float(sys.argv[5]) if len(sys.argv) > 5 else 240
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=''))
    pg.add_init_script('window.__TEST = true;')
    t0 = time.time()
    pg.goto(f'http://127.0.0.1:8765/{path}')
    try:
        pg.wait_for_function('() => window.__READY === true', timeout=TO * 1000, polling=500)
    except Exception as e:
        print('TIMEOUT waiting for __READY')
    print('ready in', round(time.time() - t0, 1), 's')
    try: print('INFO', json.dumps(pg.evaluate('() => window.__INFO || null')))
    except Exception: pass
    pg.screenshot(path=out, timeout=180000)
    for l in logs[:60]: print(l)
    b.close()
