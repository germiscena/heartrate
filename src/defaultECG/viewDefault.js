import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts/highstock';
import { getMainOptions } from '../utils';

const ViewDefault = ({ series, uploadedSeriesPage }) => {
  const mainOptions = getMainOptions(series, uploadedSeriesPage);
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={mainOptions}
      constructorType={'stockChart'}
      containerProps={{ style: { height: '95vh', width: '95vw' } }}
    />
  );
};

export default ViewDefault;
