import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { getMainOptionsQRS } from './graphOptionsPT';
import { analyzePT } from './mainConversionPT';

function ViewPT({ series }) {
  const newSeries = [
    {
      name: 'V4',
      data: series[0].data,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'LowPassed',
      data: analyzePT(series).lowPassSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'HighPassed',
      data: analyzePT(series).highPassSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Differentiated',
      data: analyzePT(series).differentiatedSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Squared',
      data: analyzePT(series).squaredSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'MovingWindow',
      data: analyzePT(series).movingWindowSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Peaks',
      data: analyzePT(series).peaks.series,
      dataGrouping: {
        enabled: false,
      },
    },
  ];

  const mainOptions = getMainOptionsQRS(newSeries);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '95vh' }}>
      <HighchartsReact
        highcharts={Highcharts}
        options={mainOptions}
        constructorType={'stockChart'}
        containerProps={{ style: { height: '95vh', width: '87vw' } }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '80%',
          justifyContent: 'space-evenly',
          minWidth: '180px',
        }}
      >
        <p style={{ fontSize: '14px' }}>Исходное значение ЭКГ V4</p>
        <p style={{ fontSize: '14px' }}>Low Pass Filter</p>
        <p style={{ fontSize: '14px' }}>High Pass Filter</p>
        <p style={{ fontSize: '14px' }}>Differentiated</p>
        <p style={{ fontSize: '14px' }}>Squared</p>
        <p style={{ fontSize: '14px' }}>Moving Window</p>
        <p style={{ fontSize: '14px' }}>Peaks</p>
      </div>
    </div>
  );
}

export default ViewPT;
