import {
  buildEventsFromCrossings,
  deduplicateByEnd,
  detectRPeaks,
  detectThresholdCrossings,
  filterShortEvents,
  getFinalresult,
  getQRSIntervals,
  mergeEventsTwoStage,
  preprocessECG,
} from './SignalConversionZC';
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
  squaring,
  zeroCrossingDetection,
} from './SignalConversionZC2';
import { zeros } from './utils';

export function analyzeECGZC(ecg, fs = 400) {
  const ecgTime = ecg[0].data.map((obj) => obj[0]);
  const ecgData = ecg[0].data.map((obj) => obj[1]);
  const transformEcg = (filtered) => ecgTime.map((item, i) => [item, filtered[i]]);
  const { filter_signal, nonlinear, new_signal } = preprocessECG(ecgData, fs);
  const { locs_pos, locs_neg } = detectThresholdCrossings(new_signal);
  const events = buildEventsFromCrossings(locs_pos, locs_neg);
  const merged = mergeEventsTwoStage(events, 30, 20);
  const dedup = deduplicateByEnd(merged);
  const final_event = filterShortEvents(dedup, 30);
  const peaks = detectRPeaks(final_event, new_signal, fs);
  const qrsIntervals = getQRSIntervals({ locs_pos, locs_neg });
  const {finalPeaks, d,D} = getFinalresult(new_signal, nonlinear)


  return {
    filteredSignal: transformEcg(filter_signal),
    nonlinearizedTransformedSignal: transformEcg(nonlinear),
    highFrequencyComponentAddedToTheSignal: transformEcg(new_signal),
    // zeroCrossingDetection: ecgTime.map((item, i) => {
    //   let includes = false;
    //   for (let j = 0; j < qrsIntervals.length; j++) {
    //     if (i >= qrsIntervals[j][0] && i <= qrsIntervals[j][1]) {
    //       includes = true;
    //       break;
    //     }
    //   }
    //   return includes ? [item, ecgData[i]] : [item, 0];
    // }),
    // peaks: ecgTime.map((item, i) => [item, peaks.RR_indexes.includes(i) ? ecgData[i] : 0]),
    zeroCrossingDetection:transformEcg(D),
    peaks:ecgTime.map((item, i) => [item, finalPeaks.includes(i)&&ecgData[i]>0 ? ecgData[i] : 0])
  };
}

export function analyzeECGZC2(ecg) {
  const ecgTime = ecg[0].data.map((obj) => obj[0]);
  const ecgData = ecg[0].data.map((obj) => obj[1]);
  const transformEcg = (filtered) => ecgTime.map((item, i) => [item, filtered[i]]);
  // const filteredSignal = applyFIRFilter(ecgData);
  // const nonlinearizedTransformedSignal = derivativeFilter(filteredSignal).map((item) => item ** 2);
 
  // const signalWithHF = nonlinearizedTransformedSignal.map((v, i) => v + b[i]);
  // const zeroCrossing = movingWindowIntegration(nonlinearizedTransformedSignal);
  // const { positive, negative, treshold, d } = eventDetection(zeroCrossing);
  // const intervals = findIntervals({ positive });
  // const grouped = groupCloseEvents(intervals);
  // const peaks = determineRPeakAmplitude(zeroCrossing, grouped);

  const bandpassCoeffs = getBandPassCoeffs(100, 0.5, 50, 400);
  const filteredSignal = applyFIRFilter(ecgData, bandpassCoeffs);
  const derivative = derivativeFilter(filteredSignal);
  // const nonlinearizedSignal = squaring(derivative);
  const nonlinearizedSignal = derivative.map((item,i)=>item<0?-(item**2):item**2);
  // const highFreqComponent = filteredSignal.map((v, i) => v + derivative[i]);

  const k = zeros(nonlinearizedSignal.length);
  const lambda = 0.995;
  const gain = 4;
  for (let j = 0; j < nonlinearizedSignal.length - 1; j++) {
    k[j + 1] =
      lambda * k[j] + (1 - lambda) * gain * Math.abs(nonlinearizedSignal[j + 1]);
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
  const finalPeaks = removeClosePeaks(peaksWithAmplitude.map(item=>item.index),peaksWithAmplitude.map(item=>item.amplitude))

  return {
    filteredSignal: transformEcg(filteredSignal),
    nonlinearizedTransformedSignal: transformEcg(nonlinearizedSignal),
    highFrequencyComponentAddedToTheSignal: transformEcg(highFreqComponent),
    zeroCrossingDetection: transformEcg(zeroCrossing),
    peaks: ecgTime.map((item, i) => [
      item,
      finalPeaks.includes(i) ? ecgData[i] : 0,
    ]),
  };
}
