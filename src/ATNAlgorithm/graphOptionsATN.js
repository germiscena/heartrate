import { getGraphMainInfo, getYAxisMainInfo } from '../utils';

const singleMainYAxisATN = (id, series) => {
  const dataValues = series[id].data.map((item) => item[1]);
  const { min, max, step, plotLines } = getYAxisMainInfo(dataValues);

  return {
    top: `${id * 16.6}%`,
    height: '16.5%',
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
    plotLines,
    max,
    min,
  };
};

export const getMainOptionsATN = (series) => {
  const mainGraphInfo = getGraphMainInfo(series);
  return {
    ...mainGraphInfo,
    yAxis: [
      singleMainYAxisATN(0, series),
      singleMainYAxisATN(1, series),
      singleMainYAxisATN(2, series),
      singleMainYAxisATN(3, series),
      singleMainYAxisATN(4, series),
      singleMainYAxisATN(5, series),
    ],
    series: [
      {
        ...series[0],
        yAxis: 0,
        color: 'blue',
        max: singleMainYAxisATN(0, series).max,
        min: singleMainYAxisATN(0, series).min,
      },
      {
        ...series[1],
        yAxis: 1,
        color: 'blue',
        max: singleMainYAxisATN(1, series).max,
        min: singleMainYAxisATN(1, series).min,
      },
      {
        ...series[2],
        yAxis: 2,
        color: 'blue',
        max: singleMainYAxisATN(2, series).max,
        min: singleMainYAxisATN(2, series).min,
      },
      {
        ...series[3],
        yAxis: 3,
        color: 'blue',
        max: singleMainYAxisATN(3, series).max,
        min: singleMainYAxisATN(3, series).min,
      },
      {
        ...series[4],
        yAxis: 4,
        color: 'blue',
        max: singleMainYAxisATN(4, series).max,
        min: singleMainYAxisATN(4, series).min,
      },
      {
        ...series[5],
        yAxis: 5,
        color: 'blue',
        max: singleMainYAxisATN(5, series).max,
        min: singleMainYAxisATN(5, series).min,
      },
    ],
  };
};
