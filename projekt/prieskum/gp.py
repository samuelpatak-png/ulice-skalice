import sys, math
# ground-plane projection: gp.py cx cz h px,py [px,py ...]  (screenshot 1548x784, vfov 90, pitch 0, camH env CH default 2.5)
import os
CH=float(os.environ.get("CH","2.5")); C=float(os.environ.get("C","774")); V=float(os.environ.get("V","392")); F=float(os.environ.get("F","392")); P=float(os.environ.get('P','0'))
cx,cz,h=map(float,sys.argv[1:4])
for a in sys.argv[4:]:
    px,py=map(float,a.split(','))
    xr=(px-C)/F; yd=(py-V)/F
    # pitch P (deg up): rotate
    p=math.radians(P)
    fwd=math.cos(p)-(-yd)*0; 
    # camera frame dir: right xr, forward 1, up -yd ; rotate by pitch around right axis
    f= math.cos(p)*1 - math.sin(p)*(-yd)
    u= math.sin(p)*1 + math.cos(p)*(-yd)
    if u>=0: print(a,'above horizon'); continue
    t=CH/(-u); R=xr*t; Fw=f*t
    hr=math.radians(h); ex,ez=math.sin(hr),-math.cos(hr); rx,rz=math.cos(hr),math.sin(hr)
    x=cx+ex*Fw+rx*R; z=cz+ez*Fw+rz*R
    print(a,'-> (%.1f, %.1f) dist %.1f hd %.0f'%(x,z,math.hypot(x-cx,z-cz),(h+math.degrees(math.atan2(xr,f)))%360))
