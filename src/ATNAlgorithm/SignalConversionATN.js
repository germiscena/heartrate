const FIR_TAPS = 200;
const DECIM = 32;
const BANDS = [
  [7.8, 15.7],
  [15.7, 23.5],
  [23.5, 31.3],
  [31.3, 39.2],
];

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
function hamming(L) {
  const w = new Array(L);
  for (let n = 0; n < L; n++) w[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (L - 1));
  return w;
}

function firLowpass(length, wc) {
  wc = clamp(wc, 0, 1);
  const M = length - 1;
  const w = hamming(length);
  const h = new Array(length);
  for (let n = 0; n < length; n++) {
    const k = n - M / 2;
    h[n] = 2 * wc * sinc(2 * wc * k) * w[n];
  }
  return h;
}

function firBandpass(length, f1, f2, fs = 400) {
  const w1 = clamp(f1 / (fs / 2), 0, 1);
  const w2 = clamp(f2 / (fs / 2), 0, 1);
  const lo = Math.min(w1, w2),
    hi = Math.max(w1, w2);
  const h2 = firLowpass(length, hi);
  const h1 = lo > 0 ? firLowpass(length, lo) : new Array(length);
  const h = new Array(length);
  for (let i = 0; i < length; i++) h[i] = h2[i] - h1[i];
  return h;
}

function convSame(x, h) {
  const n = x.length,
    m = h.length;
  const y = new Array(n);
  const pad = Math.floor(m / 2);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = 0; k < m; k++) {
      const xi = i + k - pad;
      if (xi >= 0 && xi < n) acc += x[xi] * h[k];
    }
    y[i] = acc;
  }
  return y;
}

function downsample(x, M) {
  const out = new Array(Math.ceil(x.length / M));
  let j = 0;
  for (let i = 0; i < x.length; i += M) out[j++] = x[i];
  return out;
}

export function runFilterBank(signal, fs = 400) {
  const filters = BANDS.map(([f1, f2]) => ({
    band: [f1, f2],
    h: firBandpass(FIR_TAPS, f1, f2, fs),
  }));

  const filtered = filters.map(({ h }) => {
    const y = convSame(signal, h);
    return y;
  });

  const decimated = filtered.map((data) => {
    const yds = downsample(data, DECIM);
    return yds;
  });

  return {
    filtered,
    decimated,
  };
}
