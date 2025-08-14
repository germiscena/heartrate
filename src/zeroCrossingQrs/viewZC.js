import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { getMainOptionsZC } from './graphOptionsZC';
import { analyzeECGZC, analyzeECGZC2 } from './mainSignalConversion';
import { signalConversionZeroCross } from './SignalConversionZC2';
import { useEffect, useState } from 'react';

function ViewZC({ series, variant }) {
  const newSeriesFirst = [
    {
      name: 'V4',
      data: series[0].data,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Filtered Signal',
      data: analyzeECGZC(series).filteredSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Nonlinear Signal',
      data: analyzeECGZC(series).nonlinearizedTransformedSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Signal with HF',
      data: analyzeECGZC(series).highFrequencyComponentAddedToTheSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Zero crossing detection',
      data: analyzeECGZC(series).zeroCrossingDetection,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Peaks',
      data: analyzeECGZC(series).peaks,
      dataGrouping: {
        enabled: false,
      },
    },
  ];

  const newSeriesSecond = [
    {
      name: 'V4',
      data: series[0].data,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Filtered Signal',
      data: analyzeECGZC2(series).filteredSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Nonlinear Signal',
      data: analyzeECGZC2(series).nonlinearizedTransformedSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Signal with HF',
      data: analyzeECGZC2(series).highFrequencyComponentAddedToTheSignal,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Zero crossing detection',
      data: analyzeECGZC2(series).zeroCrossingDetection,
      dataGrouping: {
        enabled: false,
      },
    },
    {
      name: 'Peaks',
      data: analyzeECGZC2(series).peaks,
      dataGrouping: {
        enabled: false,
      },
    },
  ];

  const mainOptions = getMainOptionsZC(variant === 1 ? newSeriesFirst : newSeriesSecond);
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
