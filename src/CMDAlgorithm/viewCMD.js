import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { analyzeCMD } from './mainConversionCMD';
import { getMainOptions } from '../utils';

function ViewCMD({ series, uploadedSeriesPage, type }) {
  const analyzedData = analyzeCMD(series, type);
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
      data: analyzedData.peaks,
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

export default ViewCMD;
