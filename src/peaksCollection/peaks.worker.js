/* eslint-env worker */
/* eslint-disable no-restricted-globals */

import { analyzeATN } from '../ATNAlgorithm/mainSignalConversion.js';
import { analyzeCMD } from '../CMDAlgorithm/mainConversionCMD.js';
import { detectRPeaks } from '../GPTAlgorithm/mainConversionGPT.js';
import { analyzeECGKHO } from '../KHOAlgorithm/mainSignalConversion.js';
import { preprocessSignal } from '../preprocessSignal/preprocessSignal.js';
import { analyzePT } from '../PTAlgorithm/mainConversionPT.js';

const registry = {
  PT: (series) => analyzePT(series).peaks.data,
  PTPlus: (series) => analyzePT(series).peaksPlusPlus.data,
  KHO: (series) => analyzeECGKHO(series).peaks.data,
  ATN: (series) => analyzeATN(series).peaks.data,
  CMD1: (series) => analyzeCMD(series, 1).data,
  CMD2: (series) => analyzeCMD(series, 2).data,
  GPT: (series) => detectRPeaks([{ data: preprocessSignal(series).biggestPreprocess.bp }]).data,
};

addEventListener('message', (e) => {
  const { name, input } = e.data;
  try {
    const fn = registry[name];
    if (!fn) throw new Error(`Unknown task name: ${name}`);
    const result = fn(input);
    postMessage({ ok: true, name, result });
  } catch (err) {
    postMessage({ ok: false, name, error: String(err), stack: err?.stack });
  }
});
