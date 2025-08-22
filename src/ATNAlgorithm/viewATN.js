import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import { getMainOptionsATN } from "./graphOptionsATN";
import { analyzeATN } from "./mainSignalConversion";

function ViewATN({ series, uploadedSeriesPage }) {
  const covertedSignal = analyzeATN(series);

  const newSeries = [
    {
      name: "V4",
      data: series[0].data,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: "Filtered signal, 7.8-15.7 Hz",
      data: covertedSignal.filteredSignal1,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: "Filtered signal, 15.7-23.5 Hz",
      data: covertedSignal.filteredSignal2,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: "Filtered signal, 23.5-31.3 Hz",
      data: covertedSignal.filteredSignal3,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: "Filtered signal, 31.3-39.2 Hz",
      data: covertedSignal.filteredSignal4,

      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: "Peaks",
      data: covertedSignal.peaks.series,
      dataGrouping: {
        enabled: false,
      },
    },
  ];

  const mainOptions = getMainOptionsATN(newSeries, uploadedSeriesPage);

  return (
    <div style={{ display: "flex", flexDirection: "row", height: "95vh" }}>
      <HighchartsReact
        highcharts={Highcharts}
        options={mainOptions}
        constructorType={"stockChart"}
        containerProps={{ style: { height: "95vh", width: "87vw" } }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "80%",
          justifyContent: "space-evenly",
          minWidth: "180px",
        }}
      >
        <p style={{ fontSize: "14px" }}>Исходное значение ЭКГ</p>
        <p style={{ fontSize: "14px" }}>Filtered signal, 7.8-15.7 Hz</p>
        <p style={{ fontSize: "14px" }}>Filtered signal, 15.7-23.5 Hz</p>
        <p style={{ fontSize: "14px" }}>Filtered signal, 23.5-31.3 Hz</p>
        <p style={{ fontSize: "14px" }}>Filtered signal, 31.3-39.2 Hz</p>
        <p style={{ fontSize: "14px" }}>Peaks</p>
      </div>
    </div>
  );
}

export default ViewATN;
