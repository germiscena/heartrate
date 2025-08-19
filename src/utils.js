export const parseArrayData = (data) => {
  data = data.map((item) => item.split(',').slice(1));
  const [headers, ...rows] = data;
  const tInd = headers.findIndex((i) => i === 't');
  const series = { 0: [], 1: [], 2: [] };

  rows.forEach((row) => {
    headers.slice(0, -1).forEach((item, i) => {
      series[i].push([Number(row[tInd]), parseFloat(row[i])]);
    });
    // series.v1.push([t, parseFloat(cols[1])]);
    // series.v2.push([t, parseFloat(cols[2])]);
    // series.v3.push([t, parseFloat(cols[3])]);
  });

  return [
    {
      name: headers[0],
      data: series[0],
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: headers[1],
      data: series[1],
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: headers[2],
      data: series[2],
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

export const getCorrectYAxisMaximum = (data) => {
  const isNegative = data < 0;
  let currentNumber = data;
  let separatorId = 0;

  if (isNegative) {
    currentNumber = -currentNumber;
  }
  for (let i = 0; i < String(currentNumber).length; i++) {
    if (String(currentNumber)[i] === '.') {
      separatorId = i;
    }
  }
  let firstDigit = Number(String(currentNumber)[0]);
  let digitNumber = Number('0.' + String(currentNumber).slice(1, 2));
  if (digitNumber === 0) {
    return isNegative ? -currentNumber : currentNumber;
  }
  let result = '';
  if (digitNumber > 0.5) {
    for (let i = 0; i < String(currentNumber).split('').length; i++) {
      if (i === 0) {
        result += firstDigit + 1;
      } else {
        if (separatorId == 0 || separatorId > i) {
          result += 0;
        }
      }
    }
  } else {
    result += firstDigit;
    for (let i = 1; i < String(currentNumber).split('').length; i++) {
      if (i === 1) {
        result += 5;
      } else {
        if (separatorId == 0 || separatorId > i) {
          result += 0;
        }
      }
    }
  }
  return isNegative ? Number(-result) : Number(result);
};

export const getYAxisMainInfo = (dataValues) => {
  // let min = Math.floor(Math.min(...dataValues) / 100) * 100;
  // let max = Math.ceil(Math.max(...dataValues) / 100) * 100;

  let min = Math.min(...dataValues);
  let max = Math.max(...dataValues);

  if (!Math.floor(min / 100) === min) {
    min = min * 100;
  }
  if (!Math.ceil(max / 100) === max) {
    max = max * 100;
  }
  const step = getCorrectSteps(min, max);

  let plotLines = [];
  for (let i = 0; ; i++) {
    const plotLine = step * i;
    plotLines.push(plotLine);
    if (plotLine > max) {
      break;
    }
  }
  for (let i = 1; ; i++) {
    const plotLine = -(step * i);
    plotLines.push(plotLine);
    if (plotLine < min) {
      break;
    }
  }
  plotLines = plotLines
    .sort((a, b) => a - b)
    .map((item, i) => {
      const isZero = item === 0;
      const isMin = i === 0;
      const isMax = i === plotLines.length - 1;
      return {
        value: item,
        color: isZero ? 'black' : isMin || isMax ? 'black' : '#ccc',
        width: isZero ? 1 : isMin || isMax ? 1.5 : 1,
        dashStyle: 'Solid',
        zIndex: 2,
      };
    });

  return { min, max, step, plotLines };
};

export const getGraphMainInfo = (series) => {
  return {
    chart: { zoomType: 'x', backgroundColor: 'white', spacingRight: 30 },
    tooltip: {
      shared: true,
      formatter: function () {
        return (
          `<b>Время: ${this.x} мсек</b><br/>` +
          this.points.map((p) => `${p.series.name}: ${p.y}`).join('<br/>')
        );
      },
    },
    xAxis: {
      type: 'datetime',
      tickPixelInterval: 65,
      title: { text: 'Время (сек)' },
      labels: {
        style: {
          whiteSpace: 'nowrap',
        },
        formatter: function () {
          return this.value / 1000;
        },
      },
      plotLines: Array.from({ length: (series[0].data.length * 2.5) / 100 }, (_, i) => ({
        color: i === 0 ? 'black' : i % 5 === 0 ? '#ddd' : '#eee',
        width: i % 5 === 0 ? 1 : 0.5,
        value: i * 100,
        zIndex: i === 0 ? 10 : 0,
      })),
    },
    legend: {
      enabled: false,
      align: 'center',
      verticalAlign: 'bottom',
      layout: 'horizontal',
      itemStyle: {
        cursor: 'pointer',
      },
      itemCheckboxStyle: {
        position: 'absolute',
        marginTop: '1px',
      },
    },
    credits: { enabled: false },
    navigator: {
      enabled: true,
      xAxis: {
        type: 'linear',
        labels: {
          formatter() {
            return this.value;
          },
        },
      },
    },
    rangeSelector: { enabled: false },
  };
};

export const getCorrectSteps = (min, max) => {
  const steps = [
    0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000,
    10000, 25000, 50000, 100000, 250000, 500000,
  ];
  // const interval = max - min;
  const sumStepsArr = [];
  for (let i = 0; i < steps.length; i++) {
    let downSteps = Math.ceil(Math.abs(min) / steps[i]);
    let upSteps = Math.ceil(max / steps[i]);
    let sumSteps = downSteps + upSteps;
    sumStepsArr.push(sumSteps);
  }
  const correctStepsArr = sumStepsArr.filter((item) => item >= 4 && item <= 12);
  const bestStep =
    correctStepsArr.length > 1
      ? correctStepsArr.length === 2
        ? steps[sumStepsArr.findIndex((item) => item === correctStepsArr.sort((a, b) => a - b)[0])]
        : steps[
            sumStepsArr.findIndex(
              (item) =>
                item ===
                correctStepsArr.sort((a, b) => a - b)[Math.floor(correctStepsArr.length / 2)],
            )
          ]
      : steps[sumStepsArr.findIndex((item) => item === correctStepsArr[0])];

  return bestStep;
};
