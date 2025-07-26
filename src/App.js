import { graphData } from './data';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { analyzeExcitations, parseArrayData } from './utils';

function App() {
  const series = parseArrayData(graphData);

  const dataResult = analyzeExcitations(graphData);

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
