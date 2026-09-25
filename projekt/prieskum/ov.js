window.__wg = function(Z, x0, x1, z0, z1, step, pts, extra) {
  const m = location.pathname.match(/@([\d.]+),([\d.]+)/); const lat = +m[1], lon = +m[2];
  const cx = (lon - 17.2266) * 73279, cz = (48.8446 - lat) * 110540;
  const old = document.getElementById('__ov'); if (old) old.remove();
  const mpp = 156543.03392 * 0.65842 / Math.pow(2, Z), Wd = innerWidth, H = innerHeight;
  const P = (x, z) => [Wd / 2 + (x - cx) / mpp, H / 2 + (z - cz) / mpp];
  let o = '<svg id="__ov" xmlns="http://www.w3.org/2000/svg" style="position:fixed;left:0;top:0;width:' + Wd + 'px;height:' + H + 'px;pointer-events:none;z-index:99999">';
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const a = P(x, z0), b = P(x, z1); const major = x % (step * 5) === 0; o += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${major ? '#0ff' : 'rgba(0,255,255,0.45)'}" stroke-width="0.5"/>`; if (major) for (let z = z0; z < z1; z += step * 5) { const q = P(x, z); o += `<text x="${q[0] + 1}" y="${q[1] + 7}" fill="#0ff" font-size="6" font-family="Arial">x${x}</text>`; } }
  for (let z = Math.ceil(z0 / step) * step; z <= z1; z += step) { const a = P(x0, z), b = P(x1, z); const major = z % (step * 5) === 0; o += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${major ? '#ff0' : 'rgba(255,255,0,0.45)'}" stroke-width="0.5"/>`; if (major) for (let x = x0; x < x1; x += step * 5) { const q = P(x, z); o += `<text x="${q[0] + 1}" y="${q[1] - 1}" fill="#ff0" font-size="6" font-family="Arial">z${z}</text>`; } }
  for (const k in (pts || {})) { const q = P(...pts[k]); o += `<circle cx="${q[0]}" cy="${q[1]}" r="2" fill="none" stroke="#f00" stroke-width="1"/><text x="${q[0] + 3}" y="${q[1]}" fill="#f00" font-size="6">${k}</text>`; }
  for (const pl of (extra || [])) o += `<polyline fill="none" stroke="${pl.c || '#f0f'}" stroke-width="0.8" points="${pl.p.map(q => P(...q).join(',')).join(' ')}"/>`;
  o += '</svg>'; document.body.insertAdjacentHTML('beforeend', o); return [cx.toFixed(1), cz.toFixed(1), mpp.toFixed(3)];
};
'ok'
