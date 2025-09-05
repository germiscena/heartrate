import { runTasks } from './workerCalculation';
import { trueTracesForm } from '../allData/trueTracesForm';

export const peaksCollection = async (series) => {
  const taskNames = ['PT', 'PTPlus', 'KHO', 'ATN', 'CMD1', 'CMD2', 'GPT'];
  const results = await runTasks(taskNames, series);
  const allPeaksData = Object.fromEntries(taskNames.map((name, i) => [name, results[i]]));
  const peaksTimings = [['№', ...taskNames]];
  const maxPeaksDetected = taskNames
    .map((item) => allPeaksData[item].length)
    .sort((a, b) => b - a)[0];
  for (let i = 0; i < maxPeaksDetected; i++) {
    const PTpeak = allPeaksData[taskNames[0]][i] * 2.5 || '-';
    const PTPlusPeak = allPeaksData[taskNames[1]][i] * 2.5 || '-';
    const KHOpeak = allPeaksData[taskNames[2]][i] * 2.5 || '-';
    const ATNpeak = allPeaksData[taskNames[3]][i] * 2.5 || '-';
    const CMD1peak = allPeaksData[taskNames[4]][i] * 2.5 || '-';
    const CMD2peak = allPeaksData[taskNames[5]][i] * 2.5 || '-';
    const GPTPeak = allPeaksData[taskNames[6]][i] * 2.5 || '-';
    peaksTimings.push([
      String(i),
      String(PTpeak),
      String(PTPlusPeak),
      String(KHOpeak),
      String(ATNpeak),
      String(CMD1peak),
      String(CMD2peak),
      String(GPTPeak),
    ]);
  }
  const maxItemLength = peaksTimings.flat().sort((a, b) => b.length - a.length)[0].length;
  const convertedPeaksTimings = peaksTimings.map((item) =>
    item.map((string) => {
      let finalString = string;
      if (string.length < maxItemLength) {
        const addSpace = maxItemLength - string.length;

        finalString = ' '.repeat(addSpace) + finalString;
      }
      return finalString;
    }),
  );
  return convertedPeaksTimings;
};

export const peaksCollectionPreprocess = async (series, series2, series3, series4) => {
  const taskNames = ['PT', 'PTPlus', 'KHO', 'ATN', 'CMD1', 'CMD2', 'GPT'];
  const peaksTimings = ['№', ...taskNames];
  const results = await runTasks(taskNames, series);
  const results2 = await runTasks(taskNames, series2);
  const results3 = await runTasks(taskNames, series3);
  const results4 = await runTasks(taskNames, series4);
  const allPeaksData = Object.fromEntries(taskNames.map((name, i) => [name, results[i]]));
  const allPeaksData2 = Object.fromEntries(taskNames.map((name, i) => [name, results2[i]]));
  const allPeaksData3 = Object.fromEntries(taskNames.map((name, i) => [name, results3[i]]));
  const allPeaksData4 = Object.fromEntries(taskNames.map((name, i) => [name, results4[i]]));

  const allPeaksInArray = [
    allPeaksData[taskNames[0]],
    allPeaksData[taskNames[1]],
    allPeaksData[taskNames[2]],
    allPeaksData[taskNames[3]],
    allPeaksData[taskNames[4]],
    allPeaksData[taskNames[5]],
    allPeaksData[taskNames[6]],
    ['|'],
    ['|'],
    allPeaksData2[taskNames[0]],
    allPeaksData2[taskNames[1]],
    allPeaksData2[taskNames[2]],
    allPeaksData2[taskNames[3]],
    allPeaksData2[taskNames[4]],
    allPeaksData2[taskNames[5]],
    allPeaksData2[taskNames[6]],
    ['|'],
    ['|'],
    allPeaksData3[taskNames[0]],
    allPeaksData3[taskNames[1]],
    allPeaksData3[taskNames[2]],
    allPeaksData3[taskNames[3]],
    allPeaksData3[taskNames[4]],
    allPeaksData3[taskNames[5]],
    allPeaksData3[taskNames[6]],
    ['|'],
    ['|'],
    allPeaksData4[taskNames[0]],
    allPeaksData4[taskNames[1]],
    allPeaksData4[taskNames[2]],
    allPeaksData4[taskNames[3]],
    allPeaksData4[taskNames[4]],
    allPeaksData4[taskNames[5]],
    allPeaksData4[taskNames[6]],
  ];

  const convertArray = (arr) => {
    const maxLength = arr.map((item) => item.length).sort((a, b) => b - a)[0];
    const finalArr = [];
    for (let i = 0; i < maxLength; i++) {
      const singleArrFromFinalArr = [];
      singleArrFromFinalArr.push(i);
      for (let j = 0; j < arr.length; j++) {
        if (arr[j][0] == '|') {
          singleArrFromFinalArr.push('|');
        } else if (!!arr[j][i]) {
          singleArrFromFinalArr.push(arr[j][i]);
        } else {
          singleArrFromFinalArr.push(0);
        }
      }
      finalArr.push(singleArrFromFinalArr);
    }
    return finalArr;
  };

  const peaksDetects = [
    [...peaksTimings, '|', ...peaksTimings, '|', ...peaksTimings, '|', ...peaksTimings],
    ...convertArray(allPeaksInArray),
  ];
  return peaksDetects;
};

export const peaksCollectionCompareWithTracesSingle = async (series) => {
  const taskNames = ['PT', 'PTPlus', 'KHO', 'ATN', 'CMD1', 'CMD2', 'GPT'];
  const peaksTimings = ['№', 'I', ...taskNames];
  const results = await runTasks(taskNames, series);
  const allPeaksData = Object.fromEntries(taskNames.map((name, i) => [name, results[i]]));

  const allPeaksInArray = [
    allPeaksData[taskNames[0]],
    allPeaksData[taskNames[1]],
    allPeaksData[taskNames[2]],
    allPeaksData[taskNames[3]],
    allPeaksData[taskNames[4]],
    allPeaksData[taskNames[5]],
    allPeaksData[taskNames[6]],
  ];

  const firstMatchedMoments = matchMoments(trueTracesForm, allPeaksInArray);

  const peaksDetects = [
    [...peaksTimings],
    ...firstMatchedMoments.matches.map((item, i) => [i + 1, ...item]),
  ];
  peaksDetects.push([...peaksTimings]);
  peaksDetects.push(
    ['Extra', '-', ...firstMatchedMoments.extraElements],
    ['Missed', '-', ...firstMatchedMoments.missedMoments],
  );
  return peaksDetects;
};

export const peaksCollectionCompareWithTraces = async (series, series2, series3, series4) => {
  const taskNames = ['PT', 'PTPlus', 'KHO', 'ATN', 'CMD1', 'CMD2', 'GPT'];
  const peaksTimings = ['№', 'I', ...taskNames];
  const results = await runTasks(taskNames, series);
  const results2 = await runTasks(taskNames, series2);
  const results3 = await runTasks(taskNames, series3);
  const results4 = await runTasks(taskNames, series4);
  const allPeaksData = Object.fromEntries(taskNames.map((name, i) => [name, results[i]]));
  const allPeaksData2 = Object.fromEntries(taskNames.map((name, i) => [name, results2[i]]));
  const allPeaksData3 = Object.fromEntries(taskNames.map((name, i) => [name, results3[i]]));
  const allPeaksData4 = Object.fromEntries(taskNames.map((name, i) => [name, results4[i]]));

  const allPeaksInArray = [
    allPeaksData[taskNames[0]],
    allPeaksData[taskNames[1]],
    allPeaksData[taskNames[2]],
    allPeaksData[taskNames[3]],
    allPeaksData[taskNames[4]],
    allPeaksData[taskNames[5]],
    allPeaksData[taskNames[6]],
  ];

  const allPeaksInArray2 = [
    allPeaksData2[taskNames[0]],
    allPeaksData2[taskNames[1]],
    allPeaksData2[taskNames[2]],
    allPeaksData2[taskNames[3]],
    allPeaksData2[taskNames[4]],
    allPeaksData2[taskNames[5]],
    allPeaksData2[taskNames[6]],
  ];
  const allPeaksInArray3 = [
    allPeaksData3[taskNames[0]],
    allPeaksData3[taskNames[1]],
    allPeaksData3[taskNames[2]],
    allPeaksData3[taskNames[3]],
    allPeaksData3[taskNames[4]],
    allPeaksData3[taskNames[5]],
    allPeaksData3[taskNames[6]],
  ];
  const allPeaksInArray4 = [
    allPeaksData4[taskNames[0]],
    allPeaksData4[taskNames[1]],
    allPeaksData4[taskNames[2]],
    allPeaksData4[taskNames[3]],
    allPeaksData4[taskNames[4]],
    allPeaksData4[taskNames[5]],
    allPeaksData4[taskNames[6]],
  ];

  const firstMatchedMoments = matchMoments(trueTracesForm, allPeaksInArray);
  const secondMatchedMoments = matchMoments(trueTracesForm, allPeaksInArray2);
  const thirdMathcedMoments = matchMoments(trueTracesForm, allPeaksInArray3);
  const fourthMathcedMoments = matchMoments(trueTracesForm, allPeaksInArray4);
  // const peaksDetects = [
  //   peaksTimings,
  //   ...firstMatchedMoments.matches.map((item, i) => [i + 1, ...item]),
  //   '|',
  //   ...secondMatchedMoments.matches.map((item, i) => [i + 1, ...item]),
  //   '|',
  //   ...thirdMathcedMoments.matches.map((item, i) => [i + 1, ...item]),
  // ];

  const peaksDetects = [
    [...peaksTimings, ' ', ...peaksTimings, ' ', ...peaksTimings, ' ', ...peaksTimings],
    ...firstMatchedMoments.matches.map((item, i) => [
      i + 1,
      ...item,
      ' ',
      i + 1,
      ...secondMatchedMoments.matches[i],
      ' ',
      i + 1,
      ...thirdMathcedMoments.matches[i],
      ' ',
      i + 1,
      ...fourthMathcedMoments.matches[i],
    ]),
  ];
  peaksDetects.push([
    ...peaksTimings,
    ' ',
    ...peaksTimings,
    ' ',
    ...peaksTimings,
    ' ',
    ...peaksTimings,
  ]);
  peaksDetects.push(
    [
      'Extra',
      '-',
      ...firstMatchedMoments.extraElements,
      ' ',
      'Extra',
      'Savitsky-Golay',
      ...secondMatchedMoments.extraElements,
      ' ',
      'Extra',
      'MWM-LPF-BPF-HPF',
      ...thirdMathcedMoments.extraElements,
      ' ',
      'Extra',
      '|',
      ...fourthMathcedMoments.extraElements,
    ],
    [
      'Missed',
      '-',
      ...firstMatchedMoments.missedMoments,
      ' ',
      'Missed',
      '|',
      ...secondMatchedMoments.missedMoments,
      ' ',
      'Missed',
      '|',
      ...thirdMathcedMoments.missedMoments,
      ' ',
      'Missed',
      '|',
      ...fourthMathcedMoments.missedMoments,
    ],
  );
  return peaksDetects;
};

function matchMoments(idealArr, nonIdealArrays, tolerance = 30, options = {}) {
  const { includeIdealFirst = true, scale = 2.5 } = options;
  const prepared = nonIdealArrays.map((arr) => {
    const data = arr
      .map((orig, i) => ({ val: orig * scale, orig, srcIdx: i }))
      .sort((a, b) => a.val - b.val);
    return {
      data,
      used: new Array(data.length).fill(false),
      picked: new Array(data.length).fill(false),
    };
  });
  function lowerBound(objs, target) {
    let lo = 0,
      hi = objs.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (objs[mid].val < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function findBest(bucket, target) {
    const { data, used } = bucket;
    if (data.length === 0) return null;

    const pos = lowerBound(data, target);
    let left = pos - 1,
      right = pos;
    let best = null;
    while (left >= 0 || right < data.length) {
      const candidates = [];
      if (left >= 0) candidates.push({ idx: left, diff: Math.abs(data[left].val - target) });
      if (right < data.length)
        candidates.push({ idx: right, diff: Math.abs(data[right].val - target) });
      const inTol = candidates.filter((c) => c.diff <= tolerance);

      if (inTol.length === 0) {
        const leftFar = left < 0 || Math.abs(data[left].val - target) > tolerance;
        const rightFar = right >= data.length || Math.abs(data[right].val - target) > tolerance;
        if (leftFar && rightFar) break;
      } else {
        inTol.sort((a, b) => {
          if (a.diff !== b.diff) return a.diff - b.diff;
          const va = data[a.idx].val,
            vb = data[b.idx].val;
          if (va !== vb) return va - vb;
          return a.idx - b.idx;
        });

        for (const cand of inTol) {
          if (!used[cand.idx]) {
            best = { idx: cand.idx, ...data[cand.idx], diff: cand.diff };
            break;
          }
        }
        if (best) break;
      }

      left--;
      right++;
    }

    return best;
  }

  const cols = nonIdealArrays.length + (includeIdealFirst ? 1 : 0);
  const matches = idealArr.map(() => new Array(cols).fill(0));
  const missedMoments = new Array(nonIdealArrays.length).fill(0);
  const extraElements = new Array(nonIdealArrays.length).fill(0);
  idealArr.forEach((ideal, r) => {
    const row = matches[r];
    const offset = includeIdealFirst ? 1 : 0;
    if (includeIdealFirst) row[0] = ideal;

    prepared.forEach((bucket, c) => {
      const best = findBest(bucket, ideal);
      if (best) {
        row[c + offset] = best.val;
        bucket.used[best.idx] = true;
        bucket.picked[best.idx] = true;
      } else {
        row[c + offset] = 0;
        missedMoments[c] += 1;
      }
    });
  });

  prepared.forEach((bucket, c) => {
    const total = bucket.picked.length;
    const pickedCount = bucket.picked.reduce((acc, v) => acc + (v ? 1 : 0), 0);
    extraElements[c] = total - pickedCount;
  });

  return { matches, missedMoments, extraElements };
}
