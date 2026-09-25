import json, sys
# poses2.py name:x,z,h[,pitchDeg[,vfov]] -> JSON; camera 2.5 m (Street View car height)
out=[]
for a in sys.argv[1:]:
    name, rest = a.split(':'); v=[float(t) for t in rest.split(',')]
    x,z,h=v[:3]; p=v[3] if len(v)>3 else 0; fov=v[4] if len(v)>4 else 90
    out.append({'name':name,'js':f"GAME.camOverride={{x:{x},z:{z},y:CITY.groundH({x},{z})+2.5,h:{h},p:{p},vfov:{fov}}}",'n':3})
print(json.dumps(out))
