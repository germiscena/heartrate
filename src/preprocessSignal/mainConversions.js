export function mwmFilter(ecg) {
  const N = ecg.length;
  const L1 = 40;
  const L2 = 160;
  const flen1 = Math.floor(L1 / 2);
  const flen2 = Math.floor(L2 / 2);
  const x1 = new Array(N);
  for (let j = 0; j < N; j++) {
    const start = Math.max(0, j - flen1);
    const end = Math.min(N - 1, j + flen1);
    x1[j] = medianOfRange(ecg, start, end);
  }
  const baseline = new Array(N);
  for (let j = 0; j < N; j++) {
    const start = Math.max(0, j - flen2);
    const end = Math.min(N - 1, j + flen2);
    baseline[j] = medianOfRange(x1, start, end);
  }

  const corrected = new Array(N);
  for (let i = 0; i < N; i++) {
    const x = ecg[i];
    const b = baseline[i];
    corrected[i] = Number.isNaN(x) || Number.isNaN(b) ? NaN : x - b;
  }

  return corrected;

  function medianOfRange(arr, start, end) {
    const k = end - start + 1;
    const tmp = new Array(k);
    for (let i = 0; i < k; i++) tmp[i] = arr[start + i];
    tmp.sort((a, b) => a - b);
    const mid = Math.floor(k / 2);
    if (k % 2 === 1) {
      return tmp[mid];
    } else {
      return 0.5 * (tmp[mid - 1] + tmp[mid]);
    }
  }
}
export function lpFilterMatlab(sig) {
  const N = sig.length;
  if (N === 0) return [];
  const b = [1, 0, 0, 0, 0, 0, -2, 0, 0, 0, 0, 0, 1];
  const a = [1, -2, 1];
  const h = impulseResponse13(b, a);
  const yc = conv(sig, h);
  const start = 6;
  const out = yc.slice(start, start + N);
  return out;

  function impulseResponse13(b, a) {
    const M = 13;
    const y = new Array(M).fill(0);
    const a1 = a[1],
      a2 = a[2];

    for (let n = 0; n < M; n++) {
      let acc = n === 0 ? b[0] : 0;
      for (let k = 1; k < b.length; k++) {
        const idx = n - k;
        if (idx === 0) acc += b[k];
      }
      const yn1 = n - 1 >= 0 ? y[n - 1] : 0;
      const yn2 = n - 2 >= 0 ? y[n - 2] : 0;
      y[n] = acc - a1 * yn1 - a2 * yn2;
    }
    return y;
  }

  function conv(x, h) {
    const Nx = x.length,
      Nh = h.length;
    const Ny = Nx + Nh - 1;
    const y = new Array(Ny).fill(0);
    for (let n = 0; n < Ny; n++) {
      let s = 0;
      const kmin = Math.max(0, n - (Nx - 1));
      const kmax = Math.min(n, Nh - 1);
      for (let k = kmin; k <= kmax; k++) {
        s += h[k] * x[n - k];
      }
      y[n] = s;
    }
    return y;
  }
}

export function hpFilterMatlab(sig) {
  const N = sig.length;

  const b = (() => {
    const arr = new Array(33).fill(0);
    arr[0] = -1;
    arr[16] = 32;
    arr[17] = -32;
    arr[32] = 1;
    return arr;
  })();
  const a = [1, -1];
  const h = impulseResponse(b, a, 33);

  const yc = conv(sig, h);
  const out = yc.slice(16, 16 + N);
  return out;
  function impulseResponse(b, a, M) {
    const y = new Array(M).fill(0);
    const a1 = a[1];
    for (let n = 0; n < M; n++) {
      let acc = n < b.length ? b[n] : 0;
      const yn1 = n > 0 ? y[n - 1] : 0;
      y[n] = acc - a1 * yn1;
    }
    return y;
  }

  function conv(x, h) {
    const Nx = x.length,
      Nh = h.length;
    const Ny = Nx + Nh - 1;
    const y = new Array(Ny).fill(0);
    for (let n = 0; n < Ny; n++) {
      let s = 0;
      const kmin = Math.max(0, n - (Nx - 1));
      const kmax = Math.min(n, Nh - 1);
      for (let k = kmin; k <= kmax; k++) s += h[k] * x[n - k];
      y[n] = s;
    }
    return y;
  }
}

export function notch50HzCombFILT(x) {
  const fs = 400;
  const Fo = 50;
  const Q = 35;
  const doNorm = false;
  const Nf = fs / Fo;
  const N = Math.max(2, Math.round(Nf));
  const BW = Fo / (fs / 2) / Q;
  const r = clamp(1 - BW, 0.0, 0.999999);
  const a1 = Math.pow(r, 1 / N);
  const b = new Array(N).fill(1);
  const a = Array.from({ length: N }, (_, k) => Math.pow(a1, k));
  const y = filtfiltIIR(b, a, x);

  if (!doNorm) return y;
  const m = y.reduce((M, v) => Math.max(M, Math.abs(v)), 0) || 1;
  return y.map((v) => v / m);

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function lfilter(b, a, x) {
    const nb = b.length,
      na = a.length;
    const y = new Array(x.length).fill(0);
    for (let n = 0; n < x.length; n++) {
      let acc = 0;
      for (let k = 0; k < nb; k++) {
        const xn = n - k;
        if (xn >= 0) acc += b[k] * x[xn];
      }
      for (let k = 1; k < na; k++) {
        const yn = n - k;
        if (yn >= 0) acc -= a[k] * y[yn];
      }
      y[n] = acc;
    }
    return y;
  }
  function filtfiltIIR(b, a, x) {
    const nfact = 3 * (Math.max(b.length, a.length) - 1);
    const N = x.length;
    if (N <= nfact + 1) {
      const y1 = lfilter(b, a, x);
      return lfilter(b, a, y1.slice().reverse()).reverse();
    }
    const pre = reflectPad(x, nfact, true);
    const post = reflectPad(x, nfact, false);
    const xx = pre.concat(x, post);
    const y1 = lfilter(b, a, xx);
    const y2 = lfilter(b, a, y1.slice().reverse()).reverse();
    return y2.slice(nfact, nfact + N);

    function reflectPad(arr, L, atStart) {
      const out = new Array(L);
      if (atStart) {
        for (let i = 0; i < L; i++) out[i] = 2 * arr[0] - arr[1 + i];
        return out.reverse();
      } else {
        for (let i = 0; i < L; i++) out[i] = 2 * arr[N - 1] - arr[N - 2 - i];
        return out;
      }
    }
  }
}

export function savGolayFilter(data, mode) {
  let K, F, dt, deriv, nl, nr, M;
  if (mode === 'centered') {
    K = 2;
    F = 25;
    dt = 0.05;
    deriv = 0;
  } else if (mode === 'asymmetric') {
    nl = 16;
    nr = 16;
    M = 4;
    deriv = 0;
    dt = 0.05;
  }
  function transpose(M) {
    const r = M.length,
      c = M[0].length;
    const T = Array.from({ length: c }, () => Array(r));
    for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) T[j][i] = M[i][j];
    return T;
  }

  function matMul(A, B) {
    const aR = A.length,
      aC = A[0].length;
    const bR = B.length,
      bC = B[0].length;
    const C = Array.from({ length: aR }, () => Array(bC).fill(0));
    for (let i = 0; i < aR; i++) {
      for (let k = 0; k < aC; k++) {
        const aik = A[i][k];
        for (let j = 0; j < bC; j++) C[i][j] += aik * B[k][j];
      }
    }
    return C;
  }

  function invertMatrix(M) {
    const n = M.length;
    const A = M.map((r) => r.slice());
    const I = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
      const pivotVal = A[piv][col];
      if (piv !== col) {
        [A[col], A[piv]] = [A[piv], A[col]];
        [I[col], I[piv]] = [I[piv], I[col]];
      }
      for (let j = 0; j < n; j++) {
        A[col][j] /= pivotVal;
        I[col][j] /= pivotVal;
      }
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = A[r][col];
        if (factor === 0) continue;
        for (let j = 0; j < n; j++) {
          A[r][j] -= factor * A[col][j];
          I[r][j] -= factor * I[col][j];
        }
      }
    }
    return I;
  }
  const factorial = (n) => {
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  };
  function designMatrixCentered(K, F) {
    const m = (F - 1) >> 1;
    const A = Array.from({ length: F }, () => Array(K + 1).fill(0));
    for (let i = 0; i < F; i++) {
      const n = i - m;
      let p = 1;
      for (let j = 0; j <= K; j++) {
        A[i][j] = p;
        p *= n;
      }
    }
    return A;
  }
  function designMatrixAsym(M, nl, nr) {
    const F = nl + nr + 1;
    const A = Array.from({ length: F }, () => Array(M + 1).fill(0));
    for (let i = 0; i < F; i++) {
      const n = i - nl;
      let p = 1;
      for (let j = 0; j <= M; j++) {
        A[i][j] = p;
        p *= n;
      }
    }
    return A;
  }
  function sgDesign(K, F) {
    const A = designMatrixCentered(K, F);
    const AT = transpose(A);
    const ATA = matMul(AT, A);
    const ATA_inv = invertMatrix(ATA);
    const pinv = matMul(ATA_inv, AT);

    const G = Array.from({ length: F }, () => Array(K + 1).fill(0));
    for (let d = 0; d <= K; d++) {
      const scale = factorial(d);
      for (let j = 0; j < F; j++) G[j][d] = scale * pinv[d][j];
    }
    return G;
  }
  function sgDesignAsym(M, nl, nr) {
    const F = nl + nr + 1;
    const A = designMatrixAsym(M, nl, nr);
    const AT = transpose(A);
    const ATA = matMul(AT, A);
    const ATA_inv = invertMatrix(ATA);
    const pinv = matMul(ATA_inv, AT);

    const GA = Array.from({ length: F }, () => Array(M + 1).fill(0));
    for (let d = 0; d <= M; d++) {
      const scale = factorial(d);
      for (let j = 0; j < F; j++) GA[j][d] = scale * pinv[d][j];
    }
    return GA;
  }
  function convSame(signal, kernel) {
    const N = signal.length;
    const F = kernel.length;
    const m = Math.floor(F / 2);
    const y = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      let acc = 0;
      for (let j = 0; j < F; j++) {
        const idx = i + j - m;
        if (idx >= 0 && idx < N) acc += signal[idx] * kernel[j];
      }
      y[i] = acc;
    }
    return y;
  }
  function convAlign(signal, kernel, centerIndex) {
    const N = signal.length,
      F = kernel.length;
    const y = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      let acc = 0;
      for (let j = 0; j < F; j++) {
        const idx = i + j - centerIndex;
        if (idx >= 0 && idx < N) acc += signal[idx] * kernel[j];
      }
      y[i] = acc;
    }
    return y;
  }

  function sgApply(signal, K, F, opts = {}) {
    const { dt = 1, deriv = 0 } = opts;
    const G = sgDesign(K, F);
    const h = getColumn(G, deriv);
    const y = convSame(signal, h);
    if (deriv === 0) return y;
    const scale = Math.pow(dt, deriv);
    return y.map((v) => v / scale);
  }
  function savGolSmooth(f, nl, nr, M) {
    const GA = sgDesignAsym(M, nl, nr);
    const c = getColumn(GA, 0);
    const n = f.length;
    const y = convAlign(f, c, nl);
    const g = y.slice();
    const F = nl + nr + 1;
    for (let i = nl; i <= n - nr - 1; i++) g[i] = y[i + nr];
    for (let i = 0; i < nl && i < n; i++) g[i] = f[i];
    for (let i = Math.max(n - nr, 0); i < n; i++) g[i] = f[i];
    return g;
  }
  function getColumn(M, j) {
    return M.map((row) => row[j]);
  }
  function scaleArray(a, s) {
    return a.map((v) => v * s);
  }

  if (mode === 'centered') {
    return sgApply(data, K, F, { dt, deriv });
  }

  if (mode === 'asymmetric') {
    if (deriv === 0) {
      return savGolSmooth(data, nl, nr, M);
    }
    const GA = sgDesignAsym(M, nl, nr);
    const h = GA.map((r) => r[deriv]);
    const y = convAlign(data, h, nl);
    const scale = Math.pow(dt, deriv);
    return y.map((v) => v / scale);
  }
}
