import sys
# usage: sv.py x z heading [pitch] [fov]  -> street view url ;  sv.py sat x z meters -> satellite url
def ll(x,z): return 48.8446 - z/110540, x/73279 + 17.2266
if sys.argv[1]=='sat':
    x,z,m=map(float,sys.argv[2:5]); la,lo=ll(x,z)
    print(f"https://www.google.com/maps/@{la:.7f},{lo:.7f},{m:.0f}m/data=!3m1!1e3")
else:
    x,z,h=map(float,sys.argv[1:4]); t=float(sys.argv[4]) if len(sys.argv)>4 else 90; f=float(sys.argv[5]) if len(sys.argv)>5 else 90
    la,lo=ll(x,z); print(f"https://www.google.com/maps/@{la:.7f},{lo:.7f},3a,{f:.0f}y,{h:.1f}h,{t:.0f}t/data=!3m1!1e1")
