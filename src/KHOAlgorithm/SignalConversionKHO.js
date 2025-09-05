import { getTopValue } from '../utils';
import { conv, designBandpassForECG, removeGroupDelayAfterConv, sign, zeros } from './utils';

export function processSignal(ecg, fs = 400) {
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
    filter_signal: filter_signal,
    nonlinear: nonlinear,
    new_signal: new_signal,
  };
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

    new_new_event.push(new_event[j]);
    if (j === new_event.length - 2) {
      new_new_event.push(new_event[new_event.length - 1]);
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
