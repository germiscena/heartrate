import {
  getDifferentiatedSignal,
  getHighPassFilterSignal,
  getLowPassFilterSignal,
  getMovingWindowSignal,
  getRPeaks,
  getSquaredSignal,
} from './signalConversionPT';

export const analyzePT = (signal) => {
  const signalTime = signal[0].data.map((obj) => obj[0]);
  const signalData = signal[0].data.map((obj) => obj[1]);
  const signalTransform = (data) => signalTime.map((item, i) => [item, data[i]]);
  const lowPassSignal = getLowPassFilterSignal(signalData);
  const highPassSignal = getHighPassFilterSignal(lowPassSignal);
  const differentiatedSignal = getDifferentiatedSignal(highPassSignal);
  const squaredSignal = getSquaredSignal(differentiatedSignal);
  const movingWindowSignal = getMovingWindowSignal(squaredSignal);
  const peaks = getRPeaks(movingWindowSignal, signalData);

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
  };
};
