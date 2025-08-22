import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import { getMainOptionsKHO } from "./graphOptionsKHO";
import { analyzeECGKHO } from "./mainSignalConversion";

function ViewKHO({ series, uploadedSeriesPage }) {
  const newSeries = (obj) => {
    return [
      {
        name: "V4",
        data: obj[0].data,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: "Filtered Signal",
        data: analyzeECGKHO(obj).filteredSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: "Nonlinear Signal",
        data: analyzeECGKHO(obj).nonlinearizedSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: "Signal with HF",
        data: analyzeECGKHO(obj).HFSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: "Zero crossing detection",
        data: analyzeECGKHO(obj).zeroCrossingSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: "Peaks",
        data: analyzeECGKHO(obj).peaks.series,
        dataGrouping: {
          enabled: false,
        },
      },
    ];
  };

  const mainOptions = getMainOptionsKHO(newSeries(series), uploadedSeriesPage);

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "row", height: "95vh" }}>
        <HighchartsReact
          highcharts={Highcharts}
          options={mainOptions}
          constructorType={"stockChart"}
          containerProps={{ style: { height: "95vh", width: "90vw" } }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100px",
          }}
        >
          <p style={{ fontSize: "14px", marginBottom: "5vh" }}>Исходное значение ЭКГ V4</p>
          <p style={{ fontSize: "14px", marginBottom: "6vh" }}>Filtered signal</p>
          <p style={{ fontSize: "14px", marginBottom: "3vh" }}>Nonlinearized transformed signal</p>
          <p style={{ fontSize: "14px", marginBottom: "5vh" }}>Signal with HF</p>
          <p style={{ fontSize: "14px", marginBottom: "6vh" }}>Zero crossing detection</p>
          <p style={{ fontSize: "14px" }}>Peaks</p>
        </div>
      </div>
    </div>
  );
}

export default ViewKHO;
