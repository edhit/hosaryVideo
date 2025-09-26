const fs = require("fs/promises");
const path = require("path");

async function runProcess(token, chatid, log, onProgress) {
  try {
    onProgress(0);

    console.log(token, chatid);
    log(`🚀 Launching the process with token:${token} and chatid: ${chatid}`);

    // Сохраняем в settings.json в корне проекта
    const data = { token, chatid, updated: new Date().toISOString() };
    const filePath = path.join(__dirname, "settings.json");

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    log(`💾 The data are saved in ${filePath}`);

    // Здесь должна быть логика работы с Telegram API
    await new Promise((resolve) => setTimeout(resolve, 5000));

    log(`✅ The process is completed successfully`);
    onProgress(100);
  } catch (err) {
    log("❌ Error: " + err.message);
    onProgress(100);
    return;
  }
}

module.exports = runProcess;
