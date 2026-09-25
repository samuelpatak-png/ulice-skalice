import json, sys
# fgen.py M1:17,107 M2:17,107 -> browser_batch actions (JS reads the actual pano position once per point)
w = {f'{p[0]}{p[1]}': p for p in json.load(open('walk.json'))}
acts = []
for a in sys.argv[1:]:
    k, hs = a.split(':'); ll = w[k][5]
    for i, h in enumerate(hs.split(',')):
        acts.append({'name': 'navigate', 'input': {'url': f'https://www.google.com/maps/@{ll},3a,90y,{h}h,92t/data=!3m1!1e1'}})
        acts.append({'name': 'computer', 'input': {'action': 'wait', 'duration': 3.5}})
        if i == 0: acts.append({'name': 'javascript_tool', 'input': {'action': 'javascript_exec', 'text': f"'{k} ' + location.pathname.split('/data')[0].split('@')[1] + ' ' + (document.body.innerText.match(/\\d+\\/20\\d\\d/)||[''])[0]"}})
        acts.append({'name': 'computer', 'input': {'action': 'screenshot'}})
print(json.dumps(acts))
