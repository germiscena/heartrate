export function detectRPeaks(signal, fs) {
  const MAX_IMFS = 10;
  const MAX_SIFTS = 8;
  const SD_STOP = 0.2;
  const EPS = 1e-12;
  const MIN_GAP = Math.max(1, Math.floor(0.1 * fs));
  const REFINE_WIN = 3;
  const DROP_FIRST_NOISY = 1;
  const CAP_USE_IMFS_UPTO = 5;

  const N = signal.length | 0;
  if (N < 3) return [];
  const x = signal instanceof Float32Array ? signal : new Float32Array(signal);

  const newF32 = (n) => new Float32Array(n);

  function countZeroCrossings(arr) {
    let c = 0,
      prev = arr[0];
    for (let i = 1; i < N; i++) {
      const v = arr[i];
      if ((prev >= 0 && v < 0) || (prev < 0 && v >= 0)) c++;
      prev = v;
    }
    return c;
  }

  function countExtrema(arr) {
    let c = 0;
    for (let i = 1; i < N - 1; i++) {
      const a = arr[i - 1],
        b = arr[i],
        c0 = arr[i + 1];
      if ((b > a && b > c0) || (b < a && b < c0)) c++;
    }
    return c;
  }

  function buildEnvelope(h, indices, outEnv) {
    if (indices.length === 0) {
      outEnv.fill(h[0]);
      return;
    }
    const firstIdx = indices[0];
    const firstVal = h[firstIdx];
    for (let i = 0; i < firstIdx; i++) outEnv[i] = firstVal;
    for (let k = 0; k < indices.length - 1; k++) {
      const i1 = indices[k],
        i2 = indices[k + 1];
      const v1 = h[i1],
        v2 = h[i2];
      const len = i2 - i1;
      const slope = (v2 - v1) / len;
      let acc = v1;
      outEnv[i1] = v1;
      for (let i = i1 + 1; i < i2; i++) {
        acc += slope;
        outEnv[i] = acc;
      }
      outEnv[i2] = v2;
    }
    const lastIdx = indices[indices.length - 1];
    const lastVal = h[lastIdx];
    for (let i = lastIdx + 1; i < N; i++) outEnv[i] = lastVal;
  }

  function siftOnce(h, upperEnv, lowerEnv, meanEnv) {
    const maxIdx = [];
    const minIdx = [];
    for (let i = 1; i < N - 1; i++) {
      const a = h[i - 1],
        b = h[i],
        c = h[i + 1];
      if (b > a && b > c) maxIdx.push(i);
      else if (b < a && b < c) minIdx.push(i);
    }
    if (maxIdx.length + minIdx.length < 2) return false;

    if (h[0] > h[1]) maxIdx.unshift(0);
    else if (h[0] < h[1]) minIdx.unshift(0);
    if (h[N - 1] > h[N - 2]) maxIdx.push(N - 1);
    else if (h[N - 1] < h[N - 2]) minIdx.push(N - 1);

    buildEnvelope(h, maxIdx, upperEnv);
    buildEnvelope(h, minIdx, lowerEnv);
    for (let i = 0; i < N; i++) {
      meanEnv[i] = 0.5 * (upperEnv[i] + lowerEnv[i]);
      h[i] = h[i] - meanEnv[i];
    }
    return true;
  }

  function sdChange(prev, curr) {
    let s = 0.0;
    for (let i = 0; i < N; i++) {
      const num = prev[i] - curr[i];
      const den = prev[i] * prev[i] + EPS;
      s += (num * num) / den;
    }
    return s;
  }

  function extractIMF(residue, upperEnv, lowerEnv, meanEnv, work) {
    work.set(residue);
    let h = work;
    let prev = newF32(N);
    let okSift = true;

    for (let s = 0; s < MAX_SIFTS; s++) {
      prev.set(h);
      okSift = siftOnce(h, upperEnv, lowerEnv, meanEnv);
      if (!okSift) break;
      const sd = sdChange(prev, h);
      const ext = countExtrema(h);
      const zc = countZeroCrossings(h);
      const isIMFshape = Math.abs(ext - zc) <= 1;

      if (sd < SD_STOP && isIMFshape) break;
    }
    if (!okSift) return { imf: null, residue };
    const imf = newF32(N);
    for (let i = 0; i < N; i++) {
      imf[i] = h[i];
      residue[i] = residue[i] - imf[i];
    }
    return { imf, residue };
  }
  const upperEnv = newF32(N),
    lowerEnv = newF32(N),
    meanEnv = newF32(N),
    work = newF32(N);
  let residue = newF32(N);
  residue.set(x);
  const imfs = [];

  for (let k = 0; k < MAX_IMFS; k++) {
    const { imf, residue: newResidue } = extractIMF(residue, upperEnv, lowerEnv, meanEnv, work);
    residue = newResidue;
    if (!imf) break;
    imfs.push(imf);
    if (countExtrema(residue) < 2) break;
  }

  if (imfs.length === 0) return [];

  const K = imfs.length;
  const useStart = Math.min(DROP_FIRST_NOISY, K - 1);
  const useEndExclusive = Math.max(K - 1, useStart + 1);
  const y = newF32(N);
  let used = 0;
  for (let idx = useStart; idx < useEndExclusive; idx++) {
    y.set(imfs[idx], 0);
    used = 1;
    break;
  }
  for (let idx = useStart + 1; idx < useEndExclusive && used < CAP_USE_IMFS_UPTO; idx++, used++) {
    const c = imfs[idx];
    for (let i = 0; i < N; i++) y[i] += c[i];
  }
  if (used === 0) y.set(imfs[0]);
  const candIdx = [];
  const candAmp = [];
  for (let i = 1; i < N - 1; i++) {
    const a = y[i - 1],
      b = y[i],
      c = y[i + 1];
    if (b > a && b > c && b > 0) {
      candIdx.push(i);
      candAmp.push(b);
    }
  }
  if (candIdx.length === 0) return [];

  let maxAmp = -Infinity;
  for (let i = 0; i < candAmp.length; i++) if (candAmp[i] > maxAmp) maxAmp = candAmp[i];
  const tmp = candAmp.slice().sort((u, v) => u - v);
  const med =
    tmp.length % 2
      ? tmp[(tmp.length - 1) >> 1]
      : 0.5 * (tmp[tmp.length / 2 - 1] + tmp[tmp.length / 2]);
  const thr = Math.max(0.3 * maxAmp, 0.6 * med);

  const fIdx = [];
  const fAmp = [];
  for (let i = 0; i < candIdx.length; i++) {
    if (candAmp[i] >= thr) {
      fIdx.push(candIdx[i]);
      fAmp.push(candAmp[i]);
    }
  }
  if (fIdx.length === 0) return [];

  const keepIdx = [];
  const keepAmp = [];
  let curIdx = fIdx[0],
    curAmp = fAmp[0];
  for (let i = 1; i < fIdx.length; i++) {
    const idx = fIdx[i],
      amp = fAmp[i];
    if (idx - curIdx < MIN_GAP) {
      if (amp > curAmp) {
        curIdx = idx;
        curAmp = amp;
      }
    } else {
      keepIdx.push(curIdx);
      keepAmp.push(curAmp);
      curIdx = idx;
      curAmp = amp;
    }
  }
  keepIdx.push(curIdx);
  keepAmp.push(curAmp);
  const result = [];
  for (let k2 = 0; k2 < keepIdx.length; k2++) {
    const center = keepIdx[k2];
    let bestI = center;
    let bestV = x[center];
    const i0 = Math.max(0, center - REFINE_WIN);
    const i1 = Math.min(N - 1, center + REFINE_WIN);
    for (let i = i0; i <= i1; i++) {
      const v = x[i];
      if (v > bestV) {
        bestV = v;
        bestI = i;
      }
    }
    if (bestV > 0) result.push(bestI);
  }
  result.sort((a, b) => a - b);
  const dedup = [];
  for (let i = 0; i < result.length; i++) {
    if (i === 0 || result[i] !== result[i - 1]) dedup.push(result[i]);
  }
  return dedup;
}
