export function downsample400to200(x, opts = {}) {
  const fsIn = opts.fsIn ?? 400;
  const cutoffHz = opts.cutoffHz ?? 90;
  let M = opts.numTaps ?? 129;
  if (M % 2 === 0) M += 1;
  const N = x.length;
  if (N === 0) return { y: new Float64Array(0), fsOut: 200, delayIn400: 0 };
  const mid = (M - 1) / 2;
  const fc = cutoffHz / fsIn;
  const h = new Float64Array(M);
  const sinc = (t) => (t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t));
  for (let n = 0; n < M; n++) {
    const m = n - mid;
    const hid = 2 * fc * sinc(2 * fc * m);
    const w =
      0.42 -
      0.5 * Math.cos((2 * Math.PI * n) / (M - 1)) +
      0.08 * Math.cos((4 * Math.PI * n) / (M - 1));
    h[n] = hid * w;
  }

  let s = 0;
  for (let n = 0; n < M; n++) s += h[n];
  for (let n = 0; n < M; n++) h[n] /= s;

  const pad = mid;
  const xp = new Float64Array(N + pad);
  for (let i = 0; i < pad; i++) xp[i] = x[pad - 1 - i < N ? pad - 1 - i : 0];
  xp.set(x, pad);

  const Nz = xp.length;
  const z = new Float64Array(Nz);
  for (let i = 0; i < Nz; i++) {
    let acc = 0;
    const kmax = Math.min(M - 1, i);
    for (let k = 0; k <= kmax; k++) acc += h[k] * xp[i - k];
    z[i] = acc;
  }

  const start = pad;
  const outLen = Math.floor(N / 2);
  const y = new Float64Array(outLen);
  let i = start;
  for (let n = 0; n < outLen; n++, i += 2) y[n] = z[i];

  return y;
}
export function lowPassFilter(signal, cutoffRatio = 0.4) {
  const windowSize = 5;
  const filteredSignal = [];
  for (let i = 0; i < signal.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(signal.length - 1, i + Math.floor(windowSize / 2));
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += signal[j];
      count++;
    }
    filteredSignal.push(sum / count);
  }
  return filteredSignal;
}

export function downsampleSignal(signal) {
  const downsampledSignal = [];
  for (let i = 0; i < signal.length; i += 2) {
    const avg = (signal[i] + signal[i + 1]) / 2;
    downsampledSignal.push(avg);
  }
  return downsampledSignal;
}

const MIN_DIST_SEC = 0.1;
const SEARCH_WIN_SEC = 0.15;
const T_WAVE_SLOPE_RATIO = 0.5;
const RESCUE_SCALE = 0.1;
const GAPFILL_LONG_SEC = 0.9;
const GAPFILL_RR_FACTOR = 1.45;
const GAPFILL_LOW_SCALE = 0.1;
const DEDUP_SEC = 0.18;
const POLARITY_INVARIANT = true;

function mean(arr) {
  if (!arr.length) return 0;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}
function median(arr) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function maxAbs(arr) {
  let m = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = Math.abs(arr[i]);
    if (v > m) m = v;
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
  const leftPad = new Array(pl);
  const rightPad = new Array(pl);
  for (let i = 0; i < pl; i++) {
    leftPad[i] = 2 * x[0] - x[Math.min(pl - i, n - 1)];
    rightPad[i] = 2 * x[n - 1] - x[Math.max(n - 2 - i, 0)];
  }
  const xp = leftPad.concat(x, rightPad);
  const y1 = lfilter(b, a, xp);
  const y2 = lfilter(b, a, y1.slice().reverse()).reverse();
  return y2.slice(pl, pl + n);
}
function convolveFull(x, h) {
  const n = x.length,
    m = h.length;
  const y = new Array(n + m - 1).fill(0);
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    for (let j = 0; j < m; j++) y[i + j] += xi * h[j];
  }
  return y;
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
    const phi = (2 * Math.PI * n) / N;
    w[n] =
      a0 -
      a1 * Math.cos(phi) +
      a2 * Math.cos(2 * phi) -
      a3 * Math.cos(3 * phi) +
      a4 * Math.cos(4 * phi);
  }
  return w;
}
function smoother({ signal, kernel = 'flattop', size = 10, mirror = true }) {
  let length = signal.length;
  if (size > length) size = length - 1;
  if (size < 1) size = 1;

  let win;
  if (kernel === 'flattop') win = flattop(size);
  const sumw = win.reduce((a, b) => a + b, 0);
  const w = win.map((v) => v / sumw);

  const left = mirror ? new Array(size).fill(signal[0]) : [];
  const right = mirror ? new Array(size).fill(signal[signal.length - 1]) : [];
  const src = left.concat(signal, right);
  const y = convolveFull(src, w);
  return mirror
    ? y.slice(size, size + signal.length)
    : y.slice(Math.floor((w.length - 1) / 2), Math.floor((w.length - 1) / 2) + signal.length);
}
function peakIndexes(y, thres = 0, min_dist = 1) {
  if (y.length === 0) return [];
  const ymin = Math.min(...y),
    ymax = Math.max(...y);
  const absThres = ymin + thres * (ymax - ymin);
  const candidates = [];
  for (let i = 1; i < y.length - 1; i++) {
    if (y[i] > absThres && y[i] > y[i - 1] && y[i] > y[i + 1]) candidates.push(i);
  }
  if (!candidates.length) return [];
  candidates.sort((i, j) => y[j] - y[i]);
  const taken = [],
    forbidden = new Array(y.length).fill(false);
  for (const idx of candidates) {
    if (forbidden[idx]) continue;
    taken.push(idx);
    const start = Math.max(0, idx - min_dist);
    const end = Math.min(y.length - 1, idx + min_dist);
    for (let k = start; k <= end; k++) forbidden[k] = true;
  }
  return taken.sort((a, b) => a - b);
}
function argmaxRange(x, start, end) {
  start = Math.max(0, start);
  end = Math.min(end, x.length);
  if (end <= start) return { idx: -1, val: -Infinity };
  let im = start,
    vm = x[start];
  for (let i = start + 1; i < end; i++)
    if (x[i] > vm) {
      vm = x[i];
      im = i;
    }
  return { idx: im, val: vm };
}
function argmaxAbsRange(x, start, end) {
  start = Math.max(0, start);
  end = Math.min(end, x.length);
  if (end <= start) return { idx: -1, val: -Infinity };
  let im = start,
    vm = Math.abs(x[start]);
  for (let i = start + 1; i < end; i++) {
    const v = Math.abs(x[i]);
    if (v > vm) {
      vm = v;
      im = i;
    }
  }
  return { idx: im, val: Math.abs(x[im]) };
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

const BUTTER_200_LOW_12HZ = {
  b: [0.00475052, 0.01425157, 0.01425157, 0.00475052],
  a: [1.0, -2.25008508, 1.75640138, -0.46831211],
};

const BUTTER_200_HIGH_5HZ = {
  b: [0.85449723, -2.56349169, 2.56349169, -0.85449723],
  a: [1.0, -2.6861574, 2.41965511, -0.73016535],
};

class Pan_Tompkins_Plus_Plus {
  rpeak_detection(ecg, fs) {
    let delay = 0,
      skip = 0,
      m_selected_RR = 0,
      mean_RR = 0,
      ser_back = 0;

    const mean_ecg = mean(ecg);
    const ecg0 = ecg.map((v) => v - mean_ecg);
    const lp = BUTTER_200_LOW_12HZ;
    let ecg_l = filtfilt(lp.b, lp.a, ecg0);
    const m1 = maxAbs(ecg_l);
    if (m1 > 0) ecg_l = ecg_l.map((v) => v / m1);

    const hp = BUTTER_200_HIGH_5HZ;
    let ecg_h = filtfilt(hp.b, hp.a, ecg_l, 3 * (Math.max(hp.b.length, hp.a.length) - 1));
    const m2 = maxAbs(ecg_h);
    if (m2 > 0) ecg_h = ecg_h.map((v) => v / m2);

    const b_diff = [1, 2, 0, -2, -1].map((v) => (v * fs) / 8);
    const pad = 3 * (Math.max(hp.b.length, hp.a.length, b_diff.length) - 1);
    let ecg_d = filtfilt(b_diff, [1.0], ecg_h, pad);
    const md = maxAbs(ecg_d);
    if (md > 0) ecg_d = ecg_d.map((v) => v / md);

    let ecg_s = ecg_d.map((v) => v * v);
    const sm_size = pyRound(0.06 * fs);
    ecg_s = smoother({ signal: ecg_s, kernel: 'flattop', size: sm_size, mirror: true });

    const winLen = pyRound(0.15 * fs);
    let temp_vector = ones(winLen).map((v) => v / winLen);
    let ecg_m = convolveFull(ecg_s, temp_vector);
    delay = delay + pyRound(0.15 * fs) / 2;

    const locs = peakIndexes(ecg_m, 0, pyRound(MIN_DIST_SEC * fs));
    const pks = locs.map((i) => ecg_m[i]);
    const LLp = pks.length;

    let qrs_c = zeros(LLp),
      qrs_i = zeros(LLp),
      qrs_i_raw = zeros(LLp),
      qrs_amp_raw = zeros(LLp);
    let nois_c = zeros(LLp),
      nois_i = zeros(LLp);
    let SIGL_buf = zeros(LLp),
      NOISL_buf = zeros(LLp),
      THRS_buf = zeros(LLp);
    let SIGL_buf1 = zeros(LLp),
      NOISL_buf1 = zeros(LLp),
      THRS_buf1 = zeros(LLp);

    const twoSec = 2 * fs + 1;
    let THR_SIG = Math.max(...ecg_m.slice(0, Math.min(twoSec, ecg_m.length))) * (1 / 3);
    let THR_NOISE = mean(ecg_m.slice(0, Math.min(twoSec, ecg_m.length))) * (1 / 2);
    let SIG_LEV = THR_SIG;
    let NOISE_LEV = THR_NOISE;

    const abs2s = ecg_h.slice(0, Math.min(twoSec, ecg_h.length)).map(Math.abs);
    let THR_SIG1 = Math.max(...abs2s) * (1 / 3);
    let THR_NOISE1 = mean(abs2s) * (1 / 2);
    let SIG_LEV1 = THR_SIG1;
    let NOISE_LEV1 = THR_NOISE1;

    let Beat_C = 0,
      Beat_C1 = 0,
      Noise_Count = 0,
      Check_Flag = 0;

    for (let i = 0; i < LLp; i++) {
      const half = Math.round(SEARCH_WIN_SEC * fs);
      const s = Math.max(0, locs[i] - half);
      const e = Math.min(ecg_h.length, locs[i] + half + 1);
      const locH = POLARITY_INVARIANT ? argmaxAbsRange(ecg_h, s, e) : argmaxRange(ecg_h, s, e);
      let x_i_abs = locH.idx;
      let y_i = locH.val;

      if (Beat_C >= 9) {
        const diffs = [];
        for (let k = Beat_C - 9; k < Beat_C - 1; k++) diffs.push(qrs_i[k + 1] - qrs_i[k]);
        mean_RR = mean(diffs);
        m_selected_RR = mean_RR;
      }
      const test_m = m_selected_RR || mean_RR || 0;

      let acceptedHere = false;
      const acceptQRS = (locIdx, amp_m, absIdx_h, amp_h_mod) => {
        Beat_C += 1;
        if (Beat_C - 1 >= LLp) return;
        qrs_c[Beat_C - 1] = amp_m;
        qrs_i[Beat_C - 1] = locIdx;

        if (amp_h_mod >= THR_SIG1) {
          Beat_C1 += 1;
          if (Beat_C1 - 1 >= LLp) return;
          qrs_i_raw[Beat_C1 - 1] = absIdx_h;
          qrs_amp_raw[Beat_C1 - 1] = amp_h_mod;
          SIG_LEV1 = 0.125 * amp_h_mod + 0.875 * SIG_LEV1;
        }
        SIG_LEV = 0.125 * amp_m + 0.875 * SIG_LEV;
        acceptedHere = true;
      };

      if (Beat_C > 0 && locs[i] - qrs_i[Beat_C - 1] >= pyRound(1.4 * fs)) {
        const start = qrs_i[Beat_C - 1] + pyRound(0.36 * fs);
        const end = Math.min(locs[i] + 1, ecg_m.length);
        const seg = start < end ? ecg_m.slice(start, end) : [];
        if (seg.length) {
          const pks_temp = Math.max(...seg);
          let locs_temp = seg.indexOf(pks_temp);
          locs_temp = qrs_i[Beat_C - 1] + pyRound(0.36 * fs) + locs_temp;

          if (pks_temp > THR_NOISE * 0.2) {
            const locH2 = POLARITY_INVARIANT
              ? argmaxAbsRange(
                  ecg_h,
                  Math.max(0, locs_temp - pyRound(0.15 * fs)) + 1,
                  Math.min(ecg_h.length, locs_temp + 2),
                )
              : argmaxRange(
                  ecg_h,
                  Math.max(0, locs_temp - pyRound(0.15 * fs)) + 1,
                  Math.min(ecg_h.length, locs_temp + 2),
                );
            const y_i_t_mod = locH2.val;

            if (y_i_t_mod > THR_NOISE1 * 0.2) {
              acceptQRS(
                locs_temp,
                pks_temp,
                locs_temp -
                  pyRound(0.15 * fs) +
                  (locH2.idx - Math.max(0, locs_temp - pyRound(0.15 * fs)) + 1),
                y_i_t_mod,
              );
            } else {
              NOISE_LEV1 = 0.125 * y_i_t_mod + 0.875 * NOISE_LEV1;
              NOISE_LEV = 0.125 * pks_temp + 0.875 * NOISE_LEV;
            }
          }
        }
      } else if (
        test_m &&
        ((Beat_C > 0 && locs[i] - qrs_i[Beat_C - 1] >= pyRound(1.66 * test_m)) ||
          (Beat_C > 0 && locs[i] - qrs_i[Beat_C - 1] > pyRound(1.0 * fs)))
      ) {
        const start = qrs_i[Beat_C - 1] + pyRound(0.36 * fs);
        const end = Math.min(locs[i] + 1, ecg_m.length);
        const seg = start < end ? ecg_m.slice(start, end) : [];
        if (seg.length) {
          const pks_temp = Math.max(...seg);
          let locs_temp = seg.indexOf(pks_temp);
          locs_temp = qrs_i[Beat_C - 1] + pyRound(0.36 * fs) + locs_temp;

          let THR_NOISE_TMP = THR_NOISE;
          if (i < locs.length - 3 && Beat_C >= 3) {
            const s2 = qrs_i[Beat_C - 3] + pyRound(0.36 * fs);
            const e2 = Math.min(locs[i + 3] + 1, ecg_m.length);
            const seg2 = s2 < e2 ? ecg_m.slice(s2, e2) : [];
            if (seg2.length) THR_NOISE_TMP = 0.5 * THR_NOISE + 0.5 * (mean(seg2) * 0.5);
          }

          if (pks_temp > THR_NOISE_TMP) {
            const locH2 = POLARITY_INVARIANT
              ? argmaxAbsRange(
                  ecg_h,
                  Math.max(0, locs_temp - pyRound(0.15 * fs)) + 1,
                  Math.min(ecg_h.length, locs_temp + 2),
                )
              : argmaxRange(
                  ecg_h,
                  Math.max(0, locs_temp - pyRound(0.15 * fs)) + 1,
                  Math.min(ecg_h.length, locs_temp + 2),
                );
            const y_i_t_mod = locH2.val;

            let THR_NOISE1_TMP = THR_NOISE1;
            if (i < locs.length - 3 && Beat_C >= 3) {
              const s3 = qrs_i[Beat_C - 3] + pyRound(0.36 * fs) - pyRound(0.15 * fs) + 1;
              const e3 = Math.min(locs[i + 3] + 1, ecg_h.length);
              const seg3 = s3 < e3 ? ecg_h.slice(Math.max(0, s3), e3).map((v) => Math.abs(v)) : [];
              if (seg3.length) THR_NOISE1_TMP = 0.5 * THR_NOISE1 + 0.5 * (mean(seg3) * 0.5);
            }

            if (y_i_t_mod > THR_NOISE1_TMP) {
              acceptQRS(
                locs_temp,
                pks_temp,
                locs_temp -
                  pyRound(0.15 * fs) +
                  (locH2.idx - Math.max(0, locs_temp - pyRound(0.15 * fs)) + 1),
                y_i_t_mod,
              );
            } else {
              NOISE_LEV1 = 0.125 * y_i_t_mod + 0.875 * NOISE_LEV1;
              NOISE_LEV = 0.125 * pks_temp + 0.875 * NOISE_LEV;
            }
          }
        }
      }

      if (!acceptedHere && pks[i] >= THR_SIG) {
        if (Beat_C >= 3) {
          if (test_m && locs[i] - qrs_i[Beat_C - 1] <= pyRound(0.5 * test_m)) Check_Flag = 1;
          if (locs[i] - qrs_i[Beat_C - 1] <= pyRound(0.36 * fs) || Check_Flag === 1) {
            const s1 = Math.max(0, locs[i] - pyRound(0.07 * fs));
            const seg1 = ecg_m.slice(s1, locs[i] + 1);
            const Slope1 = seg1.length > 1 ? mean(seg1.slice(1).map((v, k) => v - seg1[k])) : 0;

            const s2 = Math.max(0, qrs_i[Beat_C - 1] - pyRound(0.07 * fs) - 1);
            const seg2 = ecg_m.slice(s2, qrs_i[Beat_C - 1] + 1);
            const Slope2 = seg2.length > 1 ? mean(seg2.slice(1).map((v, k) => v - seg2[k])) : 0;

            if (Math.abs(Slope1) <= Math.abs(T_WAVE_SLOPE_RATIO * Slope2)) {
              skip = 1;
            } else skip = 0;
          }
        }
        if (skip === 0) {
          acceptQRS(locs[i], pks[i], x_i_abs, y_i);
        }
      }

      if (!acceptedHere) {
        const sinceLast = Beat_C > 0 ? locs[i] - qrs_i[Beat_C - 1] : Infinity;
        const okShortRR = sinceLast >= pyRound(0.2 * fs) && sinceLast <= pyRound(0.6 * fs);
        if (pks[i] >= RESCUE_SCALE * THR_SIG && okShortRR && y_i >= RESCUE_SCALE * THR_SIG1) {
          acceptQRS(locs[i], pks[i], x_i_abs, y_i);
        }
      }

      if (!acceptedHere) {
        NOISE_LEV1 = 0.125 * y_i + 0.875 * NOISE_LEV1;
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

      SIGL_buf[i] = SIG_LEV;
      NOISL_buf[i] = NOISE_LEV;
      THRS_buf[i] = THR_SIG;
      SIGL_buf1[i] = SIG_LEV1;
      NOISL_buf1[i] = NOISE_LEV1;
      THRS_buf1[i] = THR_SIG1;
      skip = 0;
      ser_back = 0;
      Check_Flag = 0;
    }

    qrs_i_raw = qrs_i_raw.slice(0, Beat_C1);

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
          const sM = prev + Math.round(0.25 * gap);
          const eM = prev + Math.round(0.75 * gap);
          const candM = argmaxRange(ecg_m, sM, eM);
          if (candM.idx >= 0) {
            const half = Math.round(SEARCH_WIN_SEC * fs);
            const locH = POLARITY_INVARIANT
              ? argmaxAbsRange(ecg_h, candM.idx - half, candM.idx + half + 1)
              : argmaxRange(ecg_h, candM.idx - half, candM.idx + half + 1);
            const ampM = candM.val,
              ampH = locH.val;
            const okM = ampM >= GAPFILL_LOW_SCALE * THR_SIG;
            const okH = ampH >= GAPFILL_LOW_SCALE * THR_SIG1;
            if (okM && okH) added.push(locH.idx);
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
}
export { Pan_Tompkins_Plus_Plus };
