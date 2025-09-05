const MIN_DIST_SEC = 0.1;
const SEARCH_WIN_SEC = 0.15;
const T_WAVE_SLOPE_RATIO = 0.9;
const RESCUE_SCALE = 0.5;
const GAPFILL_LONG_SEC = 0.9;
const GAPFILL_RR_FACTOR = 0.95;
const GAPFILL_LOW_SCALE = 0.1;
const DEDUP_SEC = 0.18;

const MICRO_R_ENABLE = true;
const MICRO_R_LO_SEC = 0.28;
const MICRO_R_HI_SEC = 0.52;
const MICRO_R_PROM_FRAC = 0.25;
const MICRO_R_MIN_POS_FRAC = 0.15;
const MICRO_R_SIDE_SEC = 0.06;

function mean(a) {
  if (!a.length) return 0;
  let s = 0;
  for (const v of a) s += v;
  return s / a.length;
}
function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function maxAbs(a) {
  let m = 0;
  for (const v of a) {
    const u = Math.abs(v);
    if (u > m) m = u;
  }
  return m;
}
function zeros(n) {
  return new Array(n).fill(0);
}
function ones(n) {
  return new Array(n).fill(1);
}
function pyRound(x) {
  return Math.round(x);
}
function convolveFull(x, h) {
  const n = x.length,
    m = h.length,
    y = new Array(n + m - 1).fill(0);
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    for (let j = 0; j < m; j++) y[i + j] += xi * h[j];
  }
  return y;
}
function lfilter(b, a, x) {
  const y = new Array(x.length).fill(0);
  for (let n = 0; n < x.length; n++) {
    let acc = 0;
    for (let i = 0; i < b.length; i++) if (n - i >= 0) acc += b[i] * x[n - i];
    for (let j = 1; j < a.length; j++) if (n - j >= 0) acc -= a[j] * y[n - j];
    y[n] = acc / a[0];
  }
  return y;
}
function filtfilt(b, a, x, padlen = null) {
  const edge = Math.max(b.length, a.length) - 1;
  const pl = padlen == null ? 3 * edge : padlen;
  const n = x.length;
  const left = new Array(pl),
    right = new Array(pl);
  for (let i = 0; i < pl; i++) {
    left[i] = 2 * x[0] - x[Math.min(pl - i, n - 1)];
    right[i] = 2 * x[n - 1] - x[Math.max(n - 2 - i, 0)];
  }
  const xp = left.concat(x, right);
  const y1 = lfilter(b, a, xp);
  const y2 = lfilter(b, a, y1.slice().reverse()).reverse();
  return y2.slice(pl, pl + n);
}
function flattop(M) {
  const a0 = 1.0,
    a1 = 1.93,
    a2 = 1.29,
    a3 = 0.388,
    a4 = 0.028;
  const w = new Array(M),
    N = M - 1;
  for (let n = 0; n < M; n++) {
    const p = (2 * Math.PI * n) / N;
    w[n] =
      a0 - a1 * Math.cos(p) + a2 * Math.cos(2 * p) - a3 * Math.cos(3 * p) + a4 * Math.cos(4 * p);
  }
  return w;
}
function smoother({ signal, kernel = 'flattop', size = 10, mirror = true }) {
  if (!signal) throw new TypeError('signal required');
  if (size > signal.length) size = signal.length - 1;
  if (size < 1) size = 1;
  if (kernel !== 'flattop') throw new Error('only flattop');
  const win = flattop(size);
  const sumw = win.reduce((a, b) => a + b, 0),
    w = win.map((v) => v / sumw);
  const left = mirror ? new Array(size).fill(signal[0]) : [];
  const right = mirror ? new Array(size).fill(signal[signal.length - 1]) : [];
  const src = left.concat(signal, right);
  const y = convolveFull(src, w);
  return mirror
    ? y.slice(size, size + signal.length)
    : y.slice(Math.floor((w.length - 1) / 2), Math.floor((w.length - 1) / 2) + signal.length);
}
function peakIndexes(y, thres = 0, min_dist = 1) {
  if (!y.length) return [];
  const ymin = Math.min(...y),
    ymax = Math.max(...y);
  const absThres = ymin + thres * (ymax - ymin);
  const cand = [];
  for (let i = 1; i < y.length - 1; i++) {
    if (y[i] > absThres && y[i] > y[i - 1] && y[i] > y[i + 1]) cand.push(i);
  }
  if (!cand.length) return [];
  cand.sort((i, j) => y[j] - y[i]);
  const taken = [],
    bad = new Array(y.length).fill(false);
  for (const idx of cand) {
    if (bad[idx]) continue;
    taken.push(idx);
    const s = Math.max(0, idx - min_dist),
      e = Math.min(y.length - 1, idx + min_dist);
    for (let k = s; k <= e; k++) bad[k] = true;
  }
  return taken.sort((a, b) => a - b);
}
function argmaxRange(x, s, e) {
  s = Math.max(0, s);
  e = Math.min(e, x.length);
  if (e <= s) return { idx: -1, val: -Infinity };
  let im = s,
    vm = x[s];
  for (let i = s + 1; i < e; i++)
    if (x[i] > vm) {
      vm = x[i];
      im = i;
    }
  return { idx: im, val: vm };
}
function dedupPeaks(idxs, minDist) {
  if (!idxs.length) return [];
  const out = [idxs[0]];
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i] - out[out.length - 1] >= minDist) out.push(idxs[i]);
    else if (i + 1 < idxs.length && idxs[i + 1] - out[out.length - 1] >= minDist) continue;
  }
  return out;
}

function isUphillPeak(sig, idx, pre = 4, post = 4) {
  const i0 = Math.max(0, idx - pre),
    i1 = Math.min(sig.length - 1, idx + post);
  if (i1 - i0 < 3) return true;
  const left = sig[idx] - sig[i0];
  const right = sig[i1] - sig[idx];
  return left > 0 && right < 0;
}

function localProminence(sig, idx, side) {
  const L = Math.max(0, idx - side);
  const R = Math.min(sig.length - 1, idx + side);
  let minLeft = +Infinity,
    minRight = +Infinity;
  for (let i = L; i <= idx; i++) if (sig[i] < minLeft) minLeft = sig[i];
  for (let i = idx; i <= R; i++) if (sig[i] < minRight) minRight = sig[i];
  const base = Math.max(minLeft, minRight);
  return sig[idx] - base;
}

function sinc(x) {
  return x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
}
function hamming(N) {
  const w = new Array(N);
  for (let n = 0; n < N; n++) w[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
  return w;
}

function designFIRLowpass(numTaps, fc, fs) {
  const M = numTaps - 1,
    w = hamming(numTaps),
    h = new Array(numTaps);
  const norm = (2 * fc) / fs;
  for (let n = 0; n < numTaps; n++) {
    const m = n - M / 2;
    h[n] = norm * sinc(norm * m) * w[n];
  }
  const sum = h.reduce((a, b) => a + b, 0);
  for (let n = 0; n < numTaps; n++) h[n] /= sum;
  return h;
}
function firFilterSame(x, h) {
  const y = convolveFull(x, h);
  const off = Math.floor(h.length / 2);
  return y.slice(off, off + x.length);
}
function downsample400to200(x) {
  const h = designFIRLowpass(129, 80, 400);
  const y = filtfilt(h, [1], x, 3 * (h.length - 1));
  const z = new Array(Math.floor(y.length / 2));
  for (let k = 0; k < z.length; k++) z[k] = y[2 * k];
  return z;
}

const BUTTER_200_LOW_12HZ = {
  b: [0.00475052, 0.01425157, 0.01425157, 0.00475052],
  a: [1.0, -2.25008508, 1.75640138, -0.46831211],
};
const BUTTER_200_HIGH_5HZ = {
  b: [0.85449723, -2.56349169, 2.56349169, -0.85449723],
  a: [1.0, -2.6861574, 2.41965511, -0.73016535],
};

function rpeak_detection_200_pos(ecg, fs) {
  const ecg0 = ecg.map((v) => v - mean(ecg));
  let ecg_l = filtfilt(BUTTER_200_LOW_12HZ.b, BUTTER_200_LOW_12HZ.a, ecg0);
  const m1 = maxAbs(ecg_l);
  if (m1 > 0) ecg_l = ecg_l.map((v) => v / m1);
  let ecg_h = filtfilt(
    BUTTER_200_HIGH_5HZ.b,
    BUTTER_200_HIGH_5HZ.a,
    ecg_l,
    3 * (Math.max(BUTTER_200_HIGH_5HZ.b.length, BUTTER_200_HIGH_5HZ.a.length) - 1),
  );
  const m2 = maxAbs(ecg_h);
  if (m2 > 0) ecg_h = ecg_h.map((v) => v / m2);
  const b_diff = [1, 2, 0, -2, -1].map((v) => (v * fs) / 8);
  const pad =
    3 * (Math.max(BUTTER_200_HIGH_5HZ.b.length, BUTTER_200_HIGH_5HZ.a.length, b_diff.length) - 1);
  let ecg_d = filtfilt(b_diff, [1.0], ecg_h, pad);
  const md = maxAbs(ecg_d);
  if (md > 0) ecg_d = ecg_d.map((v) => v / md);

  let ecg_s = ecg_d.map((v) => v * v);
  const sm_size = pyRound(0.06 * fs);
  ecg_s = smoother({ signal: ecg_s, kernel: 'flattop', size: sm_size, mirror: true });

  const winLen = pyRound(0.15 * fs);
  const ecg_m = convolveFull(
    ecg_s,
    ones(winLen).map((v) => v / winLen),
  );

  const locs = peakIndexes(ecg_m, 0, pyRound(MIN_DIST_SEC * fs));
  const pks = locs.map((i) => ecg_m[i]);
  const LLp = pks.length;

  let qrs_c = zeros(LLp),
    qrs_i = zeros(LLp),
    qrs_i_raw = zeros(LLp);
  const twoSec = 2 * fs + 1;
  let THR_SIG = Math.max(...ecg_m.slice(0, Math.min(twoSec, ecg_m.length))) * (1 / 3);
  let THR_NOISE = mean(ecg_m.slice(0, Math.min(twoSec, ecg_m.length))) * (1 / 2);
  let SIG_LEV = THR_SIG,
    NOISE_LEV = THR_NOISE;

  let THR_SIG1 = Math.max(...ecg_h.slice(0, Math.min(twoSec, ecg_h.length))) * (1 / 3);
  let THR_NOISE1 = mean(ecg_h.slice(0, Math.min(twoSec, ecg_h.length))) * (1 / 2);
  let SIG_LEV1 = THR_SIG1,
    NOISE_LEV1 = THR_NOISE1;

  let Beat_C = 0,
    Beat_C1 = 0,
    mean_RR = 0,
    m_selected_RR = 0,
    Check_Flag = 0,
    skip = 0;

  for (let i = 0; i < LLp; i++) {
    const half = Math.round(SEARCH_WIN_SEC * fs);
    const s = Math.max(0, locs[i] - half);
    const e = Math.min(ecg_h.length, locs[i] + half + 1);
    const locH = argmaxRange(ecg_h, s, e);
    let x_i_abs = locH.idx,
      y_i = locH.val;
    if (Beat_C >= 9) {
      const diffs = [];
      for (let k = Beat_C - 9; k < Beat_C - 1; k++) diffs.push(qrs_i[k + 1] - qrs_i[k]);
      mean_RR = mean(diffs);
      m_selected_RR = mean_RR;
    }
    const test_m = m_selected_RR || mean_RR || 0;
    let accepted = false;
    const acceptQRS = (locIdx, amp_m, absIdx_h, amp_h) => {
      if (amp_h <= 0) return;
      if (!isUphillPeak(ecg_h, absIdx_h, 4, 4)) return;
      Beat_C += 1;
      qrs_c[Beat_C - 1] = amp_m;
      qrs_i[Beat_C - 1] = locIdx;
      if (amp_h >= THR_SIG1) {
        Beat_C1 += 1;
        qrs_i_raw[Beat_C1 - 1] = absIdx_h;
        SIG_LEV1 = 0.125 * amp_h + 0.875 * SIG_LEV1;
      }
      SIG_LEV = 0.125 * amp_m + 0.875 * SIG_LEV;
      accepted = true;
    };

    if (pks[i] >= THR_SIG) {
      if (Beat_C >= 3) {
        if (test_m && locs[i] - qrs_i[Beat_C - 1] <= pyRound(0.5 * test_m)) Check_Flag = 1;
        if (locs[i] - qrs_i[Beat_C - 1] <= pyRound(0.36 * fs) || Check_Flag === 1) {
          const s1 = Math.max(0, locs[i] - pyRound(0.07 * fs));
          const seg1 = ecg_m.slice(s1, locs[i] + 1);
          const Slope1 = seg1.length > 1 ? mean(seg1.slice(1).map((v, k) => v - seg1[k])) : 0;

          const s2 = Math.max(0, qrs_i[Beat_C - 1] - pyRound(0.07 * fs) - 1);
          const seg2 = ecg_m.slice(s2, qrs_i[Beat_C - 1] + 1);
          const Slope2 = seg2.length > 1 ? mean(seg2.slice(1).map((v, k) => v - seg2[k])) : 0;

          if (Math.abs(Slope1) <= Math.abs(T_WAVE_SLOPE_RATIO * Slope2)) skip = 1;
          else skip = 0;
        }
      }
      if (skip === 0) acceptQRS(locs[i], pks[i], x_i_abs, y_i);
    }
    if (MICRO_R_ENABLE && !accepted) {
      const sinceLast = Beat_C > 0 ? locs[i] - qrs_i[Beat_C - 1] : Infinity;
      const inMicroWindow =
        sinceLast >= Math.round(MICRO_R_LO_SEC * fs) &&
        sinceLast <= Math.round(MICRO_R_HI_SEC * fs);

      if (inMicroWindow && y_i > 0) {
        const side = Math.round(MICRO_R_SIDE_SEC * fs);
        const prom = localProminence(ecg_h, x_i_abs, side);
        const promThr = Math.max(
          MICRO_R_PROM_FRAC * Math.max(1e-9, SIG_LEV1 - NOISE_LEV1),
          MICRO_R_MIN_POS_FRAC * Math.max(1e-9, SIG_LEV1),
        );

        if (prom > promThr && isUphillPeak(ecg_h, x_i_abs, 4, 4)) {
          acceptQRS(locs[i], pks[i], x_i_abs, y_i);
        }
      }
    }

    if (!accepted) {
      const sinceLast = Beat_C > 0 ? locs[i] - qrs_i[Beat_C - 1] : Infinity;
      const okShortRR = sinceLast >= pyRound(0.2 * fs) && sinceLast <= pyRound(0.6 * fs);
      if (pks[i] >= RESCUE_SCALE * THR_SIG && okShortRR && y_i >= RESCUE_SCALE * THR_SIG1) {
        acceptQRS(locs[i], pks[i], x_i_abs, y_i);
      }
    }
    if (MICRO_R_ENABLE && !accepted) {
      const sinceLast = Beat_C > 0 ? locs[i] - qrs_i[Beat_C - 1] : Infinity;
      const inMicroWindow =
        sinceLast >= Math.round(MICRO_R_LO_SEC * fs) &&
        sinceLast <= Math.round(MICRO_R_HI_SEC * fs);

      if (inMicroWindow && y_i > 0) {
        const side = Math.round(MICRO_R_SIDE_SEC * fs);
        const prom = localProminence(ecg_h, x_i_abs, side);
        const promThr = Math.max(
          MICRO_R_PROM_FRAC * Math.max(1e-9, SIG_LEV1 - NOISE_LEV1),
          MICRO_R_MIN_POS_FRAC * Math.max(1e-9, SIG_LEV1),
        );
        if (prom > promThr && isUphillPeak(ecg_h, x_i_abs, 4, 4)) {
          acceptQRS(locs[i], pks[i], x_i_abs, y_i);
        }
      }
    }

    if (!accepted) {
      NOISE_LEV1 = 0.125 * Math.max(0, y_i) + 0.875 * NOISE_LEV1;
      NOISE_LEV = 0.125 * pks[i] + 0.875 * NOISE_LEV;
    }
    if (NOISE_LEV !== 0 || SIG_LEV !== 0) {
      THR_SIG = NOISE_LEV + 0.25 * Math.abs(SIG_LEV - NOISE_LEV);
      THR_NOISE = 0.4 * THR_SIG;
    }
    if (NOISE_LEV1 !== 0 || SIG_LEV1 !== 0) {
      THR_SIG1 = NOISE_LEV1 + 0.25 * Math.abs(SIG_LEV1 - NOISE_LEV1);
      THR_NOISE1 = 0.4 * THR_SIG1;
    }
    skip = 0;
    Check_Flag = 0;
  }

  qrs_i_raw = qrs_i_raw.slice(
    0,
    qrs_i_raw.findLastIndex ? qrs_i_raw.findLastIndex(() => true) + 1 : qrs_i_raw.length,
  );
  (function gapFill() {
    let peaks = qrs_i_raw.slice();
    if (peaks.length < 2) {
      qrs_i_raw = peaks;
      return;
    }
    const rrs = [];
    for (let k = 1; k < peaks.length; k++) rrs.push(peaks[k] - peaks[k - 1]);
    let RRexp = median(rrs);
    if (!RRexp || !isFinite(RRexp)) RRexp = Math.round(0.8 * fs);

    const added = [];
    for (let k = 1; k < peaks.length; k++) {
      const prev = peaks[k - 1],
        next = peaks[k],
        gap = next - prev;
      if (gap > Math.max(GAPFILL_LONG_SEC * fs, GAPFILL_RR_FACTOR * RRexp)) {
        const sM = prev + Math.round(0.25 * gap),
          eM = prev + Math.round(0.75 * gap);
        const candM = argmaxRange(ecg_m, sM, eM);
        if (candM.idx >= 0) {
          const half = Math.round(SEARCH_WIN_SEC * fs);
          const locH = argmaxRange(ecg_h, candM.idx - half, candM.idx + half + 1);
          const ampM = candM.val,
            ampH = locH.val;
          const okM = ampM >= GAPFILL_LOW_SCALE * THR_SIG;
          const okH = ampH >= GAPFILL_LOW_SCALE * THR_SIG1;
          if (okM && okH && ampH > 0 && isUphillPeak(ecg_h, locH.idx, 4, 4)) added.push(locH.idx);
        }
      }
    }
    if (added.length) {
      peaks = peaks.concat(added).sort((a, b) => a - b);
      peaks = dedupPeaks(peaks, Math.round(DEDUP_SEC * fs));
    }
    qrs_i_raw = peaks;
  })();

  return qrs_i_raw.map((v) => Math.max(0, Math.min(ecg.length - 1, Math.round(v))));
}
class Pan_Tompkins_Plus_Plus_Plus {
  get_name() {
    return 'Pan_Tompkins_Plus_Plus_Plus';
  }

  rpeak_detection(ecg400, fs) {
    if (fs !== 400) throw new Error('Эта версия принимает только fs = 400 Гц.');
    if (!ecg400 || !ecg400.length) return [];

    const ecg200 = downsample400to200(ecg400);

    const r200 = rpeak_detection_200_pos(ecg200, 200);

    const refined = [];
    for (const i200 of r200) {
      const guess = i200 * 2;
      const win = 2;
      const s = Math.max(0, guess - win);
      const e = Math.min(ecg400.length, guess + win + 1);
      const loc = argmaxRange(ecg400, s, e);
      const idx =
        loc.idx >= 0 && loc.val > 0 && isUphillPeak(ecg400, loc.idx, 4, 4) ? loc.idx : guess;
      refined.push(idx);
    }

    const out = dedupPeaks(
      refined.sort((a, b) => a - b),
      Math.round(DEDUP_SEC * 400),
    );
    return out;
  }
}

export { Pan_Tompkins_Plus_Plus_Plus };
