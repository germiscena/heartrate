import { graphData } from './data';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { analyzeExcitations, parseArrayData } from './utils';
import { getCalibrationOptions, getMainOptions, getMainOptionsNew } from './graphOptions';
import {
  getDifferentiatedSignal,
  getHighPassFilterSignal,
  getMovingWindowSignal,
  getRPeaks,
  getSquaredSignal,
} from './SignalConversion';

function App() {
  const series = parseArrayData(graphData);
  const dataResult = analyzeExcitations(graphData);
  // const mainOptions = getMainOptions(series);

  const newSeries = [
    {
      name: 'V4',
      data: series[0].data,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Bandpassed',
      data: getHighPassFilterSignal().series,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Differentiated',
      data: getDifferentiatedSignal().series,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Squared',
      data: getSquaredSignal().series,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'MovingWindow',
      data: getMovingWindowSignal().series,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Peaks',
      data: getRPeaks().series,
      dataGrouping: {
        enabled: false,
      },
    },
  ];

  const mainOptionsNew = getMainOptionsNew(newSeries);
  // const calibrationOptions = getCalibrationOptions();
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'row', height: '100vh' }}>
        {/* <HighchartsReact
          highcharts={Highcharts}
          options={calibrationOptions}
          constructorType={'stockChart'}
          containerProps={{
            style: { height: '80vh', width: '8vw', minWidth: '50px' },
          }}
        /> */}
        <HighchartsReact
          highcharts={Highcharts}
          options={mainOptionsNew}
          constructorType={'stockChart'}
          containerProps={{ style: { height: '100vh', width: '90vw' } }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '85%',
            justifyContent: 'space-evenly',
            minWidth: '180px',
          }}
        >
          <p style={{ fontSize: '14px' }}>Исходное значение ЭКГ V4</p>
          <p style={{ fontSize: '14px' }}>High Pass Filter</p>
          <p style={{ fontSize: '14px' }}>Differentiated</p>
          <p style={{ fontSize: '14px' }}>Squared</p>
          <p style={{ fontSize: '14px' }}>Moving Window</p>
          <p style={{ fontSize: '14px' }}>Peaks</p>
        </div>
      </div>
      {/* <div
        style={{
          position: 'absolute',
          right: 20,
          top: '28%',
          color: 'gray',
          transform: 'rotate(-90deg)',
        }}
      >
        мкВ
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0px 100px',
        }}
      >
        <div>
          <h3>Масштаб 1 клетки - 0.05 сек/100мкВ</h3>
        </div>
        <div style={{ width: '500px', margin: '10px 50px 0px 50px' }}>
          <h3>Объединенный сигнал</h3>
          <div>
            <p>Количество возбуждений: {dataResult.combined.count}</p>
            <p>
              Средний интервал между отдельными возбуждениями:{' '}
              {Math.round(dataResult.combined.avgInterval) / 1000} сек
            </p>
          </div>
        </div>
      </div> */}
    </div>
  );
}

export default App;
