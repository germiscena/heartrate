import { graphData } from './data';
import { parseArrayData } from './utils';

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

const dataSignal = parseArrayData(graphData)[0].data.map((obj) => obj[1]);
const dataTime = parseArrayData(graphData)[0].data.map((obj) => obj[0]);

export function getLowPassFilterSignal() {
  const a1 = [1, -2, 1];
  const b1 = [1, 0, 0, 0, 0, 0, -2, 0, 0, 0, 0, 0, 1];
  let lowPassFilterSignal = filter(b1, a1, dataSignal);
  lowPassFilterSignal = normalize(lowPassFilterSignal);
  return {
    series: dataTime.map((item, i) => [item, lowPassFilterSignal[i]]),
    data: lowPassFilterSignal,
  };
}

export function getHighPassFilterSignal() {
  const a2 = [1, -1];
  const b2 = [
    -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, -32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1,
  ];

  const lowPassFilterSignal = getLowPassFilterSignal().data;

  let highPassFilterSignal = filter(b2, a2, lowPassFilterSignal);
  highPassFilterSignal = normalize(highPassFilterSignal);
  return {
    series: dataTime.map((item, i) => [item, highPassFilterSignal[i]]),
    data: highPassFilterSignal,
  };
}

export function getDifferentiatedSignal() {
  const h = [-1, -2, 0, 2, 1].map((v) => v / 8);
  const half = Math.floor(h.length / 2);
  const highPassFilterSignal = getHighPassFilterSignal().data;
  let differentiatedSignal = [];
  for (let i = 0; i < highPassFilterSignal.length; i++) {
    let sum = 0;
    for (let j = 0; j < h.length; j++) {
      const idx = i + j - half;
      const x = idx >= 0 && idx < highPassFilterSignal.length ? highPassFilterSignal[idx] : 0;
      sum += h[j] * x;
    }
    differentiatedSignal.push(sum);
  }

  differentiatedSignal = normalize(differentiatedSignal);
  return {
    series: dataTime.map((item, i) => [item, differentiatedSignal[i]]),
    data: differentiatedSignal,
  };
}

export function getSquaredSignal() {
  const differentiatedSignal = getDifferentiatedSignal().data;
  let squaredSignal = differentiatedSignal.map((x) => x * x);
  squaredSignal = normalize(squaredSignal);
  return { series: dataTime.map((item, i) => [item, squaredSignal[i]]), data: squaredSignal };
}

export function getMovingWindowSignal() {
  const squaredSignal = getSquaredSignal().data;
  let movedWindowSignal = [];
  const windowSize = 51;
  let sum = 0;
  for (let i = 0; i < squaredSignal.length; i++) {
    sum += squaredSignal[i];
    if (i >= windowSize) {
      sum -= squaredSignal[i - windowSize];
    }
    if (i >= windowSize - 1) {
      movedWindowSignal.push(sum / windowSize);
    } else {
      movedWindowSignal.push(0);
    }
  }
  movedWindowSignal = normalize(movedWindowSignal);
  return {
    series: dataTime.map((item, i) => [item, movedWindowSignal[i]]),
    data: movedWindowSignal,
  };
}

export function getRPeaks() {
  const movingWindowSignal = getMovingWindowSignal().data;
  const maxValue = Math.max(...movingWindowSignal);
  const avgValue =
    movingWindowSignal.reduce((sum, val) => sum + val, 0) / movingWindowSignal.length;
  const threshold = avgValue * maxValue; //Числовое значение, выше которого сигнал потенциально Пиковый
  const binary = movingWindowSignal.map((val) => (val > threshold ? 1 : 0)); //Обнаружение границ Пиков
  const left = []; //Возможное начало Пика
  const right = []; //Возможный конец Пика

  for (let i = 1; i < binary.length; i++) {
    if (binary[i - 1] === 0 && binary[i] === 1) {
      left.push(i);
    } else if (binary[i - 1] === 1 && binary[i] === 0) {
      right.push(i);
    }
  }
  const shift = 21; //Корректирующий сдвиг для возвращения к оригинальному временному положению сигнала
  for (let i = 0; i < left.length; i++) {
    left[i] = Math.max(0, left[i] - shift);
    right[i] = Math.min(dataSignal.length - 1, right[i] - shift);
  }

  const R_locs = []; //Массив с индексами Пиков

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
  const minDistance = 0.25 * fs; //Минимальная дистанция между Пиками

  const filteredRLocs = []; //Массив с фильтрацией по минимальной дистанции между Пиками

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
  return {
    series: dataTime.map((item, i) =>
      filteredRLocs.includes(i) ? [item, dataSignal[i]] : [item, 0],
    ),
    data: filteredRLocs,
  };
}
