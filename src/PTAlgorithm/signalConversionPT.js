function filter(b, a, x) {
  const y = new Array(x.length).fill(0);
  for (let n = 0; n < x.length; n++) {
    for (let i = 0; i < b.length; i++) {
      if (n - i >= 0) y[n] += b[i] * x[n - i];
    }
    for (let i = 1; i < a.length; i++) {
      if (n - i >= 0) y[n] -= a[i] * y[n - i];
    }
    y[n] /= a[0];
  }
  return y;
}

function normalize(signal) {
  const maxVal = Math.max(...signal.map(Math.abs)) || 1;
  return signal.map((val) => val / maxVal);
}

export function getLowPassFilterSignal(signal) {
  const a1 = [1, -2, 1];
  const b1 = [1, 0, 0, 0, 0, 0, -2, 0, 0, 0, 0, 0, 1];
  let lowPassFilterSignal = filter(b1, a1, signal);
  lowPassFilterSignal = normalize(lowPassFilterSignal);
  return lowPassFilterSignal;
}

export function getHighPassFilterSignal(signal) {
  const a2 = [1, -1];
  const b2 = [
    -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, -32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1,
  ];

  let highPassFilterSignal = filter(b2, a2, signal);
  highPassFilterSignal = normalize(highPassFilterSignal);
  return highPassFilterSignal;
}

export function getDifferentiatedSignal(signal) {
  const h = [-1, -2, 0, 2, 1].map((v) => v / 8);
  const half = Math.floor(h.length / 2);
  let differentiatedSignal = [];
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    for (let j = 0; j < h.length; j++) {
      const idx = i + j - half;
      const x = idx >= 0 && idx < signal.length ? signal[idx] : 0;
      sum += h[j] * x;
    }
    differentiatedSignal.push(sum);
  }

  differentiatedSignal = normalize(differentiatedSignal);
  return differentiatedSignal;
}

export function getSquaredSignal(signal) {
  let squaredSignal = signal.map((x) => x * x);
  squaredSignal = normalize(squaredSignal);
  return squaredSignal;
}

export function getMovingWindowSignal(signal) {
  let movedWindowSignal = [];
  const windowSize = 51;
  let sum = 0;
  for (let i = 0; i < signal.length; i++) {
    sum += signal[i];
    if (i >= windowSize) {
      sum -= signal[i - windowSize];
    }
    if (i >= windowSize - 1) {
      movedWindowSignal.push(sum / windowSize);
    } else {
      movedWindowSignal.push(0);
    }
  }
  movedWindowSignal = normalize(movedWindowSignal);
  return movedWindowSignal;
}

export function getRPeaks(signal, dataSignal) {
  const maxValue = Math.max(...signal);
  const avgValue = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  const threshold = avgValue * maxValue;
  const binary = signal.map((val) => (val > threshold ? 1 : 0));
  const left = [];
  const right = [];

  for (let i = 1; i < binary.length; i++) {
    if (binary[i - 1] === 0 && binary[i] === 1) {
      left.push(i);
    } else if (binary[i - 1] === 1 && binary[i] === 0) {
      right.push(i);
    }
  }
  const shift = 21;
  for (let i = 0; i < left.length; i++) {
    left[i] = Math.max(0, left[i] - shift);
    right[i] = Math.min(dataSignal.length - 1, right[i] - shift);
  }

  const R_locs = [];

  for (let i = 0; i < left.length; i++) {
    const start = left[i];
    const end = right[i];
    let maxVal = -Infinity;
    let maxIdx = start;

    for (let j = start; j <= end; j++) {
      if (dataSignal[j] > maxVal) {
        maxVal = dataSignal[j];
        maxIdx = j;
      }
    }

    R_locs.push(maxIdx);
  }

  const fs = 400;
  const minDistance = 0.25 * fs;

  const filteredRLocs = [];

  for (let i = 0; i < R_locs.length; i++) {
    if (filteredRLocs.length === 0) {
      filteredRLocs.push(R_locs[i]);
    } else {
      const lastAccepted = filteredRLocs[filteredRLocs.length - 1];
      if (R_locs[i] - lastAccepted >= minDistance) {
        filteredRLocs.push(R_locs[i]);
      }
    }
  }
  return filteredRLocs;
}
