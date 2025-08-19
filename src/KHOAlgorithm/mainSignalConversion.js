import { getFinalResult, preprocessECG } from './SignalConversionKHO';
import {
  applyFIRFilter,
  derivativeFilter,
  determineRPeakAmplitude,
  eventDetection,
  findIntervals,
  findRPeakLocations,
  getBandPassCoeffs,
  getHighFreqSignal,
  getNonlinearizedSignal,
  groupCloseEvents,
  movingWindowIntegration,
  removeClosePeaks,
  zeroCrossingDetection,
} from './SignalConversionKHO2';

export function analyzeECGKHO(signal, fs = 400) {
  const signalTime = signal[0].data.map((obj) => obj[0]);
  const signalData = signal[0].data.map((obj) => obj[1]);
  const transformSignal = (filtered) => signalTime.map((item, i) => [item, filtered[i]]);
  const { filter_signal, nonlinear, new_signal } = preprocessECG(signalData, fs);
  const { finalPeaks, d, D, threshold } = getFinalResult(new_signal, nonlinear, signalData);
  return {
    filteredSignal: transformSignal(filter_signal),
    nonlinearizedSignal: transformSignal(nonlinear),
    HFSignal: transformSignal(new_signal),
    zeroCrossingSignal: transformSignal(D),
    peaks: {
      series: signalTime.map((item, i) => [
        item,
        finalPeaks.includes(i) && signalData[i] > 0 ? 50 : 0,
      ]),
      data: finalPeaks,
    },
  };
}

export function analyzeECGKHO2(signal) {
  const signalTime = signal[0].data.map((obj) => obj[0]);
  const signalData = signal[0].data.map((obj) => obj[1]);
  const transformSignal = (filtered) => signalTime.map((item, i) => [item, filtered[i]]);

  const filteredSignal = applyFIRFilter(signalData);
  const derivative = derivativeFilter(filteredSignal);
  const nonlinearizedSignal = getNonlinearizedSignal(derivative);

  const highFreqComponent = getHighFreqSignal(nonlinearizedSignal);
  const zeroCrossing = zeroCrossingDetection(highFreqComponent);

  const integratedSignal = movingWindowIntegration(highFreqComponent);
  const events = eventDetection(integratedSignal);
  const intervals = findIntervals(events.positive);
  const groupedEvents = groupCloseEvents(intervals);
  const peaksWithAmplitude = determineRPeakAmplitude(filteredSignal, groupedEvents);
  const peakLocations = findRPeakLocations(filteredSignal, peaksWithAmplitude);
  const finalPeaks = removeClosePeaks(
    peaksWithAmplitude.map((item) => item.index),
    peaksWithAmplitude.map((item) => item.amplitude),
  );

  return {
    filteredSignal: transformSignal(filteredSignal),
    nonlinearizedSignal: transformSignal(nonlinearizedSignal),
    HFSignal: transformSignal(highFreqComponent),
    zeroCrossingSignal: transformSignal(zeroCrossing),
    peaks: {
      series: signalTime.map((item, i) => [item, finalPeaks.includes(i) ? 50 : 0]),
      data: finalPeaks,
    },
  };
}
