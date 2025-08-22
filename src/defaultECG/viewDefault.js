import HighchartsReact from "highcharts-react-official";
import { getMainOptions } from "./graphOptions";
import Highcharts from "highcharts/highstock";

const ViewDefault = ({ series, uploadedSeriesPage }) => {
  const mainOptions = getMainOptions(series, uploadedSeriesPage);

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={mainOptions}
      constructorType={"stockChart"}
      containerProps={{ style: { height: "94vh", width: "98vw" } }}
    />
  );
};

export default ViewDefault;
