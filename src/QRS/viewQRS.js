import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { getMainOptionsQRS } from './graphOptionsQRS';
import { signalConversion } from './SignalConversionQRS';

function ViewQRS({ series }) {
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
      data: signalConversion(series).getLowPassFilterSignal.series,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'HighPassed',
      data: signalConversion(series).getHighPassFilterSignal.series,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Differentiated',
      data: signalConversion(series).getDifferentiatedSignal.series,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Squared',
      data: signalConversion(series).getSquaredSignal.series,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'MovingWindow',
      data: signalConversion(series).getMovingWindowSignal.series,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Peaks',
      data: signalConversion(series).getRPeaks.series,
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

export default ViewQRS;
