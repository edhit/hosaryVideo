const { mp3create, toGlobalAyah } = require("../mp3create");
const readline = require("readline");
const parsePageRanges = require("../parsePageRanges");
const getAyahsTextWithNumbers = require("../getAyahsTextWithNumbers");
const VideoProcessor = require("../mp4create");
const { mergeMultipleVideos } = require("../merge");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  try {
    // Запрашиваем ввод данных
    const input1 = await new Promise((resolve) => {
      rl.question("Введите номер суры: ", resolve);
    });

    // Запрашиваем ввод диапазона аятов
    const input2 = await new Promise((resolve) => {
      rl.question(
        "Введите диапазон аятов (например: 1-7 или 1,2,3): ",
        resolve
      );
    });

    // загрузка фото и сохранение его в папку temp через input file в html в electron


    // Настройки для mp3create
    const settings = {
      mode: 2,
      surah: parseInt(input1),
      ayahs: parsePageRanges(input2),
      file: "output.mp3",
      folder: "./temp",
    };

    if (isNaN(settings.surah) || settings.surah < 1 || settings.surah > 114) {
      throw new Error("Неверный номер суры. Введите число от 1 до 114.");
    }

    if (!Array.isArray(settings.ayahs) || settings.ayahs.length <= 1) {
      throw new Error("Неверный диапазон аятов. Введите корректные значения.");
    }


    // Выполняем создание mp3
    const resultAudio = await mp3create(settings);
    console.log("Настройки после выполнения:", resultAudio);
    // Получаем глобальные номера аятов и их тексты
    const ayahNumbers = settings.ayahs.map((a) =>
      toGlobalAyah(settings.surah, a)
    );

    // Получаем тексты аятов с их номерами
    const ayahTexts = await getAyahsTextWithNumbers(ayahNumbers);

    console.log("Тексты аятов:", ayahTexts);

    // Создаем видео для каждого аята и объединяем их
    for (const [index, text] of ayahTexts.entries()) {
      const label = `Processing video for ayah ${ayahNumbers[index]}`;
      console.time(label);
      const videoProcessor = new VideoProcessor({
        arabicText: text,
        audioPath: `${ayahNumbers[index]}.mp3`,
        outputPath: `video_${ayahNumbers[index]}.mp4`,
      });
      await videoProcessor.process();
      console.timeEnd(label);
    }

    // Объединяем все видео в одно
    const videoFiles = ayahNumbers.map((num) => `temp/video_${num}.mp4`);
    await mergeMultipleVideos(
      videoFiles,
      `temp/${(ayahNumbers.map((num) => `${num}`) + "_video").replace(
        ",",
        "-"
      )}.mp4`
    );
    console.log(
      `Видео успешно объединено в temp/${(
        ayahNumbers.map((num) => `${num}`) + "_video"
      ).replace(",", "-")}.mp4`
    );
  } catch (error) {
    console.error("Ошибка в основном процессе:", error);
  } finally {
    rl.close();
  }
}

main();
