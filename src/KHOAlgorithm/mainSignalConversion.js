import { getFinalResult, processSignal } from './SignalConversionKHO';
import { preprocessKHO } from './preprocessKHO';

export function analyzeECGKHO(signal, fs = 400) {
  const signalTime = signal[0].data.map((obj) => obj[0]);
  const signalData = signal[0].data.map((obj) => obj[1]);
  const transformSignal = (filtered) => signalTime.map((item, i) => [item, filtered[i]]);
  const preFiltered = preprocessKHO(signal);
  const { filter_signal, nonlinear, new_signal } = processSignal(preFiltered, fs);
  const { finalPeaks, D } = getFinalResult(new_signal, nonlinear, preFiltered);
  return {
    filteredSignal: transformSignal(filter_signal),
    nonlinearizedSignal: transformSignal(nonlinear),
    HFSignal: transformSignal(new_signal),
    zeroCrossingSignal: transformSignal(D),
    preFiltered: transformSignal(preFiltered),
    peaks: {
      series: signalTime.map((item, i) => [
        item,
        finalPeaks.includes(i) && signalData[i] > 0 ? 50 : 0,
      ]),
      data: finalPeaks,
    },
  };
}
