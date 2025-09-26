const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { Worker } = require("worker_threads");
const fs = require("fs");
const { clearFolder } = require("./clearFolder");

clearFolder(path.join(__dirname, "temp"));

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

// ...existing code...

// Храним воркеры для возможности их остановки
const workers = {};

ipcMain.on("start-process", (event, { surah, range, photo }) => {
  const worker = new Worker(path.join(__dirname, "video.js"), {
    workerData: { surah, range, photo },
  });

  // Сохраняем воркер по id окна (или другому уникальному ключу)
  workers[event.sender.id] = worker;

  worker.on("message", (msg) => {
    if (msg.type === "log") event.sender.send("log", msg.text);
    if (msg.type === "progress") event.sender.send("progress", msg.percent);
  });

  worker.on("error", (err) =>
    event.sender.send("log", "❌ Vorker's mistake: " + err.message)
  );
  worker.on("exit", (code) => {
    if (code !== 0)
      event.sender.send("log", `The borker ended with the code ${code}`);
    // Удаляем воркер из списка
    delete workers[event.sender.id];
  });
});

// Новый обработчик для остановки воркера
ipcMain.on("stop-process", (event) => {
  const worker = workers[event.sender.id];
  if (worker) {
    worker.terminate();
    event.sender.send("log", "⏹ Vorker stopped ");
    delete workers[event.sender.id];
  } else {
    event.sender.send("log", "❗ There is no active workman to stop ");
  }
});

ipcMain.on("telegram-process", (event, { token, chatid }) => {
  const worker = new Worker(path.join(__dirname, "telegram.js"), {
    workerData: { token, chatid },
  });

  // Сохраняем воркер для возможности остановки
  workers[event.sender.id] = worker;

  worker.on("message", (msg) => {
    if (msg.type === "log") event.sender.send("log", msg.text);
    if (msg.type === "progress") event.sender.send("progress", msg.percent);
  });

  worker.on("error", (err) =>
    event.sender.send("log", "❌ Vorker's mistake: " + err.message)
  );
  worker.on("exit", (code) => {
    if (code !== 0)
      event.sender.send("log", `The borker ended with the code${code}`);
    // Удаляем воркер после завершения
    delete workers[event.sender.id];
  });
});

// Сохраняем загруженное фото
ipcMain.on("upload-photo", (event, { name, buffer }) => {
  try {
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const savePath = path.join(tempDir, name);

    // Array из рендера → Buffer для записи
    const fileBuffer = Buffer.from(buffer);
    fs.writeFileSync(savePath, fileBuffer);

    event.sender.send("log", `🖼 photo saved: ${name}`);
  } catch (err) {
    event.sender.send("log", "❌ Error while maintaining a photo: " + err.message);
  }
});
