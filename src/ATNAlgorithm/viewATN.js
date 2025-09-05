import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { analyzeATN } from './mainSignalConversion';
import { getMainOptions } from '../utils';

function ViewATN({ series, uploadedSeriesPage }) {
  const covertedSignal = analyzeATN(series);

  const newSeries = [
    {
      name: 'V4',
      data: series[0].data,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Peaks',
      data: covertedSignal.peaks.series,
      dataGrouping: {
        enabled: false,
      },
    },
  ];

  const mainOptions = getMainOptions(newSeries, uploadedSeriesPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '95vh' }}>
      <HighchartsReact
        highcharts={Highcharts}
        options={mainOptions}
        constructorType={'stockChart'}
        containerProps={{ style: { height: '95vh', width: '95vw' } }}
      />
    </div>
  );
}

export default ViewATN;
