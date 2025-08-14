import { getGraphMainInfo, getYAxisMainInfo } from '../utils';

const singleMainYAxisZC = (id, series) => {
  const dataValues = series[id].data.map((item) => item[1]);
  const { min, max, step, plotLines } = getYAxisMainInfo(dataValues);
  return {
    top: `${id * 14.3}%`,
    height: '14.2%',
    offset: 0,
    lineWidth: 1,
    labels: {
      x: 5,
      align: 'left',
    },
    tickPositioner: function () {
      const positions = [];
      for (let y = plotLines[0].value; y <= plotLines[plotLines.length - 1].value; y += step) {
        positions.push(y);
      }
      return positions;
    },
    gridLineWidth: 0,
    minorTickInterval: null,
    tickInterval: step,
    plotLines,
    max,
    min,
  };
};

export const getMainOptionsZC = (series) => {
  const mainGraphInfo = getGraphMainInfo(series);

  return {
    ...mainGraphInfo,
    yAxis: [
      singleMainYAxisZC(0, series),
      singleMainYAxisZC(1, series),
      singleMainYAxisZC(2, series),
      singleMainYAxisZC(3, series),
      singleMainYAxisZC(4, series),
      singleMainYAxisZC(5, series),
    ],
    series: [
      {
        ...series[0],
        yAxis: 0,
        color: 'blue',
        max: singleMainYAxisZC(0, series).max,
        min: singleMainYAxisZC(0, series).min,
      },
      {
        ...series[1],
        yAxis: 1,
        color: 'blue',
        max: singleMainYAxisZC(0, series).max,
        min: singleMainYAxisZC(0, series).min,
      },
      {
        ...series[2],
        yAxis: 2,
        color: 'blue',
        max: singleMainYAxisZC(2, series).max,
        min: singleMainYAxisZC(2, series).min,
      },
      {
        ...series[3],
        yAxis: 3,
        color: 'blue',
        max: singleMainYAxisZC(3, series).max,
        min: singleMainYAxisZC(3, series).min,
      },
      {
        ...series[4],
        yAxis: 4,
        color: 'blue',
        max: singleMainYAxisZC(4, series).max,
        min: singleMainYAxisZC(4, series).min,
      },
      {
        ...series[5],
        yAxis: 5,
        color: 'blue',
        max: singleMainYAxisZC(5, series).max,
        min: singleMainYAxisZC(5, series).min,
      },
    ],
  };
};
