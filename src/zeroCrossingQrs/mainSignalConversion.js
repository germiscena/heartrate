import { getFinalResult, preprocessECG } from './SignalConversionZC';
import {
  applyFIRFilter,
  derivativeFilter,
  determineRPeakAmplitude,
  eventDetection,
  findIntervals,
  findRPeakLocations,
  getBandPassCoeffs,
  groupCloseEvents,
  movingWindowIntegration,
  removeClosePeaks,
  zeroCrossingDetection,
} from './SignalConversionZC2';
import { zeros } from './utils';

export function analyzeECGZC(ecg, fs = 400) {
  const ecgTime = ecg[0].data.map((obj) => obj[0]);
  const ecgData = ecg[0].data.map((obj) => obj[1]);
  const transformSignal = (filtered) => ecgTime.map((item, i) => [item, filtered[i]]);
  const { filter_signal, nonlinear, new_signal } = preprocessECG(ecgData, fs);
  const { finalPeaks, d, D, threshold } = getFinalResult(new_signal, nonlinear, ecgData);
  return {
    filteredSignal: transformSignal(filter_signal),
    nonlinearizedSignal: transformSignal(nonlinear),
    HFSignal: transformSignal(new_signal),
    zeroCrossingSignal: transformSignal(D),
    peaks: ecgTime.map((item, i) => [
      item,
      finalPeaks.includes(i) && ecgData[i] > 0 ? ecgData[i] : 0,
    ]),
  };
}

export function analyzeECGZC2(ecg) {
  const ecgTime = ecg[0].data.map((obj) => obj[0]);
  const ecgData = ecg[0].data.map((obj) => obj[1]);
  const transformSignal = (filtered) => ecgTime.map((item, i) => [item, filtered[i]]);

  const bandpassCoeffs = getBandPassCoeffs(100, 0.5, 50, 400);
  const filteredSignal = applyFIRFilter(ecgData, bandpassCoeffs);
  const derivative = derivativeFilter(filteredSignal);
  const nonlinearizedSignal = derivative.map((item, i) => (item < 0 ? -(item ** 2) : item ** 2));

  const k = zeros(nonlinearizedSignal.length);
  const lambda = 0.995;
  const gain = 4;
  for (let j = 0; j < nonlinearizedSignal.length - 1; j++) {
    k[j + 1] = lambda * k[j] + (1 - lambda) * gain * Math.abs(nonlinearizedSignal[j + 1]);
  }
  const b = k.map((v, j) => (j % 2 === 0 ? 1 : -1) * v);

  const highFreqComponent = nonlinearizedSignal.map((v, i) => v + b[i]);
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
    peaks: ecgTime.map((item, i) => [item, finalPeaks.includes(i) ? ecgData[i] : 0]),
  };
}
