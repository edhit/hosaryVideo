const { workerData, parentPort } = require("worker_threads");
const runProcess = require("./processVideo");

function log(msg) {
  parentPort.postMessage({ type: "log", text: msg });
}

function onProgress(percent) {
  parentPort.postMessage({ type: "progress", percent });
}

(async () => {
  await runProcess(
    workerData.surah,
    workerData.range,
    workerData.photo,
    log,
    onProgress,
  );
})();
