function makeWorker() {
  return new Worker(new URL('./peaks.worker.js', import.meta.url), { type: 'module' });
}

export function runTask(name, input, transferables) {
  return new Promise((resolve, reject) => {
    const w = makeWorker();
    w.onmessage = (e) => {
      w.terminate();
      const { ok, result, error } = e.data;
      ok ? resolve(result) : reject(new Error(error));
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message));
    };
    w.postMessage({ name, input }, transferables || []);
  });
}

export function runTasks(names, input) {
  return Promise.all(names.map((n) => runTask(n, input)));
}
