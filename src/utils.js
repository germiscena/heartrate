export const parseArrayData = (data) => {
  const [header, ...rows] = data;
  const headers = header.split(',');
  const tIdx = headers.indexOf('t');
  const v1Idx = headers.indexOf('v1');
  const v2Idx = headers.indexOf('v2');
  const v3Idx = headers.indexOf('v3');

  const series = { v1: [], v2: [], v3: [] };
  rows.forEach((row) => {
    const cols = row.split(',');
    const t = parseFloat(cols[tIdx]);
    series.v1.push([t, parseFloat(cols[v1Idx])]);
    series.v2.push([t, parseFloat(cols[v2Idx])]);
    series.v3.push([t, parseFloat(cols[v3Idx])]);
  });

  return [
    {
      name: 'V4',
      data: series.v1,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Ym',
      data: series.v2,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'V6',
      data: series.v3,
      dataGrouping: {
        enabled: false,
      },
    },
  ];
};

export function analyzeExcitations(data) {
  const dataLabels = data[0].split(',');
  const labelsNames = ['v1', 'v2', 'v3'];
  const timeLabelIdx = dataLabels.indexOf('t');
  const labelIdxes = labelsNames.map((ch) => dataLabels.indexOf(ch));

  const signals = labelIdxes.map(() => []);
  const times = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i].split(',');
    labelIdxes.forEach((idx, chNum) => {
      signals[chNum].push(Number(row[idx]));
    });
    times.push(Number(row[timeLabelIdx]));
  }

  function analyzeLabel(signal) {
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    const std = Math.sqrt(signal.reduce((a, b) => a + (b - mean) ** 2, 0) / signal.length);
    const threshold = mean + 0.5 * std;
    const minIntervalMs = 200;
    const peaks = [];

    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1] && signal[i] > threshold) {
        if (peaks.length === 0 || times[i] - times[peaks[peaks.length - 1]] >= minIntervalMs) {
          peaks.push(i);
        } else {
          if (signal[i] > signal[peaks[peaks.length - 1]]) {
            peaks[peaks.length - 1] = i;
          }
        }
      }
    }

    const peakTimes = peaks.map((i) => times[i]);
    const intervals = [];
    for (let j = 1; j < peakTimes.length; j++) {
      intervals.push(peakTimes[j] - peakTimes[j - 1]);
    }

    return {
      count: peakTimes.length,
      avgInterval: intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0,
    };
  }

  const result = {};
  labelsNames.forEach((name, i) => {
    result[name] = analyzeLabel(signals[i]);
  });

  const combinedSignal = [];
  for (let i = 0; i < signals[0].length; i++) {
    const vals = labelIdxes.map((_, chNum) => signals[chNum][i]);
    const maxAbs = Math.max(...vals.map(Math.abs));
    const combinedVal = vals.find((v) => Math.abs(v) === maxAbs);
    combinedSignal.push(combinedVal);
  }
  result.combined = analyzeLabel(combinedSignal);

  return result;
}
