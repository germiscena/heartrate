import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { getMainOptionsZC } from './graphOptionsZC';
import { analyzeECGZC, analyzeECGZC2 } from './mainSignalConversion';
import { useEffect, useState } from 'react';

function ViewZC({ series, variant }) {
  // const [newSeries, setNewSeries] = useState(null);

  const newSeriesFirst = (obj) => {
    return [
      {
        name: 'V4',
        data: obj[0].data,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: 'Filtered Signal',
        data: analyzeECGZC(obj).filteredSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: 'Nonlinear Signal',
        data: analyzeECGZC(obj).nonlinearizedSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: 'Signal with HF',
        data: analyzeECGZC(obj).HFSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: 'Zero crossing detection',
        data: analyzeECGZC(obj).zeroCrossingSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: 'Peaks',
        data: analyzeECGZC(obj).peaks,
        dataGrouping: {
          enabled: false,
        },
      },
    ];
  };

  const newSeriesSecond = (obj) => {
    return [
      {
        name: 'V4',
        data: obj[0].data,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: 'Filtered Signal',
        data: analyzeECGZC2(obj).filteredSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: 'Nonlinear Signal',
        data: analyzeECGZC2(obj).nonlinearizedSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: 'Signal with HF',
        data: analyzeECGZC2(obj).HFSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: 'Zero crossing detection',
        data: analyzeECGZC2(obj).zeroCrossingSignal,
        dataGrouping: {
          enabled: false,
        },
      },
      {
        name: 'Peaks',
        data: analyzeECGZC2(obj).peaks,
        dataGrouping: {
          enabled: false,
        },
      },
    ];
  };

  // useEffect(() => {
  //   if (variant === 1) {
  //     setNewSeries(newSeriesFirst(series));
  //   } else if (variant === 2) {
  //     setNewSeries(newSeriesSecond(series));
  //   }
  // }, [variant, series]);

  // if (newSeries === null) return;

  // const mainOptions = getMainOptionsZC(newSeries);

  const mainOptions = getMainOptionsZC(
    variant === 1 ? newSeriesFirst(series) : newSeriesSecond(series),
  );

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'row', height: '95vh' }}>
        <HighchartsReact
          highcharts={Highcharts}
          options={mainOptions}
          constructorType={'stockChart'}
          containerProps={{ style: { height: '95vh', width: '90vw' } }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100px',
          }}
        >
          <p style={{ fontSize: '14px', marginBottom: '5vh' }}>Исходное значение ЭКГ V4</p>
          <p style={{ fontSize: '14px', marginBottom: '6vh' }}>Filtered signal</p>
          <p style={{ fontSize: '14px', marginBottom: '3vh' }}>Nonlinearized transformed signal</p>
          <p style={{ fontSize: '14px', marginBottom: '5vh' }}>Signal with HF</p>
          <p style={{ fontSize: '14px', marginBottom: '6vh' }}>Zero crossing detection</p>
          <p style={{ fontSize: '14px' }}>Peaks</p>
        </div>
      </div>
    </div>
  );
}

export default ViewZC;
