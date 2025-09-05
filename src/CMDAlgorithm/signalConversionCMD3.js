import { getTopValue } from '../utils';

export function detectQRS_JS(inputSignal) {
  const Fs = 400;
  const ensembleSize = 10;
  const noiseStdFactor = 2;
  const maxImfs = 10;
  const maxSiftings = 100;
  const minPeakDistanceSec = 0.2;

  const X = Array.from(inputSignal).map(Number);
  const N = X.length;

  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const variance = (a) => {
    const m = mean(a);
    return a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length;
  };
  const std = (a) => Math.sqrt(variance(a));
  const maxAbs = (a) =>
    getTopValue(
      a.map((item) => Math.abs(item)),
      'max',
    );
  const medianOf = (a) => {
    const s = a.sort((x, y) => x - y);
    const m = s.length;
    if (!m) return 0;
    const mid = m >> 1;
    return m % 2 ? s[mid] : 0.5 * (s[mid - 1] + s[mid]);
  };
  const reflectIndex = (i, L) => {
    if (L === 1) return 0;
    const p = 2 * L - 2;
    let m = ((i % p) + p) % p;
    return m >= L ? p - m : m;
  };

  function movingMedianMirror(sig, k) {
    if (k <= 1) return sig.slice();
    const out = new Array(sig.length),
      half = Math.floor((k - 1) / 2);
    for (let i = 0; i < sig.length; i++) {
      const w = new Array(k),
        start = i - half;
      for (let j = 0; j < k; j++) w[j] = sig[reflectIndex(start + j, sig.length)];
      out[i] = medianOf(w);
    }
    return out;
  }

  function cubicSplineEval(xk, yk, xs) {
    const n = xk.length;
    if (!n) return xs.map(() => 0);
    if (n === 1) return xs.map(() => yk[0]);
    if (n === 2) {
      const [x0, x1] = xk,
        [y0, y1] = yk,
        dy = (y1 - y0) / (x1 - x0 || 1e-12);
      return xs.map((x) => y0 + dy * (x - x0));
    }
    const h = Array.from({ length: n - 1 }, (_, i) => xk[i + 1] - xk[i]),
      alpha = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++)
      alpha[i] = (3 / h[i]) * (yk[i + 1] - yk[i]) - (3 / h[i - 1]) * (yk[i] - yk[i - 1]);
    const l = new Array(n),
      mu = new Array(n),
      z = new Array(n);
    l[0] = 1;
    mu[0] = z[0] = 0;
    for (let i = 1; i < n - 1; i++) {
      l[i] = 2 * (xk[i + 1] - xk[i - 1]) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / (l[i] || 1e-12);
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / (l[i] || 1e-12);
    }
    l[n - 1] = 1;
    z[n - 1] = 0;
    const b = new Array(n - 1),
      c = new Array(n),
      d = new Array(n - 1);
    c[n - 1] = 0;
    for (let j = n - 2; j >= 0; j--) {
      c[j] = z[j] - mu[j] * (c[j + 1] || 0);
      b[j] = (yk[j + 1] - yk[j]) / (h[j] || 1e-12) - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
      d[j] = (c[j + 1] - c[j]) / (3 * (h[j] || 1e-12));
    }
    return xs.map((x) => {
      let j = 0;
      if (x <= xk[0]) j = 0;
      else if (x >= xk[n - 1]) j = n - 2;
      else
        for (let ii = 0; ii < n - 1; ii++)
          if (x >= xk[ii] && x <= xk[ii + 1]) {
            j = ii;
            break;
          }
      const dx = x - xk[j];
      return yk[j] + b[j] * dx + c[j] * dx * dx + d[j] * dx * dx * dx;
    });
  }

  function findExtrema(sig) {
    const maxima = [],
      minima = [],
      L = sig.length;
    for (let i = 1; i < L - 1; i++) {
      if (sig[i] > sig[i - 1] && sig[i] >= sig[i + 1]) maxima.push(i);
      if (sig[i] < sig[i - 1] && sig[i] <= sig[i + 1]) minima.push(i);
    }
    if (L >= 2) {
      if (sig[0] > sig[1]) maxima.unshift(0);
      if (sig[0] < sig[1]) minima.unshift(0);
      if (sig[L - 1] > sig[L - 2]) maxima.push(L - 1);
      if (sig[L - 1] < sig[L - 2]) minima.push(L - 1);
    }
    return { maxima, minima };
  }

  function emd(signal, _maxImfs = 10, _maxSiftings = 100) {
    const imfs = [],
      N = signal.length;
    let residue = signal.slice();
    const tol = 0.05 * Math.max(1e-12, std(signal));
    while (imfs.length < _maxImfs) {
      const ex = findExtrema(residue);
      if (ex.maxima.length + ex.minima.length < 2) break;
      let h = residue.slice(),
        it = 0;
      while (it < _maxSiftings) {
        const ex2 = findExtrema(h);
        if (ex2.maxima.length + ex2.minima.length < 2) break;
        const upper =
          ex2.maxima.length >= 2
            ? cubicSplineEval(
                ex2.maxima,
                ex2.maxima.map((i) => h[i]),
                Array.from({ length: N }, (_, i) => i),
              )
            : Array(N).fill(ex2.maxima.length ? h[ex2.maxima[0]] : 0);
        const lower =
          ex2.minima.length >= 2
            ? cubicSplineEval(
                ex2.minima,
                ex2.minima.map((i) => h[i]),
                Array.from({ length: N }, (_, i) => i),
              )
            : Array(N).fill(ex2.minima.length ? h[ex2.minima[0]] : 0);
        const m = new Array(N);
        for (let i = 0; i < N; i++) m[i] = 0.5 * (upper[i] + lower[i]);
        const hNext = new Array(N);
        for (let i = 0; i < N; i++) hNext[i] = h[i] - m[i];
        if (mean(m.map(Math.abs)) < tol) {
          h = hNext;
          break;
        }
        h = hNext;
        it++;
      }
      imfs.push(h.slice());
      for (let i = 0; i < N; i++) residue[i] -= h[i];
      const exA = findExtrema(residue);
      if (exA.maxima.length + exA.minima.length < 2) break;
    }
    imfs.push(residue.slice());
    return imfs;
  }

  function gaussianRandomArray(n, s = 1) {
    const out = new Array(n);
    for (let i = 0; i < n; i += 2) {
      const u1 = Math.random() || 1e-12,
        u2 = Math.random(),
        mag = Math.sqrt(-2 * Math.log(u1));
      const z0 = mag * Math.cos(2 * Math.PI * u2),
        z1 = mag * Math.sin(2 * Math.PI * u2);
      out[i] = z0 * s;
      if (i + 1 < n) out[i + 1] = z1 * s;
    }
    return out;
  }

  function ensembleEMD(signal, noiseStd, ensembleSize, _maxImfs, _maxSiftings) {
    const N = signal.length,
      runs = [];
    let maxCount = 0;
    for (let e = 0; e < ensembleSize; e++) {
      const noise = gaussianRandomArray(N, noiseStd),
        noisy = new Array(N);
      for (let i = 0; i < N; i++) noisy[i] = signal[i] + noise[i];
      const imfs = emd(noisy, _maxImfs, _maxSiftings);
      runs.push(imfs);
      if (imfs.length > maxCount) maxCount = imfs.length;
    }
    const modes = [];
    for (let k = 0; k < maxCount; k++) {
      const avg = new Array(N).fill(0);
      let c = 0;
      for (let r = 0; r < ensembleSize; r++) {
        const imfs = runs[r];
        if (k < imfs.length) {
          const m = imfs[k];
          for (let i = 0; i < N; i++) avg[i] += m[i];
          c++;
        }
      }
      if (c) for (let i = 0; i < N; i++) avg[i] /= c;
      modes.push(avg);
    }
    return modes;
  }

  let X1 = X.slice();
  const Xmean = mean(X1);
  for (let i = 0; i < N; i++) X1[i] -= Xmean;
  const maxabs = maxAbs(X1) || 1e-12;
  for (let i = 0; i < N; i++) X1[i] /= maxabs;

  const y1 = movingMedianMirror(X1, Math.max(1, Math.round(0.6 * Fs)));
  const y2 = movingMedianMirror(X1, Math.max(1, Math.round(0.2 * Fs)));
  const yy_pre = new Array(N);
  for (let i = 0; i < N; i++) yy_pre[i] = X1[i] - 0.5 * y1[i] - 0.5 * y2[i];

  const idxs = [],
    thrIdx = 0.2 * (Math.max(yy_pre.map(Math.abs)) || 1e-12);
  for (let i = 0; i < N; i++) if (Math.abs(yy_pre[i]) > thrIdx) idxs.push(yy_pre[i]);
  const signProbe = idxs.length ? medianOf(idxs) : mean(yy_pre);
  const yy = signProbe < 0 ? yy_pre.map((v) => -v) : yy_pre.slice();

  const sd_val = Math.sqrt(variance(yy));
  const modes = ensembleEMD(yy, noiseStdFactor * sd_val, ensembleSize, maxImfs, maxSiftings);
  const K = Math.min(4, modes.length);
  const y_signal = new Array(N).fill(0);
  for (let m = 0; m < K; m++) for (let i = 0; i < N; i++) y_signal[i] += modes[m][i];

  const y_pos = y_signal.map((v) => (v > 0 ? v : 0));
  const posVals = y_pos.filter((v) => v > 0);
  const mu = posVals.length ? mean(posVals) : 0;
  const sig = posVals.length ? Math.sqrt(variance(posVals)) : 0;
  const minPeakHeight = mu + 2 * sig;
  const minPeakDistance = Math.round(minPeakDistanceSec * Fs);
  const minProminence = 0.5 * sig;

  function findPositivePeaks(y, minH, minD, minProm, promWin = minD) {
    const N = y.length,
      cand = [];
    for (let i = 1; i < N - 1; i++)
      if (y[i] > 0 && y[i] > y[i - 1] && y[i] >= y[i + 1] && y[i] >= minH)
        cand.push({ idx: i, val: y[i] });
    cand.sort((a, b) => b.val - a.val);
    const kept = [];
    for (const c of cand) if (!kept.some((t) => Math.abs(t - c.idx) < minD)) kept.push(c.idx);
    const filtered = [];
    for (const i of kept) {
      const L = Math.max(0, i - promWin),
        R = Math.min(N - 1, i + promWin);
      let leftMin = y[i],
        rightMin = y[i];
      for (let k = L; k <= i; k++) if (y[k] < leftMin) leftMin = y[k];
      for (let k = i; k <= R; k++) if (y[k] < rightMin) rightMin = y[k];
      const prom = y[i] - Math.max(leftMin, rightMin);
      if (prom >= (minProm || 0)) filtered.push({ idx: i, val: y[i], prom });
    }
    return filtered.sort((a, b) => a.idx - b.idx);
  }

  const peakObjs = findPositivePeaks(y_pos, minPeakHeight, minPeakDistance, minProminence);
  const locs = peakObjs.map((p) => p.idx);

  return { locs, y_signal, y_pos };
}
