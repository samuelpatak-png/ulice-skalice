import math, sys
# fx2.py lat,lon streetHeading d heading px ... : where each screenshot column meets a line parallel to the street at d m from the
# camera (on the side the ray looks to); prints the world point
la, lo = map(float, sys.argv[1].split(',')); hs, d, h = float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
cx, cz = (lo - 17.2266) * 73279, (48.8446 - la) * 110540
sx, sz = math.sin(math.radians(hs)), -math.cos(math.radians(hs))
out = []
for px in sys.argv[5:]:
    hd = h + math.degrees(math.atan((float(px) - 400) / 258)); dx, dz = math.sin(math.radians(hd)), -math.cos(math.radians(hd))
    lat = -dx * sz + dz * sx   # component along the street's left normal... use |cross|
    cr = sx * dz - sz * dx     # sin of angle between street dir and ray
    if abs(cr) < 0.05: out.append(f'{px}:far'); continue
    t = d / abs(cr); out.append('%s:(%.0f,%.0f)' % (px, cx + dx * t, cz + dz * t))
print(' '.join(out))
