#!/bin/bash
# fp.sh lat,lon heading px,py ...  -> ground points (800x516 Browser-pane screenshots, 92t)
LL=$1; shift; H=$1; shift
read X Z < <(python3 -c "la,lo=map(float,'$LL'.split(',')); print(round((lo-17.2266)*73279,2), round((48.8446-la)*110540,2))")
C=400 V=258 F=258 P=2 python3 "$(dirname "$0")/gp.py" $X $Z $H "$@"
