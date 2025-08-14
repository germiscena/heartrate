import { preprocessECG } from './SignalConversionZC';

export const signalConversionZeroCross = (data) => {
  return {
    applyFIRFilter: applyFIRFilter(),
    derivativeFilter: derivativeFilter(),
    squaring: squaring(),
    movingWindowIntegration: movingWindowIntegration(),
    removeClosePeaks: removeClosePeaks(),
  };
};

export function getBandPassCoeffs(order = 26, f1 = 5, f2 = 30, fs = 400) {
  const fc1 = f1 / (fs / 2);
  const fc2 = f2 / (fs / 2);
  const coeffs = [];
  const M = order;
  for (let n = 0; n <= M; n++) {
    if (n === M / 2) {
      coeffs.push(2 * (fc2 - fc1));
    } else {
      const k = n - M / 2;
      coeffs.push(
        (Math.sin(2 * Math.PI * fc2 * k) - Math.sin(2 * Math.PI * fc1 * k)) / (Math.PI * k),
      );
    }
  }
  for (let n = 0; n <= M; n++) {
    coeffs[n] *= 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / M);
  }
  return coeffs;
}

export function applyFIRFilter(signal, coeffs) {
  // const coeffs = getBandPassCoeffs();
  const result = [];
  const N = coeffs.length;
  for (let i = 0; i < signal.length; i++) {
    let acc = 0;
    for (let j = 0; j < N; j++) {
      if (i - j >= 0) {
        acc += coeffs[j] * signal[i - j];
      }
    }
    result.push(acc);
  }
  return result;
}

export function derivativeFilter(signal) {
  const out = [0, 0];
  for (let i = 2; i < signal.length - 2; i++) {
    const val = (-signal[i - 2] - 2 * signal[i - 1] + 2 * signal[i + 1] + signal[i + 2]) / 8;
    out.push(val);
  }
  out.push(0, 0);
  return out;
}

export function squaring(signal) {
  const outSignal = signal.map((v) => v * v);
  return outSignal;
}

export function zeroCrossingDetection(signal) {
  const N = signal.length;
  const d = new Array(N).fill(0);
  for (let j = 1; j < N; j++) {
    d[j] = 0.5 * Math.abs(Math.sign(signal[j]) - Math.sign(signal[j - 1]));
  }
  return d;
}

export function movingWindowIntegration(signal, fs = 400, windowMs = 150) {
  // const N = signal.length;
  // if (N === 0) return [];
  // let windowSize = Math.max(1, Math.round((windowMs / 1000) * fs));
  // if (windowSize > N) windowSize = N;
  // const ps = new Array(N + 1).fill(0);
  // for (let i = 0; i < N; i++) ps[i + 1] = ps[i] + signal[i];
  // const mwi = new Array(N);
  // for (let i = 0; i < N; i++) {
  //   const start = Math.max(0, i - windowSize + 1);
  //   const end = i;
  //   const sum = ps[end + 1] - ps[start];
  //   mwi[i] = sum / windowSize;
  // }
  // const maxAbs = Math.max(...mwi.map(Math.abs)) || 1;
  // const normalized = mwi.map((v) => v / maxAbs);
  // return normalized;
  const result = [];
  let sum = 0;

  for (let i = 0; i < signal.length; i++) {
    sum += signal[i];
    if (i >= windowMs) {
      sum -= signal[i - windowMs];
    }
    if (i >= windowMs - 1) {
      result.push(sum / windowMs);
    } else {
      result.push(0);
    }
  }

  return result;
}

export function eventDetection(signal) {
  const lambda2 = 0.99;
  const lambda3 = 0.97;
  const N = signal.length;
  const d = new Array(N).fill(0);
  const D = new Array(N).fill(0);
  const threshold = new Array(N).fill(0);
  const positive = new Array(N).fill(0);
  const negative = new Array(N).fill(0);

  for (let j = 1; j < N; j++) {
    d[j] = 0.5 * Math.abs(Math.sign(signal[j]) - Math.sign(signal[j - 1]));
  }

  for (let j = 1; j < N; j++) {
    D[j] = lambda2 * D[j - 1] + (1 - lambda2) * d[j];
  }

  for (let j = 1; j < N; j++) {
    threshold[j] = lambda3 * threshold[j - 1] + (1 - lambda3) * D[j];
  }

  for (let j = 0; j < N; j++) {
    if (D[j] < threshold[j]) {
      positive[j] = 1;
    } else {
      negative[j] = 1;
    }
  }
  return { positive, negative, threshold, D };
}

// function findIntervals() {
//   const { positive, negative } = eventDetection();
//   function getIndices(arr) {
//     const indices = [];
//     arr.forEach((val, idx) => {
//       if (val === 1) indices.push(idx);
//     });
//     return indices;
//   }
//   const posIndices = getIndices(positive);
//   const negIndices = getIndices(negative);
//   const diffPos = posIndices.slice(1).map((v, i) => v - posIndices[i]);
//   const diffNeg = negIndices.slice(1).map((v, i) => v - negIndices[i]);

//   const indPos = diffPos.reduce((acc, val, i) => {
//     if (val > 1) acc.push(i);
//     return acc;
//   }, []);

//   const indNeg = diffNeg.reduce((acc, val, i) => {
//     if (val > 1) acc.push(i);
//     return acc;
//   }, []);

//   const upperLimits = indPos.map((i) => posIndices[i]);
//   const lowerLimits = indNeg.map((i) => negIndices[i]);

//   const events = [];
//   for (let i = 0; i < Math.min(upperLimits.length, lowerLimits.length); i++) {
//     events.push([lowerLimits[i], upperLimits[i]]);
//   }
//   return events;
// }

export function findIntervals({ positive }) {
  const intervals = [];
  let start = null;

  for (let i = 0; i < positive.length; i++) {
    if (positive[i] === 1 && start === null) {
      start = i;
    } else if ((positive[i] === 0 || i === positive.length - 1) && start !== null) {
      intervals.push({ start, end: i - 1 });
      start = null;
    }
  }
  return intervals;
}

// function groupCloseEvents(maxGap = 30) {
//   const events = findIntervals();
//   const groupedEvents = [...events];

//   for (let i = 0; i < groupedEvents.length - 1; i++) {
//     const gap = groupedEvents[i + 1][0] - groupedEvents[i][1];
//     if (gap <= maxGap) {
//       groupedEvents[i] = [groupedEvents[i][0], groupedEvents[i + 1][1]];
//       groupedEvents[i + 1] = null;
//     }
//   }
//   return groupedEvents.filter(Boolean);
// }

export function groupCloseEvents(intervals, minDistance = 10) {
  //80
  if (!intervals.length) return [];

  const grouped = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const prev = grouped[grouped.length - 1];
    const current = intervals[i];

    if (current.start - prev.end <= minDistance) {
      prev.end = current.end;
    } else {
      grouped.push(current);
    }
  }

  return grouped;
}

export function determineRPeakAmplitude(signal, intervals) {
  const peaks = [];

  for (const interval of intervals) {
    let maxAmp = -Infinity;
    let maxIdx = interval.start;

    for (let i = interval.start; i <= interval.end; i++) {
      if (signal[i] > maxAmp) {
        maxAmp = signal[i];
        maxIdx = i;
      }
    }

    peaks.push({ index: maxIdx, amplitude: maxAmp });
  }

  return peaks;
}

export function findRPeakLocations(signal, peaks, searchRadius = 10) {
  const refinedPeaks = [];

  for (const { index } of peaks) {
    let maxIdx = index;
    let maxVal = signal[index];
    for (
      let i = Math.max(0, index - searchRadius);
      i <= Math.min(signal.length - 1, index + searchRadius);
      i++
    ) {
      if (signal[i] > maxVal) {
        maxVal = signal[i];
        maxIdx = i;
      }
    }

    refinedPeaks.push(maxIdx);
  }

  return refinedPeaks;
}

export function removeClosePeaks(peakIndices, peakAmps, fs = 400, minDistanceMs = 250) {
  if (!Array.isArray(peakIndices) || !Array.isArray(peakAmps)) return [];
  if (peakIndices.length === 0) return [];
  const minDistSamples = Math.max(1, Math.round((minDistanceMs / 1000) * fs));

  const idx = peakIndices.slice();
  const amp = peakAmps.slice();

  for (let i = 0; i < idx.length - 1; i++) {
    if (idx[i] === 0) continue;
    let j = i + 1;

    while (j < idx.length && idx[j] === 0) j++;
    if (j >= idx.length) break;

    if (idx[j] - idx[i] < minDistSamples) {
      if (amp[i] >= amp[j]) {
        idx[j] = 0;
      } else {
        idx[i] = 0;
      }
    }
  }

  const closePeaks = idx.filter((v) => v !== 0);
  return closePeaks;
}
