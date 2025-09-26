const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;

// Указываем пути вручную
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Объединяет несколько видео в один файл.
 * @param {string[]} videos - массив путей к видеофайлам
 * @param {string} output - путь к итоговому видео
 * @returns {Promise<string>} - путь к объединённому видео
 */
function mergeMultipleVideos(videos, output) {
  return new Promise((resolve, reject) => {
    if (!videos || videos.length < 2) {
      return reject(new Error("You need at least 2 videos for combining"));
    }

    const command = ffmpeg();

    videos.forEach((video) => {
      command.input(video);
    });

    command
      .on("error", (err) => {
        console.error("Mistake when combining:", err.message);
        reject(err);
      })
      .on("end", () => {
        console.log("The video is successfully combined:", output);
        resolve(output);
      })
      .mergeToFile(output, "./temp");
  });
}

module.exports = { mergeMultipleVideos };
