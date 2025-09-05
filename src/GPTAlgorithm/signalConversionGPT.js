import {
  absMinus,
  absSlice,
  argmaxAbsInRange,
  argmaxInRange,
  centeredMovingAverage,
  clamp,
  designButterworthHP_SOS,
  designButterworthLP_SOS,
  diff1Central,
  diff5Symmetric,
  ensureOdd,
  filtfiltBiquad,
  makeSampleView,
  mapAbsMinus,
  mean,
  msToSamples,
  positiveProminence,
  preSlopeMag,
  quantile,
  reflectPad,
  rrBufPush,
  rrMedian,
  sidedSlopeCheck,
  snapToHillZeroCross,
  sortUniqueInt32,
  stdDev,
  toFloat32,
  toInt32Array,
} from './utils';

export function removeBaseline(ecg, fs, opts = {}) {
  const method = opts.method || 'hp';
  const x = toFloat32(ecg);
  if (x.length < 4) {
    return opts.returnBaseline
      ? { signal: x.slice(), baseline: new Float32Array(x.length) }
      : x.slice();
  }
  if (method === 'median') {
    const win1 = ensureOdd(
      Math.max(3, Math.round(opts.win1Ms ? (opts.win1Ms * fs) / 1000 : 0.2 * fs)),
    );
    const win2 = ensureOdd(
      Math.max(3, Math.round(opts.win2Ms ? (opts.win2Ms * fs) / 1000 : 0.6 * fs)),
    );
    const base1 = centeredSlidingMedian(x, win1);
    const base2 = centeredSlidingMedian(base1, win2);
    const y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) y[i] = x[i] - base2[i];
    return opts.returnBaseline ? { signal: y, baseline: base2 } : y;
  }
  const fc = opts.hpHz != null ? opts.hpHz : 0.7;
  const order = opts.order === 2 ? 2 : 4;
  const sos = designButterworthHP_SOS(fc, fs, order);
  const y = filtfiltBiquad(x, sos);
  if (opts.returnBaseline) {
    const base = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) base[i] = x[i] - y[i];
    return { signal: y, baseline: base };
  }
  return y;
}

function centeredSlidingMedian(x, W) {
  if (W < 3) return x.slice();
  W = ensureOdd(W);
  const L = (W - 1) >> 1;
  const xp = reflectPad(x, L);
  const med = slidingMedianCausal(xp, W);
  return med.subarray(0, x.length).slice();
}

function slidingMedianCausal(arr, W) {
  W = ensureOdd(W);
  const nOut = arr.length - W + 1;
  if (nOut <= 0) return new Float32Array(0);
  function Heap(cmp) {
    this.cmp = cmp;
    this.a = [];
  }
  Heap.prototype.size = function () {
    return this.a.length;
  };
  Heap.prototype.peek = function () {
    return this.a[0];
  };
  Heap.prototype.push = function (v) {
    const a = this.a;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.cmp(a[i], a[p])) break;
      const t = a[i];
      a[i] = a[p];
      a[p] = t;
      i = p;
    }
  };
  Heap.prototype.pop = function () {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      while (true) {
        let l = 2 * i + 1,
          r = l + 1,
          m = i;
        if (l < a.length && this.cmp(a[l], a[m])) m = l;
        if (r < a.length && this.cmp(a[r], a[m])) m = r;
        if (m === i) break;
        const t = a[i];
        a[i] = a[m];
        a[m] = t;
        i = m;
      }
    }
    return top;
  };
  const lower = new Heap((x, y) => x.val > y.val || (x.val === y.val && x.idx > y.idx));
  const upper = new Heap((x, y) => x.val < y.val || (x.val === y.val && x.idx < y.idx));
  const delayed = new Map();
  let loSize = 0,
    hiSize = 0;
  function prune(heap) {
    while (heap.size()) {
      const top = heap.peek();
      const cnt = delayed.get(top.idx);
      if (!cnt) break;
      if (cnt === 1) delayed.delete(top.idx);
      else delayed.set(top.idx, cnt - 1);
      heap.pop();
    }
  }
  function rebalance() {
    if (loSize > hiSize + 1) {
      prune(lower);
      upper.push(lower.pop());
      loSize--;
      hiSize++;
      prune(lower);
    } else if (loSize < hiSize) {
      prune(upper);
      lower.push(upper.pop());
      loSize++;
      hiSize--;
      prune(upper);
    }
  }
  function add(val, idx) {
    if (!lower.size() || val <= lower.peek().val) {
      lower.push({ val, idx });
      loSize++;
    } else {
      upper.push({ val, idx });
      hiSize++;
    }
    rebalance();
  }
  function remove(val, idx) {
    delayed.set(idx, (delayed.get(idx) || 0) + 1);
    if (lower.size() && val <= lower.peek().val) loSize--;
    else hiSize--;
    prune(lower);
    prune(upper);
    rebalance();
  }
  const out = new Float32Array(nOut);
  for (let i = 0; i < W; i++) add(arr[i], i);
  prune(lower);
  out[0] = lower.peek().val;
  for (let i = W; i < arr.length; i++) {
    add(arr[i], i);
    const outIdx = i - W;
    remove(arr[outIdx], outIdx);
    prune(lower);
    out[i - W + 1] = lower.peek().val;
  }
  return out;
}

export function bandpassQRS(ecg, fs, opts = {}) {
  const hp = opts.hp != null ? opts.hp : 8;
  const lp = opts.lp != null ? opts.lp : 40;
  const orderHP = opts.orderHP === 2 ? 2 : 4;
  const orderLP = opts.orderLP === 2 ? 2 : 4;
  const x = toFloat32(ecg);
  if (x.length < 4) return x.slice();
  const sosHP = designButterworthHP_SOS(hp, fs, orderHP);
  const sosLP = designButterworthLP_SOS(lp, fs, orderLP);
  const sos = sosHP.concat(sosLP);
  return filtfiltBiquad(x, sos);
}

export function robustNormalize(ecg, opts = {}) {
  const x = toFloat32(ecg);
  const N = x.length;
  if (!N)
    return opts.returnStats ? { signal: new Float32Array(0), stats: {} } : new Float32Array(0);
  const centerMode = opts.center || 'median';
  const scaleMode = opts.scale || 'mad';
  const maxSample = opts.maxSample != null ? opts.maxSample : 200000;
  const sample = makeSampleView(x, maxSample);
  const center = centerMode === 'mean' ? mean(sample) : quantile(sample, 0.5);
  let scale,
    stats = { centerMode, scaleMode, center };
  if (scaleMode === 'none') scale = 1.0;
  else if (scaleMode === 'std') scale = stdDev(sample, center);
  else if (scaleMode === 'iqr') {
    const q1 = quantile(sample, 0.25),
      q3 = quantile(sample, 0.75);
    stats.q1 = q1;
    stats.q3 = q3;
    scale = Math.max(1e-12, (q3 - q1) / 1.349);
  } else if (scaleMode === 'p95') {
    const p95 = quantile(mapAbsMinus(sample, center), 0.95);
    stats.p95abs = p95;
    scale = Math.max(1e-12, p95);
  } else {
    const mad = quantile(mapAbsMinus(sample, center), 0.5);
    stats.mad = mad;
    scale = Math.max(1e-12, mad * 1.4826);
  }
  const invS = 1.0 / (scale || 1.0);
  const y = new Float32Array(N);
  if (opts.clipNsigma != null && isFinite(opts.clipNsigma)) {
    const C = Math.abs(opts.clipNsigma);
    for (let i = 0; i < N; i++) {
      let v = (x[i] - center) * invS;
      if (v > C) v = C;
      if (v < -C) v = -C;
      y[i] = v;
    }
    stats.clipNsigma = C;
  } else for (let i = 0; i < N; i++) y[i] = (x[i] - center) * invS;
  stats.scale = scale;
  return opts.returnStats ? { signal: y, stats } : y;
}

export function ptFeature(xIn, fs, opts = {}) {
  const x = toFloat32(xIn);
  const N = x.length;
  if (!N) return new Float32Array(0);
  const deriv = opts.deriv || 'diff5';
  const d = deriv === 'diff1' ? diff1Central(x) : diff5Symmetric(x);
  for (let i = 0; i < N; i++) d[i] = d[i] * d[i];
  const W = ensureOdd(
    Math.max(3, Math.round(((opts.mwiMs != null ? opts.mwiMs : 150) * fs) / 1000)),
  );
  return centeredMovingAverage(d, W);
}

export function adaptivePeakPick(wIn, fs, opts = {}) {
  const w = toFloat32(wIn);
  const N = w.length;
  if (N < 3) return new Int32Array(0);
  const refrSamp = msToSamples(fs, opts.refractoryMs != null ? opts.refractoryMs : 200);
  const initLen = Math.min(
    N,
    Math.max(1, Math.round((opts.initWinSec != null ? opts.initWinSec : 2.0) * fs)),
  );
  const alpha = opts.thrAlpha != null ? opts.thrAlpha : 0.25;
  const sbFactor = opts.searchBackFactor != null ? opts.searchBackFactor : 1.66;
  const initSeg = w.subarray(0, initLen);
  let NPKI = quantile(initSeg, 0.2);
  let SPKI = quantile(initSeg, 0.9);
  let THR = NPKI + alpha * (SPKI - NPKI);
  const peaks = [],
    peakVals = [];
  let lastR = -1;
  let subMaxIdx = -1,
    subMaxVal = -Infinity;
  const rrBuf = [];
  for (let i = 1; i < N - 1; i++) {
    if (!(w[i] > w[i - 1] && w[i] >= w[i + 1])) continue;
    const pIdx = i,
      pVal = w[i];
    if (peaks.length) {
      const rr = pIdx - lastR,
        rrMed = rrMedian(rrBuf);
      if (rrMed > 0 && rr > Math.round(sbFactor * rrMed)) {
        if (subMaxIdx > lastR + refrSamp) {
          peaks.push(subMaxIdx);
          peakVals.push(subMaxVal);
          rrBufPush(rrBuf, subMaxIdx - lastR);
          lastR = subMaxIdx;
          SPKI = 0.125 * subMaxVal + 0.875 * SPKI;
          THR = NPKI + alpha * (SPKI - NPKI);
          subMaxIdx = -1;
          subMaxVal = -Infinity;
        }
      }
    }
    if (pVal > THR) {
      if (lastR >= 0 && pIdx - lastR <= refrSamp) {
        if (pVal > peakVals[peakVals.length - 1]) {
          peaks[peaks.length - 1] = pIdx;
          peakVals[peakVals.length - 1] = pVal;
          lastR = pIdx;
        }
      } else {
        peaks.push(pIdx);
        peakVals.push(pVal);
        if (lastR >= 0) rrBufPush(rrBuf, pIdx - lastR);
        lastR = pIdx;
      }
      SPKI = 0.125 * pVal + 0.875 * SPKI;
      THR = NPKI + alpha * (SPKI - NPKI);
      subMaxIdx = -1;
      subMaxVal = -Infinity;
    } else {
      NPKI = 0.125 * pVal + 0.875 * NPKI;
      THR = NPKI + alpha * (SPKI - NPKI);
      if (pVal > subMaxVal) {
        subMaxVal = pVal;
        subMaxIdx = pIdx;
      }
    }
  }
  return Int32Array.from(peaks);
}

export function refineOnRaw(xRaw, candIdx, fs, opts = {}) {
  const x = toFloat32(xRaw);
  const N = x.length;
  const idxIn = toInt32Array(candIdx);
  const HALF = msToSamples(fs, opts.winMs != null ? opts.winMs : 75);
  const MICRO = Math.max(1, opts.microWin != null ? opts.microWin : 3);
  const PRE = msToSamples(fs, 40);
  const POST = msToSamples(fs, 40);
  const MADW = Math.max(21, msToSamples(fs, 200) | 1);
  const ZC_WIN = Math.max(2, msToSamples(fs, 12));
  const hasBP = opts.xBandpass && opts.xBandpass.length === N;
  const ref = hasBP ? opts.xBandpass : x;
  const out = [];
  for (let k = 0; k < idxIn.length; k++) {
    const c = clamp(idxIn[k], 0, N - 1);
    const L = Math.max(0, c - HALF),
      R = Math.min(N - 1, c + HALF);
    const rough = argmaxInRange(ref, L, R, c);
    const l2 = Math.max(L, rough - MICRO),
      r2 = Math.min(R, rough + MICRO);
    let i = argmaxInRange(x, l2, r2, rough);
    i = snapToHillZeroCross(ref, i, ZC_WIN);
    if (i < 1 || i > N - 2) continue;
    if (!positiveProminence(x, i, MADW)) continue;
    if (!sidedSlopeCheck(ref, i, PRE, POST)) continue;
    out.push(i);
  }
  return Int32Array.from(out);
}

export function rrPostprocess(xRef, rIdxIn, fs, opts = {}) {
  const x = xRef instanceof Float32Array ? xRef : Float32Array.from(xRef);
  let r = sortUniqueInt32(rIdxIn);
  const N = x.length;
  if (!r.length) return r;
  const feat = opts.feat && opts.feat.length === N ? opts.feat : null;
  const refr = msToSamples(fs, opts.refractoryMs != null ? opts.refractoryMs : 200);
  const minRR = msToSamples(fs, opts.minRRMs != null ? opts.minRRMs : 240);
  const tWin = msToSamples(fs, opts.tSuppressMs != null ? opts.tSuppressMs : 200);
  const preW = msToSamples(fs, opts.preSlopeMs != null ? opts.preSlopeMs : 40);
  const frac = opts.tSlopeFrac != null ? opts.tSlopeFrac : 0.4;
  const sbF = opts.sbFactor != null ? opts.sbFactor : 1.5;
  const sbK = opts.sbK != null ? opts.sbK : 3.0;

  {
    const kept = [];
    const base = feat || x;
    let last = r[0];
    for (let i = 1; i < r.length; i++) {
      const cur = r[i];
      if (cur - last < minRR) last = base[last] >= base[cur] ? last : cur;
      else {
        kept.push(last);
        last = cur;
      }
    }
    kept.push(last);
    r = Int32Array.from(kept);
  }
  if (r.length <= 1) return r;

  {
    const kept = [r[0]];
    for (let i = 1; i < r.length; i++) {
      const prev = kept[kept.length - 1],
        cur = r[i];
      if (cur - prev <= tWin) {
        const sPrev = preSlopeMag(x, prev, preW),
          sCur = preSlopeMag(x, cur, preW);
        if (sCur < frac * sPrev) continue;
      }
      kept.push(cur);
    }
    r = Int32Array.from(kept);
  }
  if (r.length <= 1) return r;

  {
    const base = feat || x;
    const out = [r[0]];
    const rrBuf = [];
    for (let i = 1; i < r.length; i++) {
      const prev = out[out.length - 1],
        cur = r[i],
        rr = cur - prev;
      const rrMed = rrMedian(rrBuf),
        needSB = rrMed > 0 && rr > Math.round(sbF * rrMed);
      if (needSB) {
        const L = Math.max(prev + refr, prev + 1),
          R = Math.min(cur - refr, cur - 1);
        if (R > L + 2) {
          const mid = (L + R) >> 1;
          let ins = argmaxInRange(base, L, R, mid);
          ins = snapToHillZeroCross(base, ins, Math.max(2, msToSamples(fs, 12)));
          if (positiveProminence(base, ins, Math.max(21, msToSamples(fs, 200) | 1))) {
            const seg = base.subarray ? base.subarray(L, R + 1) : base.slice(L, R + 1);
            const med = quantile(seg, 0.5);
            const mad = quantile(absMinus(seg, med), 0.5);
            const thr = med + sbK * (mad || 0);
            if (base[ins] > thr) {
              out.push(ins);
              rrBufPush(rrBuf, ins - prev);
              rrBufPush(rrBuf, cur - ins);
              out.push(cur);
              continue;
            }
          }
        }
      }
      rrBufPush(rrBuf, rr);
      out.push(cur);
    }
    r = sortUniqueInt32(out);
  }
  return r;
}

export function tkeoFeature(xIn, fs, opts = {}) {
  const x = toFloat32(xIn);
  const N = x.length;
  if (!N) return new Float32Array(0);
  const xp = reflectPad(x, 1);
  const u = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const a = xp[n + 1],
      prev = xp[n],
      next = xp[n + 2];
    u[n] = Math.abs(a * a - prev * next);
  }
  const W = ensureOdd(
    Math.max(3, Math.round(((opts.winMs != null ? opts.winMs : 120) * fs) / 1000)),
  );
  return centeredMovingAverage(u, W);
}

export function tkeoCandidatePeaks(xIn, fs, opts = {}) {
  const s = tkeoFeature(xIn, fs, { winMs: opts.winMs });
  const sample = makeSampleView(s, opts.maxSample != null ? opts.maxSample : 200000);
  const med = quantile(sample, 0.5);
  const mad = quantile(mapAbsMinus(sample, med), 0.5);
  const thr = med + (opts.k != null ? opts.k : 4.0) * (mad || 0);
  const N = s.length,
    refr = msToSamples(fs, opts.refractoryMs != null ? opts.refractoryMs : 200);
  const peaks = [],
    peakVals = [];
  let last = -1;
  for (let i = 1; i < N - 1; i++) {
    if (!(s[i] > s[i - 1] && s[i] >= s[i + 1])) continue;
    if (s[i] < thr) continue;
    if (last >= 0 && i - last <= refr) {
      if (s[i] > peakVals[peakVals.length - 1]) {
        peaks[peaks.length - 1] = i;
        peakVals[peakVals.length - 1] = s[i];
        last = i;
      }
    } else {
      peaks.push(i);
      peakVals.push(s[i]);
      last = i;
    }
  }
  const idx = Int32Array.from(peaks);
  return opts.returnFeature ? { indices: idx, feature: s, thr } : idx;
}

export function fuseCandidates(lists, fs, opts = {}) {
  const tol = msToSamples(fs, opts.mergeTolMs != null ? opts.mergeTolMs : 100);
  const feats = Array.isArray(opts.feats) ? opts.feats : null;
  const xRef = opts.xRef || null;
  const all = [];
  for (let s = 0; s < lists.length; s++) {
    const arr = sortUniqueInt32(lists[s] || []);
    for (let k = 0; k < arr.length; k++) {
      const idx = arr[k];
      const score =
        feats && feats[s] && feats[s].length > idx
          ? Math.abs(feats[s][idx])
          : xRef && xRef.length > idx
          ? Math.abs(xRef[idx])
          : 0;
      all.push({ idx, src: s, score });
    }
  }
  if (!all.length)
    return opts.returnMeta ? { indices: new Int32Array(0), meta: [] } : new Int32Array(0);
  all.sort((a, b) => a.idx - b.idx);
  const out = [],
    meta = [];
  let group = [all[0]];
  for (let i = 1; i < all.length; i++) {
    const prev = group[group.length - 1],
      cur = all[i];
    if (cur.idx - prev.idx <= tol) group.push(cur);
    else {
      flushGroup(group, out, meta);
      group = [cur];
    }
  }
  flushGroup(group, out, meta);
  const indices = Int32Array.from(out);
  return opts.returnMeta ? { indices, meta } : indices;

  function flushGroup(g, out, meta) {
    if (!g || !g.length) return;
    let best = g[0];
    for (let j = 1; j < g.length; j++) if (g[j].score > best.score) best = g[j];
    out.push(best.idx);
    if (opts.returnMeta) {
      const sources = new Set();
      for (const e of g) sources.add(e.src);
      meta.push({
        i: best.idx,
        votes: Array.from(sources).length,
        sources: Array.from(sources).sort((a, b) => a - b),
      });
    }
  }
}

export function scoreConfidence(rIdxIn, ctx, fs, opts = {}) {
  const r = sortUniqueInt32(rIdxIn);
  const M = r.length;
  const xRef = toFloat32(ctx.xRef || []);
  const wPT = ctx.wPT ? toFloat32(ctx.wPT) : null;
  const sTK = ctx.sTKEO ? toFloat32(ctx.sTKEO) : null;
  const meta = Array.isArray(ctx.meta) ? ctx.meta : null;
  const N = xRef.length;
  if (!M) return [];
  const featWin = msToSamples(fs, opts.featWinMs != null ? opts.featWinMs : 800);
  const ampWin = msToSamples(fs, opts.ampWinMs != null ? opts.ampWinMs : 800);
  const voteTol = msToSamples(fs, opts.voteTolMs != null ? opts.voteTolMs : 60);
  const kVote = opts.kVote != null ? opts.kVote : 3.0;
  const W = Object.assign({ energy: 0.5, votes: 0.25, rr: 0.25 }, opts.weights || {});
  const wsum = Math.max(1e-12, W.energy + W.votes + W.rr);
  W.energy /= wsum;
  W.votes /= wsum;
  W.rr /= wsum;
  const Z = Object.assign({ z0: 2.0, zMax: 8.0, tauRR: 1.0 }, opts.z || {});
  const eps = 1e-12;

  const rr = [];
  for (let i = 1; i < M; i++) rr.push(r[i] - r[i - 1]);
  const rrArr = Float32Array.from(rr);
  const rrMed = rrArr.length ? quantile(rrArr, 0.5) : 0;
  const rrMAD = rrArr.length ? quantile(mapAbsMinus(rrArr, rrMed), 0.5) : 0;
  const rrMADs = rrMAD * 1.4826 || (10 * fs) / 1000;

  function clip01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function zToScoreLinear(z, z0, zMax) {
    return clip01((z - z0) / Math.max(1e-6, zMax - z0));
  }
  function devToScoreGaussian(zdev, tau) {
    return Math.exp(-0.5 * Math.pow(zdev / Math.max(1e-6, tau), 2));
  }
  function nearestMetaVotes(meta, idx, tolSamp) {
    if (!meta) return -1;
    let best = -1,
      bestD = tolSamp + 1;
    for (let j = 0; j < meta.length; j++) {
      const d = Math.abs((meta[j].i | 0) - idx);
      if (d <= tolSamp && d < bestD) {
        bestD = d;
        best = j;
      }
    }
    return best >= 0 ? Math.min(2, Math.max(0, meta[best].votes | 0)) : -1;
  }
  function localZAt(arr, idx, halfWin, useAbs) {
    if (!arr || !arr.length) return 0;
    const L = Math.max(0, idx - halfWin),
      R = Math.min(arr.length - 1, idx + halfWin);
    if (R <= L) return 0;
    const seg = useAbs
      ? absSlice(arr, L, R)
      : Float32Array.from(arr.subarray ? arr.subarray(L, R + 1) : arr.slice(L, R + 1));
    const med = quantile(seg, 0.5);
    const mad = quantile(mapAbsMinus(seg, med), 0.5) * 1.4826 || 1e-9;
    const val = useAbs ? Math.abs(arr[idx]) : arr[idx];
    return (val - med) / mad;
  }
  function voteFromFeat(feat, idx, halfWin, k) {
    if (!feat || !feat.length) return 0;
    const L = Math.max(0, idx - halfWin),
      R = Math.min(feat.length - 1, idx + halfWin);
    const j = argmaxAbsInRange(feat, L, R, idx);
    const seg = absSlice(feat, L, R);
    const med = quantile(seg, 0.5);
    const mad = quantile(mapAbsMinus(seg, med), 0.5);
    const thr = med + k * (mad || 0);
    return Math.abs(feat[j]) > thr ? 1 : 0;
  }

  const out = new Array(M);
  for (let k = 0; k < M; k++) {
    const idx = r[k];
    let ptScore = 0,
      tkScore = 0;
    const featHalf = Math.max(1, Math.floor(featWin / 2));
    if (wPT && wPT.length) {
      const j = argmaxAbsInRange(
        wPT,
        Math.max(0, idx - featHalf),
        Math.min(wPT.length - 1, idx + featHalf),
        idx,
      );
      const z = localZAt(wPT, j, featHalf, false);
      ptScore = zToScoreLinear(Math.abs(z), Z.z0, Z.zMax);
    }
    if (sTK && sTK.length) {
      const j = argmaxAbsInRange(
        sTK,
        Math.max(0, idx - featHalf),
        Math.min(sTK.length - 1, idx + featHalf),
        idx,
      );
      const z = localZAt(sTK, j, featHalf, false);
      tkScore = zToScoreLinear(Math.abs(z), Z.z0, Z.zMax);
    }
    const featScore = Math.max(ptScore, tkScore);
    const ampHalf = Math.max(1, Math.floor(ampWin / 2));
    const zAmp = localZAt(xRef, idx, ampHalf, true);
    const ampScore = zToScoreLinear(Math.abs(zAmp), Z.z0, Z.zMax);
    const energy = 0.7 * featScore + 0.3 * ampScore;

    let votes = -1;
    if (meta) {
      const v = nearestMetaVotes(meta, idx, voteTol);
      if (v >= 0) votes = v;
    }
    if (votes < 0) {
      const half = Math.max(1, Math.floor(msToSamples(fs, 60) / 2));
      let v = 0;
      if (wPT) v += voteFromFeat(wPT, idx, half, kVote);
      if (sTK) v += voteFromFeat(sTK, idx, half, kVote);
      votes = Math.min(2, v);
    }
    const voteScore = votes / 2;
    const rrPrev = k > 0 ? r[k] - r[k - 1] : NaN;
    const rrNext = k < M - 1 ? r[k + 1] - r[k] : NaN;
    const devPrev = isFinite(rrPrev) ? Math.abs(rrPrev - rrMed) / (rrMADs + eps) : Infinity;
    const devNext = isFinite(rrNext) ? Math.abs(rrNext - rrMed) / (rrMADs + eps) : Infinity;
    const devZ = Math.min(devPrev, devNext);
    const rrScore = isFinite(devZ) ? devToScoreGaussian(devZ, Z.tauRR) : 0.7;
    const conf = Math.max(0, Math.min(1, W.energy * energy + W.votes * voteScore + W.rr * rrScore));
    out[k] = {
      i: idx,
      tMs: (idx * 1000) / fs,
      conf,
      parts: { energy, votes: voteScore, rr: rrScore },
      votes,
    };
  }
  return out;
}

export function notch(ecg, fs, opts = {}) {
  const f0 = opts.f0 != null ? opts.f0 : 50;
  const Q = opts.Q != null ? opts.Q : 30;
  const order = opts.order === 4 ? 4 : 2;
  if (!(fs > 0)) throw new Error('notch: fs must be > 0');
  if (!(f0 > 0 && f0 < fs * 0.5)) throw new Error('notch: f0 must be in (0, Nyquist)');
  const x = toFloat32(ecg);
  if (x.length < 4) return x.slice();
  const sos = designNotch_SOS(f0, fs, Q, order);
  return filtfiltBiquad(x, sos);
}

function designNotchBiquad(f0, fs, Q) {
  const w0 = (2 * Math.PI * f0) / fs,
    cosw0 = Math.cos(w0),
    sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * Q);
  let b0 = 1,
    b1 = -2 * cosw0,
    b2 = 1,
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
function designNotch_SOS(f0, fs, Q, order) {
  if (order === 4) return [designNotchBiquad(f0, fs, Q), designNotchBiquad(f0, fs, Q)];
  return [designNotchBiquad(f0, fs, Q)];
}

export function keepHillsOnlyV2(xRefIn, rIdxIn, fs) {
  const LOCAL_MS = 8,
    PRE_MS = 40,
    POST_MS = 40,
    DER_MS = 12,
    MAD_MS = 200;
  const RISE_RATIO = 0.55,
    FALL_RATIO = 0.55,
    PROM_FLOOR = 0.03,
    PROM_KMAD = 1.5;
  const x = toFloat32(xRefIn);
  const idx = sortUniqueInt32(rIdxIn);
  const N = x.length;
  if (!N || !idx.length) return new Int32Array(0);
  const Wloc = Math.max(1, msToSamples(fs, LOCAL_MS));
  const Lpre = Math.max(1, msToSamples(fs, PRE_MS));
  const Rpost = Math.max(1, msToSamples(fs, POST_MS));
  const Wder = Math.max(3, ensureOdd(msToSamples(fs, DER_MS)));
  const Wmad = Math.max(21, ensureOdd(msToSamples(fs, MAD_MS)));
  const d = smoothDiff(x, Wder);
  const out = [];
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k] | 0;
    if (i <= 0 || i >= N - 1) continue;
    const Lm = Math.max(0, i - Wloc),
      Rm = Math.min(N - 1, i + Wloc);
    if (!isLocalMax(x, i, Lm, Rm)) continue;
    const Ll = Math.max(1, i - Lpre),
      Rr = Math.min(N - 1, i + Rpost);
    let upPos = 0,
      upTot = 0;
    for (let j = Ll; j <= i; j++) {
      const dj = d[j];
      if (dj !== 0) {
        upTot++;
        if (dj > 0) upPos++;
      }
    }
    let dnNeg = 0,
      dnTot = 0;
    for (let j = i + 1; j <= Rr; j++) {
      const dj = d[j];
      if (dj !== 0) {
        dnTot++;
        if (dj < 0) dnNeg++;
      }
    }
    const fracUp = upTot ? upPos / upTot : 0,
      fracDn = dnTot ? dnNeg / dnTot : 0;
    if (fracUp < RISE_RATIO || fracDn < FALL_RATIO) continue;
    const Lm2 = Math.max(0, i - ((Wmad - 1) >> 1)),
      Rm2 = Math.min(N - 1, i + ((Wmad - 1) >> 1));
    const seg = x.subarray ? x.subarray(Lm2, Rm2 + 1) : x.slice(Lm2, Rm2 + 1);
    const med = quantile(seg, 0.5);
    const mad = quantile(absMinus(seg, med), 0.5);
    const promThr = Math.max(PROM_FLOOR, PROM_KMAD * (mad || 0));
    const mid = i - Lm2;
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
    if (x[i] - base < promThr) continue;
    out.push(i);
  }
  return Int32Array.from(out);

  function isLocalMax(arr, i, L, R) {
    const v = arr[i];
    for (let j = L; j <= R; j++) if (arr[j] > v) return false;
    return true;
  }
  function smoothDiff(x, W) {
    const N = x.length,
      L = (W - 1) >> 1,
      xp = reflectPad(x, L),
      out = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const i = n + L;
      let s = 0;
      for (let k = 1; k <= L; k++) s += xp[i + k] - xp[i - k];
      out[n] = s / W;
    }
    return out;
  }
}
