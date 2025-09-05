export function toFloat32(arr) {
  return arr instanceof Float32Array ? arr : Float32Array.from(arr);
}
export function ensureOdd(n) {
  return n % 2 === 0 ? n + 1 : n;
}

export function designHPBiquad(fc, fs, Q) {
  const w0 = (2 * Math.PI * fc) / fs,
    cosw0 = Math.cos(w0),
    sinw0 = Math.sin(w0),
    alpha = sinw0 / (2 * Q);
  let b0 = (1 + cosw0) / 2,
    b1 = -(1 + cosw0),
    b2 = (1 + cosw0) / 2,
    a0 = 1 + alpha,
    a1 = -2 * cosw0,
    a2 = 1 - alpha;
  b0 /= a0;
  b1 /= a0;
  b2 /= a0;
  a1 /= a0;
  a2 /= a0;
  return { b0, b1, b2, a1, a2 };
}
export function designButterworthHP_SOS(fc, fs, order) {
  if (order === 2) return [designHPBiquad(fc, fs, 1 / Math.SQRT2)];
  const Qs = [0.5411961, 1.30656296];
  return Qs.map((Q) => designHPBiquad(fc, fs, Q));
}

export function biquadCascade(x, sos) {
  let y = new Float32Array(x.length);
  x = toFloat32(x);
  for (let s = 0; s < sos.length; s++) {
    const { b0, b1, b2, a1, a2 } = sos[s];
    let z1 = 0.0,
      z2 = 0.0;
    for (let n = 0; n < x.length; n++) {
      const xn = x[n];
      const yn = b0 * xn + z1;
      z1 = b1 * xn - a1 * yn + z2;
      z2 = b2 * xn - a2 * yn;
      y[n] = yn;
    }
    if (s < sos.length - 1) {
      x = y;
      y = new Float32Array(x.length);
    }
  }
  return y;
}

export function reflectPad(x, nPad) {
  const N = x.length;
  const out = new Float32Array(N + 2 * nPad);
  for (let i = 0; i < nPad; i++) out[i] = 2 * x[0] - x[nPad - i];
  out.set(x, nPad);
  for (let i = 0; i < nPad; i++) out[nPad + N + i] = 2 * x[N - 1] - x[N - 2 - i];
  return out;
}

export function filtfiltBiquad(x, sos) {
  const N = x.length;
  const pad = Math.max(1, Math.min(3 * 2 * sos.length, N - 1));
  const xp = reflectPad(x, pad);
  let y = biquadCascade(xp, sos);
  y.reverse();
  y = biquadCascade(y, sos);
  y.reverse();
  return y.subarray(pad, pad + N).slice();
}

export function designLPBiquad(fc, fs, Q) {
  const w0 = (2 * Math.PI * fc) / fs,
    cosw0 = Math.cos(w0),
    sinw0 = Math.sin(w0),
    alpha = sinw0 / (2 * Q);
  let b0 = (1 - cosw0) / 2,
    b1 = 1 - cosw0,
    b2 = (1 - cosw0) / 2,
    a0 = 1 + alpha,
    a1 = -2 * cosw0,
    a2 = 1 - alpha;
  b0 /= a0;
  b1 /= a0;
  b2 /= a0;
  a1 /= a0;
  a2 /= a0;
  return { b0, b1, b2, a1, a2 };
}
export function designButterworthLP_SOS(fc, fs, order) {
  if (order === 2) return [designLPBiquad(fc, fs, 1 / Math.SQRT2)];
  const Qs = [0.5411961, 1.30656296];
  return Qs.map((Q) => designLPBiquad(fc, fs, Q));
}

export function mean(arr) {
  let s = 0,
    n = arr.length;
  for (let i = 0; i < n; i++) s += arr[i];
  return s / Math.max(1, n);
}
export function stdDev(arr, center) {
  let s2 = 0,
    n = arr.length;
  for (let i = 0; i < n; i++) {
    const d = arr[i] - center;
    s2 += d * d;
  }
  return Math.sqrt(s2 / Math.max(1, n));
}
export function mapAbsMinus(arr, center) {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = Math.abs(arr[i] - center);
  return out;
}

export function quantile(arr, q) {
  const n = arr.length;
  if (n === 0) return NaN;
  if (q <= 0) return minOf(arr);
  if (q >= 1) return maxOf(arr);
  const a = Float32Array.from(arr);
  const pos = (n - 1) * q;
  const k = Math.floor(pos);
  const frac = pos - k;
  const vK = selectKthInPlace(a, k);
  if (frac === 0) return vK;
  const vK1 = selectKthInPlace(a, k + 1);
  return vK + (vK1 - vK) * frac;
}
export function selectKthInPlace(a, k, left = 0, right = a.length - 1) {
  while (true) {
    if (left === right) return a[left];
    const mid = left + ((right - left) >> 1);
    if (a[right] < a[left]) swap(a, left, right);
    if (a[mid] < a[left]) swap(a, mid, left);
    if (a[right] < a[mid]) swap(a, right, mid);
    let pivot = a[mid];
    let i = left,
      j = right;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) {
        swap(a, i, j);
        i++;
        j--;
      }
    }
    if (k <= j) right = j;
    else if (k >= i) left = i;
    else return a[k];
  }
}
export function swap(a, i, j) {
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
}
export function minOf(arr) {
  let m = +Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  return m;
}
export function maxOf(arr) {
  let m = -Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

export function makeSampleView(x, maxSample) {
  const N = x.length;
  if (N <= maxSample) return toFloat32(x);
  const stride = Math.max(1, Math.floor(N / maxSample));
  const start = (Math.random() * stride) | 0;
  const M = Math.ceil((N - start) / stride);
  const out = new Float32Array(Math.min(maxSample, M));
  for (let i = start, j = 0; i < N && j < out.length; i += stride, j++) out[j] = x[i];
  return out;
}

export function diff5Symmetric(x) {
  const N = x.length,
    xp = reflectPad(x, 2),
    out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const i = n + 2;
    out[n] = (-xp[i - 2] - 2 * xp[i - 1] + 2 * xp[i + 1] + xp[i + 2]) * 0.125;
  }
  return out;
}
export function diff1Central(x) {
  const N = x.length,
    xp = reflectPad(x, 1),
    out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const i = n + 1;
    out[n] = 0.5 * (xp[i + 1] - xp[i - 1]);
  }
  return out;
}

export function centeredMovingAverage(x, W) {
  if (W < 3) return toFloat32(x).slice();
  W = ensureOdd(W);
  const L = (W - 1) >> 1,
    xp = reflectPad(x, L),
    N = x.length;
  const ps = new Float64Array(xp.length + 1);
  for (let i = 0; i < xp.length; i++) ps[i + 1] = ps[i] + xp[i];
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const s = ps[n + W] - ps[n];
    out[n] = s / W;
  }
  return out;
}

export function msToSamples(fs, ms) {
  return Math.max(1, Math.round((ms * fs) / 1000));
}
export function rrMedian(rrBuf) {
  if (!rrBuf.length) return 0;
  return quantile(Float32Array.from(rrBuf), 0.5);
}
export function rrBufPush(rrBuf, rr) {
  rrBuf.push(rr);
  if (rrBuf.length > 8) rrBuf.shift();
}
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
export function toInt32Array(a) {
  if (a instanceof Int32Array) return a;
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] | 0;
  return out;
}

export function argmaxAbsInRange(arr, l, r, center) {
  let bestIdx = l,
    bestVal = Math.abs(arr[l]);
  for (let j = l + 1; j <= r; j++) {
    const v = Math.abs(arr[j]);
    if (v > bestVal) {
      bestVal = v;
      bestIdx = j;
    } else if (v === bestVal) {
      const dj = Math.abs(j - center),
        db = Math.abs(bestIdx - center);
      if (dj < db || (dj === db && j < bestIdx)) bestIdx = j;
    }
  }
  return bestIdx;
}
export function strength(arr, i) {
  return Math.abs(arr[i] || 0);
}
export function preSlopeMag(x, idx, preW) {
  const l = Math.max(1, idx - preW),
    r = idx;
  let maxd = 0;
  for (let i = l; i <= r; i++) {
    const d = Math.abs(x[i] - x[i - 1]);
    if (d > maxd) maxd = d;
  }
  return maxd;
}
export function absSlice(arr, L, R) {
  const out = new Float32Array(R - L + 1);
  for (let i = L, j = 0; i <= R; i++, j++) out[j] = Math.abs(arr[i]);
  return out;
}
export function sortUniqueInt32(a) {
  const tmp = Array.from(a);
  tmp.sort((u, v) => u - v);
  const out = [];
  let last = null;
  for (let i = 0; i < tmp.length; i++) {
    const v = tmp[i] | 0;
    if (last === null || v !== last) {
      out.push(v);
      last = v;
    }
  }
  return Int32Array.from(out);
}

export function absMinus(arr, c) {
  const o = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) o[i] = Math.abs(arr[i] - c);
  return o;
}
export function argmaxInRange(arr, L, R, center) {
  let bi = L,
    bv = arr[L];
  for (let j = L + 1; j <= R; j++) {
    const v = arr[j];
    if (
      v > bv ||
      (v === bv && Math.abs(j - center) < Math.abs(bi - center)) ||
      (v === bv && Math.abs(j - center) === Math.abs(bi - center) && j < bi)
    ) {
      bv = v;
      bi = j;
    }
  }
  return bi;
}
export function snapToHillZeroCross(arr, i0, rad) {
  const L = Math.max(1, i0 - rad),
    R = Math.min(arr.length - 2, i0 + rad);
  let best = -1,
    bestD = 1e9;
  for (let j = L; j <= R; j++) {
    const dL = arr[j] - arr[j - 1],
      dR = arr[j + 1] - arr[j],
      s2 = arr[j + 1] - 2 * arr[j] + arr[j - 1];
    if (dL > 0 && dR <= 0 && s2 < 0) {
      const D = Math.abs(j - i0);
      if (D < bestD) {
        best = j;
        bestD = D;
      }
    }
  }
  return best >= 0 ? best : i0;
}
export function positiveProminence(sig, i, W) {
  const half = (W - 1) >> 1;
  const L = Math.max(0, i - half),
    R = Math.min(sig.length - 1, i + half);
  const seg = sig.subarray ? sig.subarray(L, R + 1) : sig.slice(L, R + 1);
  const med = quantile(seg, 0.5);
  const mad = quantile(absMinus(seg, med), 0.5) || 0;
  const thr = Math.max(0.03, 1.5 * mad);
  const mid = i - L;
  const leftMed = quantile(
    seg.subarray ? seg.subarray(0, Math.max(1, mid)) : seg.slice(0, Math.max(1, mid)),
    0.5,
  );
  const rightMed = quantile(
    seg.subarray
      ? seg.subarray(Math.min(seg.length - 1, mid + 1))
      : seg.slice(Math.min(seg.length - 1, mid + 1)),
    0.5,
  );
  const base = Math.max(leftMed, rightMed);
  return sig[i] >= base + thr;
}
export function sidedSlopeCheck(arr, i, preW, postW) {
  const L = Math.max(1, i - preW),
    R = Math.min(arr.length - 1, i + postW);
  let up = 0,
    nL = 0;
  for (let j = L; j <= i; j++) {
    const dj = arr[j] - arr[j - 1];
    if (dj !== 0) {
      nL++;
      if (dj > 0) up++;
    }
  }
  let dn = 0,
    nR = 0;
  for (let j = i + 1; j <= R; j++) {
    const dj = arr[j] - arr[j - 1];
    if (dj !== 0) {
      nR++;
      if (dj < 0) dn++;
    }
  }
  return (nL ? up / nL : 0) >= 0.55 && (nR ? dn / nR : 0) >= 0.55;
}
