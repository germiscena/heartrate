import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { analyzeECGKHO } from './mainSignalConversion';
import { getMainOptions } from '../utils';

function ViewKHO({ series, uploadedSeriesPage }) {
  const analyzedData = analyzeECGKHO(series);
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
      data: analyzedData.peaks.series,
      dataGrouping: {
        enabled: false,
      },
    },
  ];
  const mainOptions = getMainOptions(newSeries, uploadedSeriesPage);

  return (
    <div>
      <HighchartsReact
        highcharts={Highcharts}
        options={mainOptions}
        constructorType={'stockChart'}
        containerProps={{ style: { height: '95vh', width: '95vw' } }}
      />
    </div>
  );
}

export default ViewKHO;
