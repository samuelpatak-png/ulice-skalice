import json, math, sys
# ray3.py cx cz h px ... : first building hit for 800x516 screenshots (vfov 90)
D = json.load(open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '..', 'data', 'game.json')))
cx, cz, h = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])
B = []
for b in D['b']:
    a = b[0]; x, z = a[0], a[1]; P = [(x/10, z/10)]
    for i in range(2, len(a), 2):
        x += a[i]; z += a[i+1]; P.append((x/10, z/10))
    mx = sum(p[0] for p in P)/len(P); mz = sum(p[1] for p in P)/len(P)
    if math.hypot(mx-cx, mz-cz) < 250: B.append((b[10], b[8], b[1]/10, P))
def hit(hd):
    dx, dz = math.sin(math.radians(hd)), -math.cos(math.radians(hd)); best = None
    for bid, cat, eave, P in B:
        n = len(P)
        for i in range(n):
            (x1, z1), (x2, z2) = P[i], P[(i+1) % n]; ex, ez = x2-x1, z2-z1
            den = dx*ez - dz*ex
            if abs(den) < 1e-9: continue
            t = ((x1-cx)*ez - (z1-cz)*ex)/den; u = ((x1-cx)*dz - (z1-cz)*dx)/den
            if t > 0.5 and 0 <= u <= 1 and (best is None or t < best[0]): best = (round(t,1), bid, 'e%d'%i, 'u%.2f'%u, 'L%.1f'%math.hypot(ex,ez), 'cat%d'%cat, 'eave%.1f'%eave)
    return best
for px in sys.argv[4:]:
    hd = h + math.degrees(math.atan((float(px)-400)/258))
    print(px, round(hd,1), hit(hd))
