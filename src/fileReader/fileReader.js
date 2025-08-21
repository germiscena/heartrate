export function readUploadedFile(fileData) {
  const header = (fileData[0] + ';t')
    .trim()
    .split(';')
    .map((item, i) => {
      if (i === 0) {
        item = item.split(' ').filter((obj) => obj !== '');
        return item;
      } else {
        return item;
      }
    })
    .flat()
    .join(',');
  const outputArray = [header];

  for (let i = 1; i < fileData.length; i++) {
    const line = fileData[i].trim();
    const dataIndex = Number(line.split('\t')[0]);
    if (!line) continue;
    const newLine = `${line} \t ${dataIndex * 2.5}`
      .split('\t')
      .map((item) => item.trim())
      .join(',');
    outputArray.push(newLine);
  }
  return outputArray;
}

export const PAGE_SIZE = 72000;

// Определение номера страницы
async function setPageNumber(file, every) {
  const checkpoints = [0];
  let total = 0;
  let offset = 0;
  let lastLineStart = 0;

  const r = file.stream().getReader();
  while (true) {
    const { value, done } = await r.read();
    if (done) break;

    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 10) {
        total++;
        lastLineStart = offset + i + 1;
        if (total % every === 0) checkpoints.push(lastLineStart);
      }
    }
    offset += bytes.length;
  }
  if (offset > lastLineStart) {
    total++;
    if (total % every === 0) checkpoints.push(offset);
  }
  r.releaseLock?.();
  return { totalLines: total, checkpoints, every };
}

// Получение данных, начиная с определенной страницы
async function readRange(file, startLine, count, page) {
  const every = page.every;
  const checkpoints = page.checkpoints;

  const checkpointIndex = Math.floor(startLine / every);
  const checkpointLine = checkpointIndex * every;
  const checkpointOffset = checkpoints[checkpointIndex] || 0;

  const reader = file
    .slice(checkpointOffset)
    .stream()
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(
      new TransformStream({
        start() {
          this.buf = '';
        },
        transform(chunk, controller) {
          this.buf += chunk;
          const parts = this.buf.split('\n');
          this.buf = parts.pop();
          for (let s of parts) {
            if (s.endsWith('\r')) s = s.slice(0, -1);
            controller.enqueue(s);
          }
        },
        flush(controller) {
          if (this.buf) {
            let s = this.buf;
            if (s.endsWith('\r')) s = s.slice(0, -1);
            controller.enqueue(s);
          }
        },
      }),
    )
    .getReader();

  const out = [];
  let lineNumber = checkpointLine;

  while (out.length < count) {
    const { value: line, done } = await reader.read();
    if (done) break;
    if (lineNumber >= startLine) out.push(line);
    lineNumber++;
  }
  reader.releaseLock?.();
  return out;
}

export async function streamUploadedFileData(file, startLine, count, length, page) {
  if (!page || length === 0) {
    page = await setPageNumber(file, PAGE_SIZE);
  }
  const total = page.totalLines;
  if (startLine >= total) return { lines: [], totalLines: total };

  const lines = await readRange(file, startLine, count, page);
  return { lines, totalLines: total };
}

// export async function streamUploadedFileData(file, startLine, count, length) {
//   const totalCount = count + 1;
//   const lines = [];
//   let lineIndex = 0;
//   const reader = file
//     .stream()
//     .pipeThrough(new TextDecoderStream())
//     .pipeThrough(
//       new TransformStream({
//         start() {
//           this.buffer = '';
//         },
//         transform(chunk, controller) {
//           this.buffer += chunk;
//           const parts = this.buffer.split('\r\n');
//           this.buffer = parts.pop();
//           for (const line of parts) controller.enqueue(line);
//         },
//         flush(controller) {
//           if (this.buffer) controller.enqueue(this.buffer);
//         },
//       }),
//     )
//     .getReader();

//   while (true) {
//     const { value: line, done } = await reader.read();

//     if (done) break;
//     if ((lineIndex === 0 || lineIndex >= startLine) && lines.length < totalCount) {
//       lines.push(line);
//     }
//     if (!length && lines.length >= totalCount) {
//       break;
//     }
//     lineIndex++;
//   }
//   return { lines: lines, totalLines: lineIndex };
// }
