export const preprocessKHO = (signal) => {
  const signalData = signal[0].data.map((obj) => obj[1]);
  const MWMFiltered = mwmFilter(signalData);
  return MWMFiltered;
};

function mwmFilter(signal, fs = 400) {
  const L1 = Math.round(0.1 * fs);
  const L2 = Math.round(0.4 * fs);
  const flen1 = Math.floor(L1 / 2);
  const flen2 = Math.floor(L2 / 2);
  const N = signal.length;

  const ch = Array.from(signal, Number);

  const x1 = movingMedian(ch, flen1);
  const x2 = movingMedian(x1, flen2);
  const filtered = new Array(N);
  for (let i = 0; i < N; i++) filtered[i] = ch[i] - x2[i];

  return filtered;
  function movingMedian(arr, half) {
    const out = new Array(arr.length);
    for (let j = 0; j < arr.length; j++) {
      const start = Math.max(0, j - half);
      const end = Math.min(arr.length - 1, j + half);
      const win = arr.slice(start, end + 1).sort((a, b) => a - b);
      const m = Math.floor(win.length / 2);
      out[j] = win.length % 2 === 1 ? win[m] : 0.5 * (win[m - 1] + win[m]);
    }
    return out;
  }
}
