import { getCorrectYAxisMaximum, getGraphMainInfo, getYAxisMainInfo } from "../utils";

const singleMainYAxisPT = (id, series) => {
  const dataValues = series[id].data.map((item) => item[1]);
  const { min, max, step, plotLines } = getYAxisMainInfo(dataValues);

  return {
    top: `${id * 14.3}%`,
    height: "13.8%",
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
    plotLines,
    max,
    min,
  };
};

export const getMainOptionsPT = (series, uploadedSeriesPage) => {
  const mainGraphInfo = getGraphMainInfo(series, uploadedSeriesPage);
  return {
    ...mainGraphInfo,
    yAxis: [
      singleMainYAxisPT(0, series),
      singleMainYAxisPT(1, series),
      singleMainYAxisPT(2, series),
      singleMainYAxisPT(3, series),
      singleMainYAxisPT(4, series),
      singleMainYAxisPT(5, series),
      singleMainYAxisPT(6, series),
    ],
    series: [
      {
        ...series[0],
        yAxis: 0,
        color: "blue",
        max: singleMainYAxisPT(0, series).max,
        min: singleMainYAxisPT(0, series).min,
      },
      {
        ...series[1],
        yAxis: 1,
        color: "blue",
        max: singleMainYAxisPT(1, series).max,
        min: singleMainYAxisPT(1, series).min,
      },
      {
        ...series[2],
        yAxis: 2,
        color: "blue",
        max: singleMainYAxisPT(2, series).max,
        min: singleMainYAxisPT(2, series).min,
      },
      {
        ...series[3],
        yAxis: 3,
        color: "blue",
        max: singleMainYAxisPT(3, series).max,
        min: singleMainYAxisPT(3, series).min,
      },
      {
        ...series[4],
        yAxis: 4,
        color: "blue",
        max: singleMainYAxisPT(4, series).max,
        min: singleMainYAxisPT(4, series).min,
      },
      {
        ...series[5],
        yAxis: 5,
        color: "blue",
        max: singleMainYAxisPT(5, series).max,
        min: singleMainYAxisPT(5, series).min,
      },
      {
        ...series[6],
        yAxis: 6,
        color: "blue",
        max: singleMainYAxisPT(6, series).max,
        min: singleMainYAxisPT(6, series).min,
      },
    ],
  };
};
