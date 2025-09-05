import { biggestPreprocessFilter } from './biggestPreprocess';
import {
  hpFilterMatlab,
  lpFilterMatlab,
  mwmFilter,
  notch50HzCombFILT,
  savGolayFilter,
} from './mainConversions';

export const preprocessSignal = (signal) => {
  const signalData = signal[0].data.map((item) => item[1]);
  const signalTime = signal[0].data.map((item) => item[0]);
  const transformData = (data) => signalTime.map((item, i) => [item, data[i]]);
  const mvmFiltered = mwmFilter(signalData);
  const lowPassFilteredML = lpFilterMatlab(mvmFiltered);
  const highPassFilteredML = hpFilterMatlab(lowPassFilteredML);
  const notchFilteredML = notch50HzCombFILT(highPassFilteredML);
  const savGolayFilteredMLC = savGolayFilter(lowPassFilteredML, 'centered');
  const biggestPreprocess = biggestPreprocessFilter(signalData);

  return {
    mvmFiltered: transformData(mvmFiltered),
    lowPassFilteredML: transformData(lowPassFilteredML),
    highPassFilteredML: transformData(highPassFilteredML),
    notchFilteredML: transformData(notchFilteredML),
    savGolayFilteredMLC: transformData(savGolayFilteredMLC),
    biggestPreprocess: {
      bp: transformData(biggestPreprocess.bp),
      detrended: transformData(biggestPreprocess.detrended),
    },
  };
};
