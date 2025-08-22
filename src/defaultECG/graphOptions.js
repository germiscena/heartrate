import { getCorrectSteps, getGraphMainInfo, getYAxisMainInfo } from "../utils";

const singleMainYAxis = (id, series) => {
  const dataValues = series[id].data.map((item) => item[1]);
  const { min, max, step, plotLines } = getYAxisMainInfo(dataValues);

  return {
    top: `${id * 33}%`,
    height: "32%",
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

export const getMainOptions = (series, uploadedSeriesPage) => {
  const mainGraphInfo = getGraphMainInfo(series, uploadedSeriesPage);
  return {
    ...mainGraphInfo,
    yAxis: [singleMainYAxis(0, series), singleMainYAxis(1, series), singleMainYAxis(2, series)],
    series: [
      {
        ...series[0],
        yAxis: 0,
        color: "blue",
        max: singleMainYAxis(0, series).max,
        min: singleMainYAxis(0, series).min,
      },
      {
        ...series[1],
        yAxis: 1,
        color: "green",
        max: singleMainYAxis(1, series).max,
        min: singleMainYAxis(1, series).min,
      },
      {
        ...series[2],
        yAxis: 2,
        color: "red",
        max: singleMainYAxis(1, series).max,
        min: singleMainYAxis(1, series).min,
      },
    ],
  };
};

const singleCalibrateYAxis = (id) => {
  const data = {
    0: {
      title: "V4",
      x: -52,
      top: "2%",
    },
    1: {
      title: "Ym",
      x: -75,
      top: "25%",
    },
    2: { title: "V6", x: -106, top: "45%" },
  };

  return {
    title: {
      text: data[id].title,
      rotation: 0,
      align: "low",
      y: 20,
      x: data[id].x,
      style: {
        fontWeight: 700,
      },
    },
    top: data[id].top,
    height: "20%",
    tickLength: 0,
    labels: { enabled: false },
    gridLineWidth: 0,
    lineWidth: 0,
    minorTickLength: 0,
  };
};

const singleCalibrateSeries = (id) => {
  return {
    data: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 0],
      [3, 0],
    ],
    yAxis: id,
    color: id === 0 ? "blue" : id === 1 ? "green" : "red",
    lineWidth: 3,
  };
};

export const getCalibrationOptions = () => {
  return {
    chart: {
      backgroundColor: "white",
      type: "line",
      scrollablePlotArea: {
        enabled: false,
      },
      width: 200,
    },
    rangeSelector: { enabled: false },
    tooltip: {
      enabled: false,
    },
    xAxis: {
      labels: { enabled: false },
      tickLength: 0,
      lineWidth: 0,
      gridLineWidth: 0,
      minorTickLength: 0,
    },
    plotOptions: {
      series: {
        enableMouseTracking: false,
        states: {
          hover: {
            enabled: false,
          },
        },
        cursor: "default",
      },
    },
    legend: {
      enabled: false,
    },
    navigator: {
      enabled: false,
    },
    scrollbar: {
      enabled: false,
    },
    credits: { enabled: false },
    yAxis: [singleCalibrateYAxis(0), singleCalibrateYAxis(1), singleCalibrateYAxis(2)],
    series: [singleCalibrateSeries(0), singleCalibrateSeries(1), singleCalibrateSeries(2)],
  };
};
