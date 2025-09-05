import { detectRPeaks } from './signalConversionCMD1';
import { detectECGPeaksStages } from './signalConversionCMD2';
import { detectQRS_JS } from './signalConversionCMD3';
export const analyzeCMD = (signal, type) => {
  const signalTime = signal[0].data.map((obj) => obj[0]);
  const signalData = signal[0].data.map((obj) => obj[1]);
  const transformPeaks = (data) => signalTime.map((item, i) => [item, data.includes(i) ? 100 : 0]);
  let result;
  if (type === 1) {
    const tempResult = detectRPeaks(signalData, 400);
    result = { peaks: transformPeaks(tempResult), data: tempResult };
  } else if (type === 2) {
    const tempResult = detectECGPeaksStages(signalData);
    result = { peaks: transformPeaks(tempResult.indices), data: tempResult.indices };
  } else if (type === 3) {
    const tempResult = detectQRS_JS(signalData, { Fs: 400, ensembleSize: 4, noiseStdFactor: 2 });
    result = { peaks: transformPeaks(tempResult.locs), data: tempResult.locs };
  }
  return result;
};
