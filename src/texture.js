// Paper grain for the Paper and Dark Paper themes. A small tileable PNG is drawn once on a canvas (no image files,
// so it works offline and inside the single-file page) and used as a repeating CSS background over the theme's
// flat color. The grain is faint on purpose: text contrast is measured against the flat background color.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const paperTextureCache = {};

// kind: 'paper' (dark speckle on a light page) or 'darkpaper' (light speckle on a dark page).
// Returns a CSS url("data:image/png...") value, or '' when canvas is not available.
function paperTextureUrl(kind) {
  if (paperTextureCache[kind] !== undefined) return paperTextureCache[kind];
  let url = '';
  try {
    const N = 256;
    const canvas = document.createElement('canvas');
    canvas.width = N;
    canvas.height = N;
    const g = canvas.getContext('2d');
    if (g) {
      const dark = kind === 'darkpaper';
      const rand = mulberry32(dark ? 7 : 11);
      const img = g.createImageData(N, N);
      const d = img.data;
      // Fine grain, one value per pixel, so it tiles with no seam.
      const speck = dark ? [235, 225, 201] : [91, 70, 40];
      const fleck = dark ? [0, 0, 0] : [255, 255, 255];
      for (let i = 0; i < N * N; i++) {
        const r = rand();
        const o = i * 4;
        if (r > 0.9965) { d[o] = fleck[0]; d[o + 1] = fleck[1]; d[o + 2] = fleck[2]; d[o + 3] = 70; }       // rare bright or dark fleck
        else { d[o] = speck[0]; d[o + 1] = speck[1]; d[o + 2] = speck[2]; d[o + 3] = Math.round(rand() * (dark ? 20 : 26)); }
      }
      g.putImageData(img, 0, 0);
      // Soft fibers: short curved strokes, drawn again at the edges so they wrap around the tile.
      g.lineCap = 'round';
      for (let f = 0; f < 70; f++) {
        const x = rand() * N, y = rand() * N, len = 6 + rand() * 18, ang = rand() * Math.PI * 2, bend = (rand() - 0.5) * 8;
        const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
        g.strokeStyle = 'rgba(' + speck.join(',') + ',' + (0.05 + rand() * 0.06).toFixed(3) + ')';
        g.lineWidth = 0.6 + rand() * 0.6;
        for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
          g.beginPath();
          g.moveTo(x + dx, y + dy);
          g.quadraticCurveTo((x + ex) / 2 + bend + dx, (y + ey) / 2 - bend + dy, ex + dx, ey + dy);
          g.stroke();
        }
      }
      url = 'url("' + canvas.toDataURL('image/png') + '")';
    }
  } catch (e) { url = ''; }
  paperTextureCache[kind] = url;
  return url;
}
