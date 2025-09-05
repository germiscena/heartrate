function toF64(arr) {
  if (arr instanceof Float64Array) return arr.slice();
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i];
  return out;
}

function reflectIndex(i, N) {
  if (N === 1) return 0;
  while (i < 0 || i >= N) {
    if (i < 0) i = -i - 1;
    if (i >= N) i = 2 * N - i - 1;
  }
  return i;
}

function oddWindowSize(samples) {
  const s = Math.max(1, Math.round(samples));
  return s % 2 === 0 ? s + 1 : s;
}

function highPassOnePole(x, fs, fc = 0.5) {
  const dt = 1 / fs;
  const RC = 1 / (2 * Math.PI * fc);
  const alpha = RC / (RC + dt);

  const N = x.length;
  const xin = toF64(x);
  const y = new Float64Array(N);
  y[0] = 0;
  for (let n = 1; n < N; n++) {
    y[n] = alpha * (y[n - 1] + xin[n] - xin[n - 1]);
  }
  return y;
}

function medianFilter(x, windowSamples) {
  const N = x.length;
  const xin = toF64(x);
  const W = oddWindowSize(windowSamples);
  const half = (W - 1) >> 1;
  const y = new Float64Array(N);
  const buf = new Float64Array(W);

  for (let n = 0; n < N; n++) {
    for (let k = -half, j = 0; k <= half; k++, j++) {
      buf[j] = xin[reflectIndex(n + k, N)];
    }

    const arr = Array.from(buf);
    arr.sort((a, b) => a - b);
    y[n] = arr[half];
  }
  return y;
}

function doubleMedianBaselineSubtract(x, fs, win1_ms = 200, win2_ms = 600) {
  const w1 = Math.round((win1_ms / 1000) * fs);
  const w2 = Math.round((win2_ms / 1000) * fs);

  const m1 = medianFilter(x, w1);
  const baseline = medianFilter(m1, w2);

  const N = baseline.length;
  const xin = toF64(x);
  const corrected = new Float64Array(N);
  for (let i = 0; i < N; i++) corrected[i] = xin[i] - baseline[i];

  return { baseline, corrected };
}

function stage1_preprocess(ecg, fs = 400) {
  const hpf = highPassOnePole(ecg, fs, 0.5);
  const { baseline, corrected } = doubleMedianBaselineSubtract(hpf, fs, 200, 600);
  return {
    hpf,
    baseline,
    detrended: corrected,
  };
}
function reflectPad(x, pad) {
  const N = x.length;
  const out = new Float64Array(N + 2 * pad);
  for (let i = 0; i < pad; i++) {
    out[i] = x[reflectIndex(pad - i - 1, N)];
  }
  for (let i = 0; i < N; i++) out[pad + i] = x[i];
  for (let i = 0; i < pad; i++) {
    out[pad + N + i] = x[reflectIndex(N - 2 - i, N)];
  }
  return out;
}

function biquadFilter(x, coeffs) {
  const { b0, b1, b2, a1, a2 } = coeffs;
  const N = x.length;
  const xin = toF64(x);
  const y = new Float64Array(N);

  let x1 = 0,
    x2 = 0;
  let y1 = 0,
    y2 = 0;

  for (let n = 0; n < N; n++) {
    const xn = xin[n];
    const yn = b0 * xn + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    y[n] = yn;
    x2 = x1;
    x1 = xn;
    y2 = y1;
    y1 = yn;
  }
  return y;
}

function rbjLowpassCoeffs(fs, fc, Q = 1 / Math.SQRT2) {
  const w0 = 2 * Math.PI * (fc / fs);
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * Q);

  let b0 = (1 - cosw0) / 2;
  let b1 = 1 - cosw0;
  let b2 = (1 - cosw0) / 2;
  let a0 = 1 + alpha;
  let a1 = -2 * cosw0;
  let a2 = 1 - alpha;
  b0 /= a0;
  b1 /= a0;
  b2 /= a0;
  a1 /= a0;
  a2 /= a0;

  return { b0, b1, b2, a1, a2 };
}

function biquadCascadeForward(x, sections) {
  let y = toF64(x);
  for (const s of sections) y = biquadFilter(y, s);
  return y;
}

function filtfiltCascade(x, sections, fs = 400, padSeconds = 0.25) {
  const N = x.length;
  if (N < 3) return toF64(x);

  const pad = Math.min(N - 1, Math.max(12, Math.round(fs * padSeconds)));
  const padded = reflectPad(x, pad);
  let y = biquadCascadeForward(padded, sections);
  y = y.reverse();
  y = biquadCascadeForward(y, sections);
  y = y.reverse();
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) out[i] = y[pad + i];
  return out;
}

function rbjHighpassCoeffs(fs, fc, Q = 1 / Math.SQRT2) {
  const w0 = 2 * Math.PI * (fc / fs);
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * Q);

  let b0 = (1 + cosw0) / 2;
  let b1 = -(1 + cosw0);
  let b2 = (1 + cosw0) / 2;
  let a0 = 1 + alpha;
  let a1 = -2 * cosw0;
  let a2 = 1 - alpha;

  b0 /= a0;
  b1 /= a0;
  b2 /= a0;
  a1 /= a0;
  a2 /= a0;
  return { b0, b1, b2, a1, a2 };
}

const BUTTER_QS_4 = [0.541196100146197, 1.3065629648763766];

function hpSections(fs, fc, order = 2) {
  if (order === 2) return [rbjHighpassCoeffs(fs, fc, 1 / Math.SQRT2)];
  if (order === 4) return BUTTER_QS_4.map((q) => rbjHighpassCoeffs(fs, fc, q));
}

function lpSections(fs, fc, order = 4) {
  if (order === 2) return [rbjLowpassCoeffs(fs, fc, 1 / Math.SQRT2)];
  if (order === 4) return BUTTER_QS_4.map((q) => rbjLowpassCoeffs(fs, fc, q));
}

function bandpass5to18(
  ecg,
  fs = 400,
  { hpOrder = 2, lpOrder = 4, zeroPhase = true, padSeconds = 0.25 } = {},
) {
  const sections = [...hpSections(fs, 5, hpOrder), ...lpSections(fs, 18, lpOrder)];
  if (zeroPhase) {
    return filtfiltCascade(ecg, sections, fs, padSeconds);
  } else {
    return sections.reduce((sig, sec) => biquadFilter(sig, sec), toF64(ecg));
  }
}

export function biggestPreprocessFilter(signal, fs = 400) {
  const { detrended } = stage1_preprocess(signal, fs);
  let bp = bandpass5to18(detrended, fs, { hpOrder: 4, lpOrder: 4, zeroPhase: true });

  return {
    bp,
    detrended,
  };
}
