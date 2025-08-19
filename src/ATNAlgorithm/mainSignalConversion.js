import { detectRPeaksATN, newDetectRPeaksATN } from './detectRPeaks';
import { runFilterBank } from './SignalConversionATN';

export const analyzeATN = (signal) => {
  const signalTime = signal[0].data.map((obj) => obj[0]);
  const signalData = signal[0].data.map((obj) => obj[1]);
  const signalTransform = (data) => signalTime.map((item, i) => [item, data[i]]);
  const [filteredSignal1, filteredSignal2, filteredSignal3, filteredSignal4] =
    runFilterBank(signalData).filtered;
  // const finalPeaks = detectRPeaksATN(signalData, runFilterBank(signalData).filtered);
  const newPeaks = newDetectRPeaksATN(signalData, runFilterBank(signalData).filtered);
  return {
    filteredSignal1: signalTransform(filteredSignal1),
    filteredSignal2: signalTransform(filteredSignal2),
    filteredSignal3: signalTransform(filteredSignal3),
    filteredSignal4: signalTransform(filteredSignal4),
    peaks: {
      series: signalTime.map((item, i) => [item, newPeaks.includes(i) ? 50 : 0]),
      data: newPeaks,
    },
  };
};
