const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  uploadPhoto: (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      // Передаем ArrayBuffer в main процесс
      ipcRenderer.send("upload-photo", {
        name: file.name,
        buffer: Array.from(new Uint8Array(arrayBuffer)),
      });
    };
    reader.readAsArrayBuffer(file);
  },
  startProcess: (surah, range, photo) =>
    ipcRenderer.send("start-process", { surah, range, photo }),
  stopProcess: () =>
    ipcRenderer.send("stop-process"),
  telegramProcess: (token, chatid) =>
    ipcRenderer.send("telegram-process", { token, chatid }),
  onLog: (callback) => ipcRenderer.on("log", (_, msg) => callback(msg)),
  onProgress: (callback) =>
    ipcRenderer.on("progress", (_, percent) => callback(percent)),
});
