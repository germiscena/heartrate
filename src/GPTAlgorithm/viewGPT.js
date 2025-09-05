import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { detectRPeaks } from '../GPTAlgorithm/mainConversionGPT';
import { getMainOptions } from '../utils';

function ViewGPT({ series, uploadedSeriesPage }) {
  const analyzedGPT = detectRPeaks(series);
  const newSeries = [
    {
      name: 'V4',
      data: series[0].data,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'PEAKS',
      data: analyzedGPT.series,
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

export default ViewGPT;
