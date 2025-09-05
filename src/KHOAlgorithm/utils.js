export function zeros(n) {
  return new Array(n).fill(0);
}

export function sign(x) {
  if (x === 0) return 0;
  return x > 0 ? 1 : -1;
}

export function find(arr, predicate) {
  const idx = [];
  if (typeof predicate === 'function') {
    for (let i = 0; i < arr.length; i++) if (predicate(arr[i], i, arr)) idx.push(i);
  } else {
    for (let i = 0; i < arr.length; i++) if (arr[i]) idx.push(i);
  }
  return idx;
}

export function diff(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const out = new Array(arr.length - 1);
  for (let i = 0; i < arr.length - 1; i++) out[i] = arr[i + 1] - arr[i];
  return out;
}

export function conv(x, h) {
  const N = x.length,
    M = h.length;
  const y = zeros(N + M - 1);
  for (let n = 0; n < y.length; n++) {
    let acc = 0;
    const kmin = Math.max(0, n - (M - 1));
    const kmax = Math.min(n, N - 1);
    for (let k = kmin; k <= kmax; k++) {
      acc += x[k] * h[n - k];
    }
    y[n] = acc;
  }
  return y;
}

function hamming(N) {
  const win = new Array(N);
  for (let n = 0; n < N; n++) {
    win[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
  }
  return win;
}

function sinc(x) {
  if (x === 0) return 1;
  const pix = Math.PI * x;
  return Math.sin(pix) / pix;
}

export function fir1Bandpass(order, wl, wh, window = 'hamming') {
  if (!Array.isArray(wl)) {
    wh = arguments[2];
    window = arguments[3] ?? 'hamming';
  }
  const Wl = Array.isArray(wl) ? wl[0] : wl;
  const Wh = Array.isArray(wl) ? wl[1] : wh;

  const N = order + 1;
  const M = order / 2;
  const win = window === 'hamming' ? hamming(N) : hamming(N);
  const h = new Array(N);
  for (let n = 0; n < N; n++) {
    const k = n - M;
    const ideal = 2 * Wh * sinc(2 * Wh * k) - 2 * Wl * sinc(2 * Wl * k);
    h[n] = ideal * win[n];
  }
  return h;
}

export function designBandpassForECG({ A = 26, fs = 400, f1 = 5, f2 = 30 } = {}) {
  const nyq = fs / 2;
  const wl = f1 / nyq;
  const wh = f2 / nyq;
  return fir1Bandpass(A, [wl, wh]);
}

const A = 26;
const fs = 400;
export const bp = designBandpassForECG({ A, fs, f1: 5, f2: 30 });

export function removeGroupDelayAfterConv(fullConv, A_even_order) {
  const delay = A_even_order / 2;
  return fullConv.slice(delay, fullConv.length - delay);
}
