import {
  adaptivePeakPick,
  bandpassQRS,
  fuseCandidates,
  keepHillsOnlyV2,
  ptFeature,
  refineOnRaw,
  removeBaseline,
  robustNormalize,
  rrPostprocess,
  tkeoCandidatePeaks,
  tkeoFeature,
} from './signalConversionGPT';
import { toFloat32 } from './utils';

export function detectRPeaks(signal, opts = {}) {
  const fs = 400;
  const signalData = signal[0].data.map((item) => item[1]);
  const signalTime = signal[0].data.map((item) => item[0]);
  const x0 = toFloat32(signalData);
  const xBaseRemoved = removeBaseline(x0, fs, opts.baseline || { method: 'hp' });
  const xBP = bandpassQRS(xBaseRemoved, fs, opts.bandpass || { hp: 8, lp: 40 });
  const xNR =
    robustNormalize(xBP, opts.normalize || {}).signal || robustNormalize(xBP, opts.normalize || {});
  const wPT = ptFeature(xNR, fs, opts.pt || {});
  const sTKEO = tkeoFeature(xNR, fs, opts.tkeo || {});
  const candPT = adaptivePeakPick(wPT, fs, opts.pick || {});
  const candTK = tkeoCandidatePeaks(
    xNR,
    fs,
    Object.assign({ returnFeature: false }, opts.tkeoPick || {}),
  );
  const fusedMeta = fuseCandidates([candPT, candTK], fs, {
    feats: [wPT, sTKEO],
    xRef: xNR,
    mergeTolMs: (opts.fuse && opts.fuse.mergeTolMs) || 100,
    returnMeta: true,
  });
  const fusedIdx = fusedMeta.indices;
  const refined = refineOnRaw(x0, fusedIdx, fs, { xBandpass: xBP, ...(opts.refine || {}) });
  const rr = rrPostprocess(xNR, refined, fs, { feat: wPT, ...(opts.rr || {}) });
  const rClean = keepHillsOnlyV2(xNR, rr, fs);
  return {
    series: signalTime.map((item, i) => [item, rClean.includes(i) ? 100 : 0]),
    data: Array.from(rClean),
  };
}
