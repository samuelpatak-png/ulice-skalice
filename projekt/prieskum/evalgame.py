import sys, time, json, socket, subprocess, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def up():
    s = socket.socket(); r = s.connect_ex(('127.0.0.1', 8765)); s.close(); return r == 0
if not up():
    subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
    pg = b.new_page(viewport={'width': 400, 'height': 300})
    pg.add_init_script('window.__TEST = true;')
    pg.goto('http://127.0.0.1:8765/dist/test.html?q=low')
    pg.wait_for_function("() => window.__READY === true", timeout=600000, polling=1000)
    print(json.dumps(pg.evaluate(sys.argv[1]))[:3000])
    b.close()
