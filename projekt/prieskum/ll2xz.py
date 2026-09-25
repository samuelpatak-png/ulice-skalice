import sys
for a in sys.argv[1:]:
    la,lo=map(float,a.split(',')); print(a,'-> x %.1f z %.1f'%((lo-17.2266)*73279,(48.8446-la)*110540))
