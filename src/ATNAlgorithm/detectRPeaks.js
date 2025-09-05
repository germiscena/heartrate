import { getTopValue } from '../utils';

export function newDetectRPeaksATN(signalData, filteredSignal) {
  const fs = 400;
  const M = 32;
  const lambda = 0.8;
  const refractoryMs = 250;

  const threshold1 = 0.08;
  const threshold2 = 0.7;
  const thresholdL4 = 0.3;
  const rescueThresh = 0.2;

  const weakDsMin = 0.1;
  const weakDsMax = 0.15;
  const weakAmpFracDefault = 0.03;
  const slopeFrac = 0.4;

  const eps = 1e-12;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const downsample = (v, m) => {
    const o = [];
    for (let i = 0; i < v.length; i += m) o.push(v[i]);
    return o;
  };
  const movingAverage = (v, w) => {
    const out = new Array(v.length).fill(0);
    let s = 0;
    for (let i = 0; i < v.length; i++) {
      s += v[i];
      if (i >= w) s -= v[i - w];
      out[i] = s / Math.min(i + 1, w);
    }
    return out;
  };
  const history = (ynm1, x) => (1 - lambda) * x + lambda * ynm1;
  const findPeaks = (v) => {
    const idx = [];
    for (let i = 1; i < v.length - 1; i++) if (v[i] >= v[i - 1] && v[i] > v[i + 1]) idx.push(i);
    return idx;
  };

  const median = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const k = Math.floor(s.length / 2);
    return s.length % 2 ? s[k] : 0.5 * (s[k - 1] + s[k]);
  };
  const mad = (arr) => {
    const m = median(arr);
    return median(arr.map((x) => Math.abs(x - m))) || 1;
  };

  const bandEnergyAt = (i, w1, w2, w3, w4) =>
    Math.abs(w1[i]) + Math.abs(w2[i]) + Math.abs(w3[i]) + Math.abs(w4[i]);
  function positiveMaximaIndex(raw, a, b) {
    let best = -Infinity,
      bestI = -1;
    const aa = clamp(a, 1, raw.length - 2),
      bb = clamp(b, 1, raw.length - 2);
    for (let i = aa; i <= bb; i++) {
      if (raw[i] > 0 && raw[i] >= raw[i - 1] && raw[i] > raw[i + 1]) {
        if (raw[i] > best) {
          best = raw[i];
          bestI = i;
        }
      }
    }
    return bestI;
  }

  function otsuThreshold(arr, bins = 64) {
    if (!arr.length) return 0.2;
    const min = getTopValue(arr, 'min'),
      max = getTopValue(arr, 'max');
    if (max - min < 1e-12) return min;
    const h = new Array(bins).fill(0);
    for (const v of arr) {
      const k = Math.max(
        0,
        Math.min(bins - 1, Math.floor(((v - min) / (max - min + 1e-12)) * bins)),
      );
      h[k]++;
    }
    const total = arr.length;
    const w = new Array(bins).fill(0),
      m = new Array(bins).fill(0);
    w[0] = h[0];
    m[0] = 0 * h[0];
    for (let i = 1; i < bins; i++) {
      w[i] = w[i - 1] + h[i];
      m[i] = m[i - 1] + i * h[i];
    }
    const mT = m[bins - 1];
    let bestT = 0,
      bestVar = -1;
    for (let t = 0; t < bins - 1; t++) {
      const w0 = w[t],
        w1 = total - w0;
      if (w0 === 0 || w1 === 0) continue;
      const m0 = m[t] / w0,
        m1 = (mT - m[t]) / w1;
      const vb = w0 * w1 * (m0 - m1) * (m0 - m1);
      if (vb > bestVar) {
        bestVar = vb;
        bestT = t;
      }
    }
    return min + ((bestT + 0.5) * (max - min)) / bins;
  }

  function slopeAround(data, i, fs) {
    const rad = Math.max(1, Math.round(fs * 0.012));
    let s = 0,
      c = 0;
    for (let k = 1; k <= rad; k++) {
      const a = i - k,
        b = i + k;
      if (a >= 0 && b < data.length) {
        s += Math.abs(data[b] - data[a]);
        c++;
      }
    }
    return c ? s / c : 0;
  }

  const [w1i, w2i, w3i, w4i] = filteredSignal || [];
  if (!w1i || !w2i || !w3i || !w4i) return [];
  const L = Math.min(signalData.length, w1i.length, w2i.length, w3i.length, w4i.length);

  let m = 0,
    c = 0;
  for (let i = 0; i < L; i++) {
    const x = signalData[i];
    if (!Number.isNaN(x)) {
      m += x;
      c++;
    }
  }
  const mean = c ? m / c : 0;
  const data = Array.from({ length: L }, (_, i) =>
    Number.isNaN(signalData[i]) ? mean : signalData[i],
  );

  const s1 = mad(w1i),
    s2 = mad(w2i),
    s3 = mad(w3i),
    s4 = mad(w4i);
  const w1 = w1i.map((x) => x / (s1 + 1e-12));
  const w2 = w2i.map((x) => x / (s2 + 1e-12));
  const w3 = w3i.map((x) => x / (s3 + 1e-12));
  const w4 = w4i.map((x) => x / (s4 + 1e-12));

  const y2 = downsample(w1.slice(0, L), M);
  const y3 = downsample(w2.slice(0, L), M);
  const y4 = downsample(w3.slice(0, L), M);
  const y5 = downsample(w4.slice(0, L), M);
  const Ld = Math.min(y2.length, y3.length, y4.length, y5.length);
  y2.length = Ld;
  y3.length = Ld;
  y4.length = Ld;
  y5.length = Ld;

  const P1 = new Array(Ld),
    P2 = new Array(Ld),
    P4 = new Array(Ld);
  for (let i = 0; i < Ld; i++) {
    const a2 = Math.abs(y2[i]),
      a3 = Math.abs(y3[i]),
      a4 = Math.abs(y4[i]),
      a5 = Math.abs(y5[i]);
    P1[i] = a2 + a3 + a4;
    P2[i] = a2 + a3 + a4 + a5;
    P4[i] = a3 + a4 + a5;
  }
  const neighborAvg = (P) => {
    const out = new Array(P.length + 1);
    out[0] = P[0] / 2;
    for (let i = 0; i < P.length - 1; i++) out[i + 1] = (P[i] + P[i + 1]) / 2;
    out[out.length - 1] = P[P.length - 1] / 2;
    return out;
  };
  const FL1 = neighborAvg(P1);
  const FL2 = neighborAvg(P2);
  const FL4 = neighborAvg(P4);

  const allEvents = findPeaks(FL1);
  if (!allEvents.length) return [];
  const coarseRad = 2 * M;
  const fineRad = Math.max(1, Math.round(fs * 0.04));
  const EventsL1 = [];
  for (const p of allEvents) {
    const base = clamp(p * M, 0, L - 1);
    if (positiveMaximaIndex(data, base - coarseRad, base + coarseRad) !== -1) EventsL1.push(p);
  }
  if (!EventsL1.length) return [];

  const meanL1 = EventsL1.reduce((s, p) => s + FL2[p], 0) / EventsL1.length;
  let NL = meanL1 * (1 - 0.1);
  let SL = meanL1 * (1 + 0.1);
  function detectionBlock(mwi, Events, NL0, SL0, thr) {
    let NL = NL0,
      SL = SL0,
      sumSig = SL0,
      sumNoi = NL0;
    const Signal = [],
      Noise = [],
      VDs = [],
      Class = [];
    for (let i = 0; i < Events.length; i++) {
      const P = Events[i];
      const Ds = Math.min(1, Math.max(0, (mwi[P] - NL) / Math.max(eps, SL - NL)));
      VDs.push(Ds);
      if (Ds > thr) {
        Signal.push(P);
        Class.push(1);
        sumSig += mwi[P];
        SL = sumSig / (Signal.length + 1);
      } else {
        Noise.push(P);
        Class.push(0);
        sumNoi += mwi[P];
        NL = sumNoi / (Noise.length + 1);
      }
    }
    return { Signal, Noise, VDs, Class };
  }
  const B1 = detectionBlock(FL2, EventsL1, NL, SL, threshold1);
  const B2 = detectionBlock(FL2, EventsL1, NL, SL, threshold2);

  const ClassL3 = EventsL1.map((_, i) => {
    const C1 = B1.Class[i],
      C2 = B2.Class[i];
    if (C1 === 1 && C2 === 1) return 1;
    if (C1 === 0 && C2 === 0) return 0;
    if (C1 === 1 && C2 === 0) {
      const d1 = (B1.VDs[i] - threshold1) / (1 - threshold1);
      const d2 = (threshold2 - B2.VDs[i]) / threshold2;
      return d1 > d2 ? 1 : 0;
    }
    return 1;
  });
  const SignalL3 = [],
    NoiseL3 = [];
  for (let i = 0; i < EventsL1.length; i++) (ClassL3[i] ? SignalL3 : NoiseL3).push(EventsL1[i]);

  let SL4 = SignalL3.length
    ? SignalL3.reduce((s, p) => s + FL4[p], 0) / SignalL3.length
    : EventsL1.reduce((s, p) => s + FL4[p], 0) / EventsL1.length;
  let NL4 = NoiseL3.length
    ? NoiseL3.reduce((s, p) => s + FL4[p], 0) / NoiseL3.length
    : (EventsL1.reduce((s, p) => s + FL4[p], 0) / EventsL1.length) * 0.5;
  const SignalL4 = [],
    NoiseL4 = [];
  for (let i = 0; i < EventsL1.length; i++) {
    const P = EventsL1[i];
    const Ds = Math.min(1, Math.max(0, (FL4[P] - NL4) / Math.max(eps, SL4 - NL4)));
    if (ClassL3[i] === 1) {
      SignalL4.push(P);
      SL4 = history(SL4, FL4[P]);
    } else {
      if (Ds > thresholdL4) {
        SignalL4.push(P);
        SL4 = history(SL4, FL4[P]);
      } else {
        NoiseL4.push(P);
        NL4 = history(NL4, FL4[P]);
      }
    }
  }

  const SignalL5 = SignalL4.slice();
  const periods = [];
  for (let i = 0; i < SignalL4.length - 1; i++) periods.push(SignalL4[i + 1] - SignalL4[i]);
  const meanperiod = movingAverage(periods, 100);
  for (let i = 0; i < periods.length; i++) {
    if (periods[i] > (meanperiod[i] || periods[i]) * 1.5) {
      const a = SignalL4[i],
        b = SignalL4[i + 1];
      for (const n of NoiseL4) {
        if (n > a && n < b) {
          const Ds = Math.min(1, Math.max(0, (FL4[n] - NL4) / Math.max(eps, SL4 - NL4)));
          if (Ds > rescueThresh) SignalL5.push(n);
        }
      }
    }
  }
  SignalL5.sort((x, y) => x - y);
  const peaks0 = [];
  for (const p of SignalL5) {
    const base = clamp(p * M, 0, L - 1);
    const a = clamp(base - 2 * M, 0, L - 1),
      b = clamp(base + 2 * M, 0, L - 1);
    let eIdx = a,
      eBest = bandEnergyAt(a, w1, w2, w3, w4);
    for (let i = a; i <= b; i++) {
      const ev = bandEnergyAt(i, w1, w2, w3, w4);
      if (ev > eBest) {
        eBest = ev;
        eIdx = i;
      }
    }
    const posI = positiveMaximaIndex(data, eIdx - fineRad, eIdx + fineRad);
    if (posI !== -1) peaks0.push(posI);
  }
  let peaks = [...new Set(peaks0)].sort((a, b) => a - b);
  const refr = Math.round((refractoryMs / 1000) * fs);
  if (peaks.length > 1) {
    const keep = new Array(peaks.length).fill(true);
    for (let i = 0; i < peaks.length - 1; i++) {
      if (!keep[i]) continue;
      const j = i + 1;
      if (peaks[j] - peaks[i] < refr) {
        if (data[peaks[i]] < data[peaks[j]]) keep[i] = false;
        else keep[j] = false;
      }
    }
    peaks = peaks.filter((_, k) => keep[k]).sort((a, b) => a - b);
  }

  const dsVal = (p) => Math.min(1, Math.max(0, (FL4[p] - NL4) / Math.max(eps, SL4 - NL4)));
  const allDs = EventsL1.map(dsVal);
  let weakDs = otsuThreshold(allDs);
  weakDs = Math.max(weakDsMin, Math.min(weakDsMax, weakDs * 0.8));

  const ampsStrong = peaks.map((i) => data[i]);
  const medAmpStrong = median(ampsStrong) || 1;

  const slopesStrong = peaks.map((i) => slopeAround(data, i, fs));
  const slopeCut = slopeFrac * (median(slopesStrong) || 1);

  function localAmpBaseline(idx) {
    if (!peaks.length) return medAmpStrong;
    let lo = 0,
      hi = peaks.length - 1,
      pos = peaks.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (peaks[mid] >= idx) {
        pos = mid;
        hi = mid - 1;
      } else lo = mid + 1;
    }
    const K = 3;
    const from = Math.max(0, pos - K),
      to = Math.min(peaks.length - 1, pos + K);
    const neigh = [];
    for (let k = from; k <= to; k++) neigh.push(data[peaks[k]]);
    return median(neigh) || medAmpStrong;
  }

  const extra = [];
  for (const n of NoiseL4) {
    const base = clamp(n * M, 0, L - 1);
    const a = clamp(base - 2 * M, 0, L - 1),
      b = clamp(base + 2 * M, 0, L - 1);
    let eIdx = a,
      eBest = bandEnergyAt(a, w1, w2, w3, w4);
    for (let i = a; i <= b; i++) {
      const ev = bandEnergyAt(i, w1, w2, w3, w4);
      if (ev > eBest) {
        eBest = ev;
        eIdx = i;
      }
    }
    const posI = positiveMaximaIndex(data, eIdx - fineRad, eIdx + fineRad);
    if (posI === -1) continue;

    const Ds = dsVal(n);
    const dsOk = Ds >= weakDs;

    const baseAmp = localAmpBaseline(posI);
    const ampOk = data[posI] >= weakAmpFracDefault * baseAmp;

    const slopeOk = slopeAround(data, posI, fs) >= slopeCut;

    if (!(dsOk && ampOk && slopeOk)) continue;

    let nearest = Infinity;
    let lo = 0,
      hi = peaks.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const d = posI - peaks[mid];
      nearest = Math.min(nearest, Math.abs(d));
      if (d < 0) hi = mid - 1;
      else lo = mid + 1;
    }
    if (nearest >= Math.round(0.9 * refr)) extra.push(posI);
  }

  if (extra.length) {
    peaks = [...new Set(peaks.concat(extra))].sort((a, b) => a - b);
    if (peaks.length > 1) {
      const keep = new Array(peaks.length).fill(true);
      for (let i = 0; i < peaks.length - 1; i++) {
        if (!keep[i]) continue;
        const j = i + 1;
        if (peaks[j] - peaks[i] < refr) {
          if (data[peaks[i]] < data[peaks[j]]) keep[i] = false;
          else keep[j] = false;
        }
      }
      peaks = peaks.filter((_, k) => keep[k]);
    }
  }

  return peaks;
}
