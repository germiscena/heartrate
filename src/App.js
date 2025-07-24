import { graphData } from './data';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';

function App() {
  const parseArrayData = (data) => {
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
      { name: 'V4', data: series.v1 },
      { name: 'Ym', data: series.v2 },
      { name: 'V6', data: series.v3 },
    ];
  };
  function analyzeExcitations(data) {
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
  const series = parseArrayData(graphData);

  const options = {
    chart: { zoomType: 'y' },
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
      title: { text: 'Время (мсек)' },
      labels: {
        formatter: function () {
          return this.value;
        },
      },
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
    yAxis: { title: { text: 'Значение' } },
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
    series,
  };
  const dataResult = analyzeExcitations(graphData);

  console.log(dataResult, 'resik');

  return (
    <div>
      <HighchartsReact highcharts={Highcharts} options={options} constructorType={'stockChart'} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ width: '500px', margin: '10px 50px' }}>
          <h1>Канал V4</h1>
          <div>
            <p>Количество возбуждений: {dataResult.v1.count}</p>
            <p>
              Средний интервал между отдельными возбуждениями:{' '}
              {dataResult.v1.avgInterval.toFixed(1)}
            </p>
          </div>
        </div>
        <div style={{ width: '500px', margin: '10px 50px' }}>
          <h1>Канал Ym</h1>
          <div>
            <p>Количество возбуждений: {dataResult.v2.count}</p>
            <p>
              Средний интервал между отдельными возбуждениями:{' '}
              {dataResult.v2.avgInterval.toFixed(1)}
            </p>
          </div>
        </div>
        <div style={{ width: '500px', margin: '10px 50px' }}>
          <h1>Канал V6</h1>
          <div>
            <p>Количество возбуждений: {dataResult.v3.count}</p>
            <p>
              Средний интервал между отдельными возбуждениями:{' '}
              {dataResult.v3.avgInterval.toFixed(1)}
            </p>
          </div>
        </div>
        <div style={{ width: '500px', margin: '10px 50px' }}>
          <h1>Объединенный сигнал</h1>
          <div>
            <p>Количество возбуждений: {dataResult.combined.count}</p>
            <p>
              Средний интервал между отдельными возбуждениями:{' '}
              {dataResult.combined.avgInterval.toFixed(1)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
