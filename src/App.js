import { graphData } from './data';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { analyzeExcitations, parseArrayData } from './utils';
import { getCalibrationOptions, getMainOptions } from './graphOptions';

function App() {
  const series = parseArrayData(graphData);

  const dataResult = analyzeExcitations(graphData);

  const mainOptions = getMainOptions(series);

  const calibrationOptions = getCalibrationOptions();
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <HighchartsReact
          highcharts={Highcharts}
          options={calibrationOptions}
          constructorType={'stockChart'}
          containerProps={{
            style: { height: '80vh', width: '8vw', minWidth: '50px' },
          }}
        />
        <HighchartsReact
          highcharts={Highcharts}
          options={mainOptions}
          constructorType={'stockChart'}
          containerProps={{ style: { height: '80vh', width: '91vw' } }}
        />
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
          <h3>Масштаб 1 клетки - 0.04 сек/100мкВ</h3>
        </div>
        <div style={{ width: '500px', margin: '10px 50px 0px 50px' }}>
          <h3>Объединенный сигнал</h3>
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
