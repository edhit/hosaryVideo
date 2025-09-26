const { workerData, parentPort } = require("worker_threads");
const runProcess = require("./processTelegram");

function log(msg) {
  parentPort.postMessage({ type: "log", text: msg });
}

function onProgress(percent) {
  parentPort.postMessage({ type: "progress", percent });
}

(async () => {
  await runProcess(
    workerData.token,
    workerData.chatid,
    log,
    onProgress,
  );
})();
