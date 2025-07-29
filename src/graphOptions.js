const singleMainYAxis = (id, series) => {
  const dataValues = series[id].data.map((item) => item[1]);
  const min = Math.floor(Math.min(...dataValues) / 100) * 100;
  const max = Math.ceil(Math.max(...dataValues) / 100) * 100;

  const step = 100;

  const plotLines = [];

  for (let y = min; y <= max; y += step) {
    const isZero = y === 0;
    const isMin = y === min;
    const isMax = y === max;
    plotLines.push({
      value: y,
      color: isZero ? '#000' : isMin || isMax ? 'black' : '#ccc',
      width: isZero ? 2 : isMin || isMax ? 1.5 : 1,
      dashStyle: 'Solid',
      zIndex: 2,
    });
  }

  return {
    top: `${id * 33}%`,
    height: '32%',
    offset: 0,
    lineWidth: 1,
    labels: {
      x: 5,
      align: 'left',
    },
    tickPositioner: function () {
      const positions = [];
      for (let y = min; y <= max; y += step) {
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

export const getMainOptions = (series) => {
  return {
    chart: { zoomType: 'x', backgroundColor: 'white', spacingRight: 30 },
    title: { text: 'Зависимость амплитуды от времени' },
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
      type: 'linear',
      tickInterval: 40,
      minorTickInterval: 40,
      title: { text: 'Время (сек)' },
      labels: {
        style: {
          whiteSpace: 'nowrap',
        },
        formatter: function () {
          return this.value / 1000;
        },
      },
      plotLines: Array.from({ length: 1500 }, (_, i) => ({
        color: i % 5 === 0 ? '#ddd' : '#eee',
        width: i % 5 === 0 ? 1 : 0.5,
        value: i * 40,
        zIndex: 0,
      })),
    },
    legend: {
      enabled: true,
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
    yAxis: [singleMainYAxis(0, series), singleMainYAxis(1, series), singleMainYAxis(2, series)],

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
    series: [
      {
        ...series[0],
        yAxis: 0,
        color: 'blue',
        max: singleMainYAxis(0, series).max,
        min: singleMainYAxis(0, series).min,
      },
      {
        ...series[1],
        yAxis: 1,
        color: 'green',
        max: singleMainYAxis(1, series).max,
        min: singleMainYAxis(1, series).min,
      },
      {
        ...series[2],
        yAxis: 2,
        color: 'red',
        max: singleMainYAxis(1, series).max,
        min: singleMainYAxis(1, series).min,
      },
    ],
  };
};

const singleCalibrateYAxis = (id) => {
  const data = {
    0: {
      title: 'V4',
      x: -52,
      top: '2%',
    },
    1: {
      title: 'Ym',
      x: -75,
      top: '25%',
    },
    2: { title: 'V6', x: -106, top: '45%' },
  };

  return {
    title: {
      text: data[id].title,
      rotation: 0,
      align: 'low',
      y: 20,
      x: data[id].x,
      style: {
        fontWeight: 700,
      },
    },
    top: data[id].top,
    height: '20%',
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
    color: id === 0 ? 'blue' : id === 1 ? 'green' : 'red',
    lineWidth: 3,
  };
};

export const getCalibrationOptions = () => {
  return {
    chart: {
      backgroundColor: 'white',
      type: 'line',
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
        cursor: 'default',
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
