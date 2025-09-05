function designFIRBandpass(fs, f1, f2, taps) {
  const M = taps;
  const mid = (M - 1) / 2;
  const h = new Float64Array(M);
  for (let n = 0; n < M; n++) {
    const k = n - mid;
    const win = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (M - 1));
    const sinc = (f) =>
      k === 0 ? (2 * f) / fs : Math.sin((2 * Math.PI * f * k) / fs) / (Math.PI * k);
    h[n] = (sinc(f2) - sinc(f1)) * win;
  }
  const sum = h.reduce((a, b) => a + b, 0);
  for (let i = 0; i < M; i++) h[i] /= sum || 1;
  return h;
}

function filtfiltFIR(x, h) {
  const nPad = Math.min(3 * (h.length - 1), x.length - 1);
  const xPad = reflectPad(x, nPad);
  const y1 = convFIR(xPad, h);
  y1.reverse();
  const y2 = convFIR(y1, h);
  y2.reverse();
  return y2.subarray(nPad, nPad + x.length);
}

function reflectPad(x, nPad) {
  const N = x.length;
  const out = new Float64Array(N + 2 * nPad);
  for (let i = 0; i < nPad; i++) out[nPad - 1 - i] = x[i + 1] ?? x[0];
  for (let i = 0; i < N; i++) out[nPad + i] = x[i];
  for (let i = 0; i < nPad; i++) out[nPad + N + i] = x[N - 2 - i] ?? x[N - 1];
  return out;
}

function convFIR(x, h) {
  const N = x.length,
    M = h.length,
    y = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    let acc = 0;
    for (let k = 0; k < M; k++) {
      const i = n - k;
      if (i >= 0) acc += h[k] * x[i];
    }
    y[n] = acc;
  }
  return y;
}

export function detectECGPeaksStages(signal, opts = {}) {
  const {
    fs = 400,
    band = [5, 20],
    firTaps = 81,
    mwiSec = 0.12,
    refractorySec = 0.2,
    refineSec = 0.08,
  } = opts;

  const x = signal instanceof Float64Array ? signal : Float64Array.from(signal);
  const N = x.length;
  if (N === 0) return { indices: [], stages: {} };

  const bpArr = new Float64Array(N);
  const dArr = new Float64Array(N);
  const sArr = new Float64Array(N);
  const mArr = new Float64Array(N);
  const thArr = new Float64Array(N).fill(NaN);
  const h = designFIRBandpass(fs, band[0], band[1], firTaps);
  const yBP = filtfiltFIR(x, h);
  if (bpArr) bpArr.set(yBP);

  const W = Math.max(1, Math.round(mwiSec * fs));

  const dBuf = new Float64Array(5);
  let dpos = 0,
    dCount = 0;
  const mwiBuf = new Float64Array(W);
  let mpos = 0,
    msum = 0,
    mCount = 0;
  const mRingLen = Math.max(W + 1, Math.round(3 * fs));
  const mRing = new Float64Array(mRingLen);

  let SPKI = 0,
    NPKI = 0,
    TH1 = 0;
  let initialized = false,
    initMax = 0,
    initCount = 0;
  const initNeeded = Math.round(2 * fs);

  const peaks = [];
  let lastR = -Infinity;
  const rrHist = [];
  const rrWin = 8;
  let mPrev2 = 0,
    mPrev1 = 0,
    mCurr = 0;
  let mValid = false;

  for (let n = 0; n < N; n++) {
    dBuf[dpos] = yBP[n];
    dpos = (dpos + 1) % 5;
    dCount++;
    let d = 0;
    if (dCount >= 5) {
      const i0 = (dpos + 4) % 5,
        i1 = (dpos + 3) % 5,
        i3 = (dpos + 1) % 5,
        i4 = (dpos + 0) % 5;
      d = (2 * dBuf[i0] + dBuf[i1] - dBuf[i3] - 2 * dBuf[i4]) / 8;
    }
    if (dArr) dArr[n] = d;

    const s = d * d;
    if (sArr) sArr[n] = s;

    if (mCount < W) {
      msum += s;
      mwiBuf[mpos] = s;
      mpos = (mpos + 1) % W;
      mCount++;
    } else {
      msum += s - mwiBuf[mpos];
      mwiBuf[mpos] = s;
      mpos = (mpos + 1) % W;
    }
    const mShow = msum / Math.min(W, mCount || 1);
    if (mArr) mArr[n] = mShow;

    if (mCount < W) {
      continue;
    }

    const m = msum / W;
    mRing[n % mRingLen] = m;
    if (!mValid) {
      mPrev2 = mPrev1 = mCurr = m;
      mValid = true;
      continue;
    }
    mPrev2 = mPrev1;
    mPrev1 = mCurr;
    mCurr = m;

    if (!initialized) {
      initMax = Math.max(initMax, mPrev1);
      if (++initCount >= initNeeded) {
        SPKI = 0.25 * initMax;
        NPKI = 0.125 * initMax;
        TH1 = NPKI + 0.2 * (SPKI - NPKI);
        initialized = true;
      }
      if (thArr) thArr[n] = initialized ? TH1 : n > 0 ? thArr[n - 1] : 0; // <-- без NaN
      continue;
    }

    if (thArr) thArr[n] = TH1;

    if (mPrev1 > mPrev2 && mPrev1 >= mCurr) {
      const idxM = n - 1;
      const meanRR = rrHist.length
        ? rrHist.reduce((a, b) => a + b, 0) / rrHist.length
        : Math.round(0.8 * fs);
      const missRR = Math.round(1.6 * meanRR);
      if (idxM - lastR > missRR) {
        const start = Math.max(lastR + Math.max(1, Math.round(0.2 * fs)), idxM - missRR);
        const end = idxM - Math.max(1, Math.round(0.08 * fs));
        let best = -Infinity,
          bestI = -1;
        for (let i = start; i < end; i++) {
          const v = mRing[i % mRingLen];
          if (v > best) {
            best = v;
            bestI = i;
          }
        }
        if (bestI >= 0 && best >= 0.5 * TH1) accept(bestI, best);
      }
      if (mPrev1 >= TH1 && idxM - lastR >= Math.max(1, Math.round(0.2 * fs))) accept(idxM, mPrev1);
      else {
        NPKI = 0.125 * mPrev1 + 0.875 * NPKI;
        TH1 = NPKI + 0.2 * (SPKI - NPKI);
      }
    }
  }

  return {
    indices: peaks,
    bandpass: bpArr,
    differentiated: dArr,
    squared: sArr,
    mwi: mArr,
  };

  function accept(idxM, mVal) {
    const delay = Math.round((W - 1) / 2 + 2);
    const refine = Math.max(1, Math.round((opts.refineSec ?? 0.08) * fs));
    let guess = idxM - delay;
    if (guess < 0) guess = 0;
    if (guess >= N) guess = N - 1;
    const L = Math.max(0, guess - refine),
      R = Math.min(N - 1, guess + refine);
    let bestIdx = -1,
      bestVal = -Infinity;
    for (let j = L; j <= R; j++) {
      const v = yBP[j];
      if (v > 0 && v > bestVal) {
        bestVal = v;
        bestIdx = j;
      }
    }
    if (bestIdx < 0) {
      NPKI = 0.125 * mVal + 0.875 * NPKI;
      TH1 = NPKI + 0.2 * (SPKI - NPKI);
      return;
    }
    if (bestIdx > 0 && bestIdx < N - 1) {
      const y1 = yBP[bestIdx - 1],
        y2 = yBP[bestIdx],
        y3 = yBP[bestIdx + 1];
      const denom = y1 - 2 * y2 + y3;
      if (denom !== 0) {
        const delta = (0.5 * (y1 - y3)) / denom;
        const cand = Math.round(bestIdx + Math.max(-1, Math.min(1, delta)));
        if (cand >= L && cand <= R && yBP[cand] >= y2 && yBP[cand] > 0) bestIdx = cand;
      }
    }
    peaks.push(bestIdx);
    if (lastR > -Infinity) {
      rrHist.push(bestIdx - lastR);
      if (rrHist.length > rrWin) rrHist.shift();
    }
    lastR = bestIdx;
    SPKI = 0.125 * mVal + 0.875 * SPKI;
    TH1 = NPKI + 0.2 * (SPKI - NPKI);
  }
}
