import { getGraphMainInfo, getYAxisMainInfo } from "../utils";

const singleMainYAxisKHO = (id, series) => {
  const dataValues = series[id].data.map((item) => item[1]);
  const { min, max, step, plotLines } = getYAxisMainInfo(dataValues);
  return {
    top: `${id * 16.6}%`,
    height: "16%",
    offset: 0,
    lineWidth: 1,
    labels: {
      x: 5,
      align: "left",
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

export const getMainOptionsKHO = (series, uploadedSeriesPage) => {
  const mainGraphInfo = getGraphMainInfo(series, uploadedSeriesPage);

  return {
    ...mainGraphInfo,
    yAxis: [
      singleMainYAxisKHO(0, series),
      singleMainYAxisKHO(1, series),
      singleMainYAxisKHO(2, series),
      singleMainYAxisKHO(3, series),
      singleMainYAxisKHO(4, series),
      singleMainYAxisKHO(5, series),
    ],
    series: [
      {
        ...series[0],
        yAxis: 0,
        color: "blue",
        max: singleMainYAxisKHO(0, series).max,
        min: singleMainYAxisKHO(0, series).min,
      },
      {
        ...series[1],
        yAxis: 1,
        color: "blue",
        max: singleMainYAxisKHO(0, series).max,
        min: singleMainYAxisKHO(0, series).min,
      },
      {
        ...series[2],
        yAxis: 2,
        color: "blue",
        max: singleMainYAxisKHO(2, series).max,
        min: singleMainYAxisKHO(2, series).min,
      },
      {
        ...series[3],
        yAxis: 3,
        color: "blue",
        max: singleMainYAxisKHO(3, series).max,
        min: singleMainYAxisKHO(3, series).min,
      },
      {
        ...series[4],
        yAxis: 4,
        color: "blue",
        max: singleMainYAxisKHO(4, series).max,
        min: singleMainYAxisKHO(4, series).min,
      },
      {
        ...series[5],
        yAxis: 5,
        color: "blue",
        max: singleMainYAxisKHO(5, series).max,
        min: singleMainYAxisKHO(5, series).min,
      },
    ],
  };
};
