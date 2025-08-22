import { analyzeATN } from "../ATNAlgorithm/mainSignalConversion";
import { analyzeECGKHO } from "../KHOAlgorithm/mainSignalConversion";
import { analyzePT } from "../PTAlgorithm/mainConversionPT";

export const peaksCollection = (series) => {
  const seriesData = series.map((item) => item[1]);
  const seriesTime = series.map((item) => item[0]);

  const PTPeaks = analyzePT(series).peaks.data;
  const KHOPeaks = analyzeECGKHO(series).peaks.data;
  const ATNPeaks = analyzeATN(series).peaks.data;
  const peaksTimings = [["№", "PT", "KHO", "ATN"]];

  for (let i = 0; i < Math.max(PTPeaks.length, KHOPeaks.length, ATNPeaks.length); i++) {
    const PTpeak = PTPeaks[i] * 2.5 || "-";
    const KHOpeak = KHOPeaks[i] * 2.5 || "-";
    const ATNpeak = ATNPeaks[i] * 2.5 || "-";
    peaksTimings.push([String(i), String(PTpeak), String(KHOpeak), String(ATNpeak)]);
  }
  const maxItemLength = peaksTimings.flat().sort((a, b) => b.length - a.length)[0].length;
  const convertedPeaksTimings = peaksTimings.map((item) =>
    item.map((string) => {
      let finalString = string;
      if (string.length < maxItemLength) {
        const addSpace = maxItemLength - string.length;

        finalString = " ".repeat(addSpace) + finalString;
      }
      return finalString;
    })
  );
  return convertedPeaksTimings;
};

export function saveFile(data) {
  const text = data.map((arr) => arr.join("           ")).join("\n");

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "data.txt";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
