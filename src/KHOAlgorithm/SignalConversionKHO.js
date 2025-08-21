import { getTopValue } from '../utils';
import { conv, designBandpassForECG, find, removeGroupDelayAfterConv, sign, zeros } from './utils';

function normalize(signal) {
  const maxVal = Math.max(...signal.map(Math.abs)) || 1;
  return signal.map((val) => val / maxVal);
}

export function preprocessECG(ecg, fs = 400) {
  const A = 26;
  const gain = 4;
  const lambda = 0.99;
  const bp = designBandpassForECG({ A, fs, f1: 5, f2: 30 });
  const filter_signal_delay = conv(bp, ecg);
  const filter_signal = removeGroupDelayAfterConv(filter_signal_delay, A);
  const nonlinear = filter_signal.map((v) => sign(v) * v ** 2);
  const K = zeros(nonlinear.length);
  for (let j = 0; j < nonlinear.length - 1; j++) {
    K[j + 1] = lambda * K[j] + (1 - lambda) * gain * Math.abs(nonlinear[j + 1]);
  }
  const b = K.map((v, j) => (j % 2 === 0 ? 1 : -1) * v);
  const new_signal = nonlinear.map((v, i) => v + b[i]);
  return {
    // filter_signal: normalize(filter_signal),
    // nonlinear: normalize(nonlinear),
    // new_signal: normalize(new_signal),
    filter_signal: filter_signal,
    nonlinear: nonlinear,
    new_signal: new_signal,
  };
}

export function detectThresholdCrossings(new_signal) {
  const lambda2 = 0.99;
  const lambda3 = 0.97;
  const d = zeros(new_signal.length);
  const D = zeros(new_signal.length);
  const threshold = zeros(new_signal.length);
  // const d = zeros(new_signal.length);
  // for (let j = 0; j < new_signal.length - 1; j++) {
  //   d[j + 1] = 0.5 * Math.abs(sign(new_signal[j + 1]) - sign(new_signal[j]));
  // }

  // const D = zeros(new_signal.length);
  // for (let j = 0; j < new_signal.length - 1; j++) {
  //   D[j + 1] = lambda2 * D[j] + (1 - lambda2) * d[j + 1];
  // }

  // const threshold = zeros(new_signal.length);
  // for (let j = 0; j < new_signal.length - 1; j++) {
  //   threshold[j + 1] = lambda3 * threshold[j] + (1 - lambda3) * D[j + 1];
  // }

  for (let j = 1; j < new_signal.length; j++) {
    d[j] = 0.5 * Math.abs(Math.sign(new_signal[j]) - Math.sign(new_signal[j - 1]));
  }

  for (let j = 1; j < new_signal.length; j++) {
    D[j] = lambda2 * D[j - 1] + (1 - lambda2) * d[j];
  }

  for (let j = 1; j < new_signal.length; j++) {
    threshold[j] = lambda3 * threshold[j - 1] + (1 - lambda3) * D[j];
  }

  const positive = zeros(D.length);
  const negative = zeros(D.length);
  for (let j = 0; j < D.length; j++) {
    if (D[j] < threshold[j]) {
      positive[j] = 1;
    } else {
      negative[j] = 1;
    }
  }
  const locs_pos = find(positive, (v) => v === 1);
  const locs_neg = find(negative, (v) => v === 1);
  return { D, threshold, locs_pos, locs_neg };
}

export function buildEventsFromCrossings(locs_pos, locs_neg) {
  const diffPos = diffArray(locs_pos);
  const diffNeg = diffArray(locs_neg);
  const indPos = indicesWhere(diffPos, (v) => v > 1).map((i) => i);
  const indNeg = indicesWhere(diffNeg, (v) => v > 1).map((i) => i);

  const upper_limit = indPos.map((i) => locs_pos[i]);
  const lower_limit = indNeg.map((i) => locs_neg[i]);
  const L = Math.min(lower_limit.length, upper_limit.length);
  const events = [];
  for (let j = 0; j < L; j++) {
    const start = Math.min(lower_limit[j], upper_limit[j]);
    const end = Math.max(lower_limit[j], upper_limit[j]);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      events.push([start, end]);
    }
  }
  return events;
}

export function mergeEventsTwoStage(events, gap1Samples = 30, gap2Samples = 20) {
  const pass1 = mergeCloseEvents(events, gap1Samples);
  const pass2 = mergeCloseEvents(pass1, gap2Samples);
  return pass2;
}

export function deduplicateByEnd(events) {
  if (events.length === 0) return events;
  const out = [events[0]];
  for (let i = 1; i < events.length; i++) {
    const prev = out[out.length - 1];
    const cur = events[i];
    if (cur[1] === prev[1]) continue;
    out.push(cur);
  }
  return out;
}

export function filterShortEvents(events, minLenSamples = 30) {
  return events.filter(([a, b]) => b - a >= minLenSamples);
}

function diffArray(arr) {
  const out = new Array(Math.max(0, arr.length - 1));
  for (let i = 0; i < out.length; i++) out[i] = arr[i + 1] - arr[i];
  return out;
}

function indicesWhere(arr, predicate) {
  const idx = [];
  for (let i = 0; i < arr.length; i++) if (predicate(arr[i], i)) idx.push(i);
  return idx;
}

function mergeCloseEvents(events, gapSamples) {
  if (events.length <= 1) return events.slice();
  const sorted = events.slice().sort((a, b) => a[0] - b[0]);

  const merged = [];
  let [curStart, curEnd] = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    const gap = s - curEnd;
    if (gap <= gapSamples) {
      curEnd = Math.max(curEnd, e);
    } else {
      merged.push([curStart, curEnd]);
      [curStart, curEnd] = [s, e];
    }
  }
  merged.push([curStart, curEnd]);
  return merged;
}

export function detectRPeaks(final_event, nonlinear, fs) {
  const abs_nonlinear = nonlinear.map((v) => Math.abs(v));

  const abs_max = [];
  const abs_min = [];

  for (let j = 0; j < final_event.length; j++) {
    const [start, end] = final_event[j];
    const segment = nonlinear.slice(start, end + 1);
    const tempValMax = getTopValue(segment, 'max');
    const tempValMin = getTopValue(segment, 'min');
    const tempValMaxAbs = Math.abs(tempValMax) > Math.abs(tempValMin) ? tempValMax : tempValMin;
    abs_max[j] = tempValMaxAbs;
    abs_min[j] = tempValMin;
  }

  const RR_amp = [];
  for (let j = 0; j < final_event.length; j++) {
    if (abs_min[j] - abs_max[j] > 0.4) {
      RR_amp[j] = abs_min[j];
    } else {
      RR_amp[j] = abs_max[j];
    }
  }

  const RR_location = [];
  for (let j = 0; j < final_event.length; j++) {
    const [start, end] = final_event[j];
    const segment = abs_nonlinear.slice(start, end + 1);
    const peakIndex = segment.findIndex((v) => v === RR_amp[j]);
    if (peakIndex >= 0) {
      RR_location[j] = start + peakIndex;
    }
  }

  const minDistanceSamples = Math.floor(0.25 * fs);
  const keep = new Array(RR_location.length).fill(true);

  for (let j = 0; j < RR_location.length - 1; j++) {
    if (RR_location[j + 1] - RR_location[j] < minDistanceSamples) {
      if (RR_amp[j] < RR_amp[j + 1]) {
        keep[j] = false;
      } else {
        keep[j + 1] = false;
      }
    }
  }

  const RR_indexes = RR_location.filter((_, i) => keep[i]);
  const RR_amp_filtered = RR_amp.filter((_, i) => keep[i]);

  return {
    RR_indexes,
    RR_amp: RR_amp_filtered,
  };
}

export function getQRSIntervals({ locs_pos, locs_neg }) {
  const difference_pos = locs_pos.map((v, i, arr) => (i > 0 ? v - arr[i - 1] : null)).slice(1);
  const difference_neg = locs_neg.map((v, i, arr) => (i > 0 ? v - arr[i - 1] : null)).slice(1);
  const ind_pos = difference_pos.map((v, i) => (v > 1 ? i + 1 : null)).filter((v) => v !== null);
  const ind_neg = difference_neg.map((v, i) => (v > 1 ? i + 1 : null)).filter((v) => v !== null);
  const upper_limit = ind_pos.map((i) => locs_pos[i]);
  const lower_limit = ind_neg.map((i) => locs_neg[i]);
  const events = [];
  const minLen = Math.min(upper_limit.length, lower_limit.length);
  for (let j = 0; j < minLen; j++) {
    if (lower_limit[j] < upper_limit[j]) {
      events.push([lower_limit[j], upper_limit[j]]);
    }
  }
  return events;
}

export function getFinalResult(new_signal, nonlinear) {
  const d = new Array(new_signal.length).fill(0);

  for (let j = 0; j < new_signal.length - 1; j++) {
    d[j + 1] = 0.5 * Math.abs(Math.sign(new_signal[j + 1]) - Math.sign(new_signal[j]));
  }

  const lambda2 = 0.99;
  const D = new Array(new_signal.length).fill(0);

  for (let j = 0; j < new_signal.length - 1; j++) {
    D[j + 1] = lambda2 * D[j] + (1 - lambda2) * d[j + 1];
  }

  const lambda3 = 0.97;
  const threshold = new Array(new_signal.length).fill(0);

  for (let j = 0; j < new_signal.length - 1; j++) {
    threshold[j + 1] = lambda3 * threshold[j] + (1 - lambda3) * D[j + 1];
  }

  const positive = new Array(D.length).fill(0);
  const negative = new Array(D.length).fill(0);

  for (let j = 0; j < d.length; j++) {
    if (d[j] < threshold[j]) {
      positive[j] = 1;
    } else {
      negative[j] = 1;
    }
  }
  const locs_pos = [];
  const locs_neg = [];
  for (let j = 0; j < positive.length; j++) {
    if (positive[j] === 1) locs_pos.push(j);
    if (negative[j] === 1) locs_neg.push(j);
  }

  const difference_pos = [];
  for (let i = 1; i < locs_pos.length; i++) {
    difference_pos.push(locs_pos[i] - locs_pos[i - 1]);
  }

  const difference_neg = [];
  for (let i = 1; i < locs_neg.length; i++) {
    difference_neg.push(locs_neg[i] - locs_neg[i - 1]);
  }

  const ind_pos = [];
  difference_pos.forEach((diff, i) => {
    if (diff > 1) ind_pos.push(i);
  });

  const ind_neg = [];

  difference_neg.forEach((diff, i) => {
    if (diff > 1) ind_neg.push(i);
  });

  const upper_limit = ind_pos.map((i) => locs_pos[i + 1]);
  const lower_limit = ind_neg.map((i) => locs_neg[i + 1]);

  const event = [];

  for (let j = 0; j < upper_limit.length; j++) {
    event.push([lower_limit[j], upper_limit[j]]);
  }
  const new_event = [];
  const dist_event = [];

  for (let j = 0; j < event.length - 1; j++) {
    dist_event.push(event[j + 1][0] - event[j][1]);

    if (dist_event[j] <= 30) {
      new_event.push([event[j][0], event[j + 1][1]]);
    } else {
      new_event.push(event[j]);
      if (j === event.length - 2) {
        new_event.push(event[event.length - 1]);
      }
    }
  }

  const new_new_event = [];
  const new_dist_event = [];
  for (let j = 0; j < new_event.length - 1; j++) {
    new_dist_event.push(new_event[j + 1][0] - new_event[j][1]);

    // if (new_dist_event[j] < 20) {
    //   continue;
    // } else {
    new_new_event.push(new_event[j]);
    if (j === new_event.length - 2) {
      new_new_event.push(new_event[new_event.length - 1]);
      // }
    }
  }
  const new_new_event_filtered = new_new_event.filter((item) => item !== null);
  for (let j = 0; j < new_new_event.length - 1; j++) {
    if (new_new_event_filtered[j][1] === new_new_event_filtered[j + 1][1]) {
      new_new_event[j + 1] = null;
    }
  }

  const filtered_events = new_new_event.filter((e) => e !== null);

  const final_event = [];
  for (let j = 0; j < filtered_events.length; j++) {
    const start = filtered_events[j][0];
    const end = filtered_events[j][1];
    const event_size = end - start;

    if (event_size >= 30) {
      final_event.push([start, end]);
    }
  }

  const abs_max = [];
  const abs_min = [];
  for (let j = 0; j < final_event.length; j++) {
    const [start, end] = final_event[j];
    const segment = nonlinear.slice(start, end + 1).filter((item) => item > 0);
    abs_max.push(getTopValue(segment, 'max'));
    abs_min.push(getTopValue(segment, 'min'));
  }

  const RR_amp = [];
  for (let j = 0; j < final_event.length; j++) {
    if (abs_min[j] - abs_max[j] > 10) {
      RR_amp.push(abs_min[j]);
    } else {
      RR_amp.push(abs_max[j]);
    }
  }

  // const abs_nonlinear = nonlinear.map(Math.abs);  !!!!!!
  const abs_nonlinear = nonlinear.map((item) => (item > 0 ? item : 0));
  const RR_location = [];

  for (let j = 0; j < final_event.length; j++) {
    const [start, end] = final_event[j];
    const segment = abs_nonlinear.slice(start, end + 1);
    const idx = segment.findIndex((value) => value === RR_amp[j]);
    RR_location.push(start + idx);
  }

  const RR_amp_values = RR_location.map((idx) => abs_nonlinear[idx]);

  let RR_time = [...RR_location];

  for (let j = 0; j < RR_time.length - 1; j++) {
    const minDistance = 100;
    if (RR_time[j + 1] - RR_time[j] < minDistance) {
      if (RR_amp_values[j] < RR_amp_values[j + 1]) {
        RR_time[j] = null;
      } else {
        RR_time[j + 1] = null;
      }
    }
  }

  return { finalPeaks: (RR_time = RR_time.filter((v) => v !== null)), d, D, threshold };
}
