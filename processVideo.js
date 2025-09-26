const { mp3create, toGlobalAyah } = require("./mp3create");
const parsePageRanges = require("./parsePageRanges");
const getAyahsTextWithNumbers = require("./getAyahsTextWithNumbers");
const VideoProcessor = require("./mp4create");
const { mergeMultipleVideos } = require("./merge");
const { clearFolder } = require("./clearFolder");

const fs = require("fs/promises");
const path = require("path");
const { Telegraf } = require("telegraf");

// === Отправка в Telegram через TelegrafJS ===
async function sendToTelegram(filePath, token, chatid, log) {
  try {
    log(`📤 We send a video to Telegram ...`);

    const bot = new Telegraf(token);
    await bot.telegram.sendVideo(chatid, { source: filePath });

    log("✅ Video successfully sent to Telegram");
  } catch (err) {
    log("❌ Error when sending to Telegram: " + err.message);
  }
}

async function runProcess(
  surah,
  range,
  photo,
  log = console.log,
  onProgress = console.info
) {
  try {
    // clearFolder(); // Очистка временной папки
    onProgress(0);
    log(`📖 Sura: ${surah}, Range: ${range}`);

    const settings = {
      mode: 2,
      surah: parseInt(surah),
      ayahs: parsePageRanges(range),
      file: "output.mp3",
      folder: "./temp",
    };

    if (isNaN(settings.surah) || settings.surah < 1 || settings.surah > 114) {
      throw new Error("The wrong surah number");
    }

    if (!Array.isArray(settings.ayahs) || settings.ayahs.length <= 0) {
      throw new Error("The wrong range of the ayahs");
    }

    log("🎵 We create audio ...");
    await mp3create(settings, log);
    log("✔ Audio over ");
    onProgress(10);

    const ayahNumbers = settings.ayahs.map((a) =>
      toGlobalAyah(settings.surah, a)
    );
    const ayahTexts = await getAyahsTextWithNumbers(ayahNumbers, log);

    // Видео для каждого аята
    for (let i = 0; i < ayahTexts.length; i++) {
      const text = ayahTexts[i];
      log(`🎬 Video for ayah ${ayahNumbers[i]}`);
      const videoProcessor = new VideoProcessor(
        {
          arabicText: text,
          audioPath: `${ayahNumbers[i]}.mp3`,
          outputPath: `video_${ayahNumbers[i]}.mp4`,
          backgroundImage: photo,
        },
        log
      );
      await videoProcessor.process();
      log(`✔ Ayah ${ayahNumbers[i]} ready`);
      onProgress(Math.round(((i + 1) / ayahTexts.length) * 100));
    }

    log("📹 We combine the video ...");
    const videoFiles = ayahNumbers.map((num) => `temp/video_${num}.mp4`);
    const outputPath = `temp/${ayahNumbers.join("-")}_video.mp4`;
    if (ayahNumbers.length > 1)
      await mergeMultipleVideos(videoFiles, outputPath);

    log(`✅ Video over`);
    onProgress(100);

    // === Проверяем наличие settings.json и отправляем в Telegram ===
    try {
      const settingsPath = path.join(process.cwd(), "settings.json");
      const exists = await fs
        .access(settingsPath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        const data = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
        if (data.token && data.chatid) {
          await sendToTelegram(outputPath, data.token, data.chatid, log);
        } else {
          log("⚠ settings.json found, but token/cheatid are absent");
        }
      } else {
        log("ℹ settings.json not found, let's skip the sending to Telegram");
      }
    } catch (err) {
      log("❌ Error when working with settings.json:" + err.message);
    }
  } catch (err) {
    log("❌ Error: " + err.message);
    onProgress(100);
    return;
  }
}

module.exports = runProcess;
