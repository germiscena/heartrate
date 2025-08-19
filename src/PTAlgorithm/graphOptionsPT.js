import { getCorrectYAxisMaximum, getGraphMainInfo, getYAxisMainInfo } from '../utils';

const singleMainYAxisQRS = (id, series) => {
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
    plotLines,
    max,
    min,
  };
};

export const getMainOptionsQRS = (series) => {
  const mainGraphInfo = getGraphMainInfo(series);
  return {
    ...mainGraphInfo,
    yAxis: [
      singleMainYAxisQRS(0, series),
      singleMainYAxisQRS(1, series),
      singleMainYAxisQRS(2, series),
      singleMainYAxisQRS(3, series),
      singleMainYAxisQRS(4, series),
      singleMainYAxisQRS(5, series),
      singleMainYAxisQRS(6, series),
    ],
    series: [
      {
        ...series[0],
        yAxis: 0,
        color: 'blue',
        max: singleMainYAxisQRS(0, series).max,
        min: singleMainYAxisQRS(0, series).min,
      },
      {
        ...series[1],
        yAxis: 1,
        color: 'blue',
        max: singleMainYAxisQRS(1, series).max,
        min: singleMainYAxisQRS(1, series).min,
      },
      {
        ...series[2],
        yAxis: 2,
        color: 'blue',
        max: singleMainYAxisQRS(2, series).max,
        min: singleMainYAxisQRS(2, series).min,
      },
      {
        ...series[3],
        yAxis: 3,
        color: 'blue',
        max: singleMainYAxisQRS(3, series).max,
        min: singleMainYAxisQRS(3, series).min,
      },
      {
        ...series[4],
        yAxis: 4,
        color: 'blue',
        max: singleMainYAxisQRS(4, series).max,
        min: singleMainYAxisQRS(4, series).min,
      },
      {
        ...series[5],
        yAxis: 5,
        color: 'blue',
        max: singleMainYAxisQRS(5, series).max,
        min: singleMainYAxisQRS(5, series).min,
      },
      {
        ...series[6],
        yAxis: 6,
        color: 'blue',
        max: singleMainYAxisQRS(6, series).max,
        min: singleMainYAxisQRS(6, series).min,
      },
    ],
  };
};
