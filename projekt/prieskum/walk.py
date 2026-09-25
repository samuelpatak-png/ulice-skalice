import math, json, sys
def ll(x,z): return 48.8446 - z/110540, x/73279 + 17.2266
lines = {
 'M': [(598,-110),(591,-125),(586,-135),(547,-208),(541,-230),(537,-244),(527,-284),(525,-293),(522,-308),(521,-311)],
 'J': [(598,-110),(608,-81),(610,-73),(611,-66),(611,-51),(609,-39),(589,34),(584,54),(580,64),(577,71),(587,94),(570,161),(563,235),(562,242)],
 'H': [(541,-230),(600,-245),(688,-267),(826,-302),(902,-318),(933,-323),(1053,-339),(1098,-345),(1136,-352),(1151,-359)],
}
step=float(sys.argv[1]) if len(sys.argv)>1 else 28
out=[]
for k,P in lines.items():
    acc=0; t=step/2; i=0
    segs=[(P[j],P[j+1]) for j in range(len(P)-1)]
    for a,b in segs:
        L=math.hypot(b[0]-a[0],b[1]-a[1])
        while t<=acc+L:
            f=(t-acc)/L; x=a[0]+(b[0]-a[0])*f; z=a[1]+(b[1]-a[1])*f
            h=math.degrees(math.atan2(b[0]-a[0], -(b[1]-a[1])))%360
            la,lo=ll(x,z); out.append((k,len([o for o in out if o[0]==k]),round(x,1),round(z,1),round(h,1),'%.7f,%.7f'%(la,lo)))
            t+=step
        acc+=L
for o in out: print(*o)
json.dump(out,open('./walk.json','w'))
