import {
  getDifferentiatedSignal,
  getHighPassFilterSignal,
  getLowPassFilterSignal,
  getMovingWindowSignal,
  getRPeaks,
  getSquaredSignal,
} from './signalConversionPT';
import { Pan_Tompkins_Plus_Plus_Plus } from './signalConversionPT+++';

export const analyzePT = (signal) => {
  const signalTime = signal[0].data.map((obj) => obj[0]);
  const signalData = signal[0].data.map((obj) => obj[1]);
  const signalTransform = (data) => signalTime.map((item, i) => [item, data[i]]);
  const lowPassSignal = getLowPassFilterSignal(signalData);
  const highPassSignal = getHighPassFilterSignal(lowPassSignal);
  const differentiatedSignal = getDifferentiatedSignal(signalData);
  const squaredSignal = getSquaredSignal(differentiatedSignal);
  const movingWindowSignal = getMovingWindowSignal(squaredSignal);
  const peaks = getRPeaks(movingWindowSignal, signalData);

  const newDetector = new Pan_Tompkins_Plus_Plus_Plus();
  const peaksPlusPlus = newDetector.rpeak_detection(signalData, 400);

  return {
    lowPassSignal: signalTransform(lowPassSignal),
    highPassSignal: signalTransform(highPassSignal),
    differentiatedSignal: signalTransform(differentiatedSignal),
    squaredSignal: signalTransform(squaredSignal),
    movingWindowSignal: signalTransform(movingWindowSignal),
    peaks: {
      series: signalTime.map((item, i) => [item, peaks.includes(i) ? 50 : 0]),
      data: peaks,
    },
    peaksPlusPlus: {
      series: signalTime.map((item, i) => [item, peaksPlusPlus.includes(i) ? 50 : 0]),
      data: peaksPlusPlus,
    },
  };
};
