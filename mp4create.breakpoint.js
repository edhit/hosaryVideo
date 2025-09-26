const { createCanvas, loadImage, registerFont } = require("canvas");
const path = require("path");
const fs = require("fs/promises");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const stream = require("stream");
const config = {
  folder: "./temp",
  tempVideoPath: "temp_video.mp4",
  outputPath: "final_video.mp4",
  audioPath: "result.mp3",
  backgroundImage: "./background.jpg",
  fontPath: "./fonts/AmiriQuran-Regular.ttf",
  arabicText: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  videoWidth: 1920,
  videoHeight: 1080,
  fontSize: 100,
  fps: 30,

  maxTextWidth: 0.9, // 90% ширины видео
  maxTextHeight: 0.2, // 20% высоты видео
  minFontSize: 10, // минимальный размер шрифта
  lineHeight: 1.2, // межстрочный интервал
};

class VideoProcessor {
  constructor(settings) {
    this.totalFrames = 0;
    this.canvas = createCanvas(config.videoWidth, config.videoHeight);
    this.ctx = this.canvas.getContext("2d");
    this.passthroughStream = new stream.PassThrough();

    if (settings) {
      Object.keys(config).forEach((key) => {
        if (settings[key] !== undefined) {
          config[key] = settings[key];
        }
      });
    }
  }

  async initialize() {
    try {
      await this.ensureDirectoryExists(config.folder);

      ffmpeg.setFfmpegPath(ffmpegPath);
      ffmpeg.setFfprobePath(ffprobePath);

      registerFont(config.fontPath, { family: "AmiriQuran" });

      console.log("VideoProcessor initialized successfully");
    } catch (error) {
      console.error("Initialization failed:", error);
      throw error;
    }
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  }

  async getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error("Error getting audio duration:", err);
          return reject(err);
        }

        const duration = metadata.format.duration;
        console.log(`Audio duration: ${duration} seconds`);
        resolve(duration);
      });
    });
  }

  async createVideoWithText() {
    try {
      const duration = await this.getAudioDuration(
        path.join(config.folder, config.audioPath)
      );
      this.totalFrames = Math.ceil(duration) * config.fps;

      console.log(`Creating video with ${this.totalFrames} frames...`);

      const bgImage = await loadImage(
        path.join(config.folder, config.backgroundImage)
      );
      const outputPath = path.join(config.folder, config.tempVideoPath);

      await this.setupVideoPipeline(bgImage, outputPath);
      console.log("Temporary video created successfully");

      return outputPath;
    } catch (error) {
      console.error("Failed to create video:", error);
      throw error;
    }
  }

  async setupVideoPipeline(bgImage, outputPath) {
    try {
      return new Promise((resolve, reject) => {
        const command = ffmpeg()
          .input(this.passthroughStream)
          .inputFormat("image2pipe")
          .inputFPS(config.fps)
          .videoCodec("libx264")
          .outputOptions(["-pix_fmt yuv420p"])
          .outputFPS(config.fps)
          .save(outputPath)
          .on("end", resolve)
          .on("error", reject);

        this.generateFrames(bgImage);
      });
    } catch (error) {
      console.error("Failed to create video:", error);
      throw error;
    }
  }

  generateFrames(bgImage) {
    try {
      for (let i = 0; i < this.totalFrames; i++) {
        const opacity = this.calculateOpacity(i, this.totalFrames);
        this.renderFrame(bgImage, opacity);
      }
      this.passthroughStream.end();
    } catch (error) {
      console.error("Failed to create video:", error);
      throw error;
    }
  }

  calculateOpacity(frameIndex, totalFrames) {
    const fps = config.fps;
    const fadeFrames = Math.floor(1.5 * fps); // 1.5 сек в кадрах

    // Появление
    if (frameIndex < fadeFrames) {
      return frameIndex / fadeFrames; // 0 → 1
    }

    // Держим текст до начала исчезновения
    if (frameIndex < totalFrames - fadeFrames) {
      return 1;
    }

    // Исчезновение (плавное до 0)
    const fadeOutIndex = frameIndex - (totalFrames - fadeFrames);
    return 1 - fadeOutIndex / (fadeFrames - 1);
  }

  renderFrame(bgImage, opacity) {
    try {
      this.ctx.fillStyle = "black";
      this.ctx.fillRect(0, 0, config.videoWidth, config.videoHeight);

      const scale = Math.min(
        config.videoWidth / bgImage.width,
        config.videoHeight / bgImage.height
      );
      const imgWidth = bgImage.width * scale;
      const imgHeight = bgImage.height * scale;
      const x = (config.videoWidth - imgWidth) / 2;
      const y = (config.videoHeight - imgHeight) / 2;
      this.ctx.drawImage(bgImage, x, y, imgWidth, imgHeight);

      // Настройки текста
      const maxWidth = config.videoWidth * 0.9; // 90% ширины видео
      const targetHeight = config.videoHeight * 0.2; // 20% высоты видео для текста
      const padding = 20;
      const textX = config.videoWidth / 2;
      const textY = config.videoHeight * 0.85;

      // Функция для разбивки текста на строки
      const wrapText = (text, maxWidth, fontSize) => {
        const words = text.split(" ");
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          this.ctx.font = `${fontSize}px AmiriQuran`;
          const width = this.ctx.measureText(currentLine + " " + word).width;

          if (width < maxWidth) {
            currentLine += " " + word;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
        lines.push(currentLine);
        return lines;
      };

      // Автоподбор размера шрифта
      let fontSize = config.fontSize;
      let lines = [];
      let textHeight = 0;

      // Уменьшаем размер шрифта пока текст не поместится
      while (fontSize > 10) {
        lines = wrapText(config.arabicText, maxWidth, fontSize);
        textHeight = lines.length * fontSize * 1.2; // 1.2 - межстрочный интервал

        if (textHeight <= targetHeight) {
          break;
        }
        fontSize -= 2;
      }

      // Рисуем текст
      this.ctx.font = `${fontSize}px AmiriQuran`;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";

      // Рисуем каждую строку
      lines.forEach((line, index) => {
        const lineY =
          textY - textHeight / 2 + index * fontSize * 1.2 + fontSize / 2;
        this.ctx.fillText(line, textX, lineY);
      });

      this.passthroughStream.write(this.canvas.toBuffer("image/png"));
    } catch (error) {
      console.error("Failed to create video:", error);
      throw error;
    }
  }

  async addAudioToVideo(videoPath) {
    try {
      const outputPath = path.join(config.folder, config.outputPath);

      console.log("Adding audio to video...");

      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .input(path.join(config.folder, config.audioPath))
          .videoCodec("copy")
          .audioCodec("aac")
          .outputOptions(["-shortest"])
          .save(outputPath)
          .on("end", () => {
            console.log("Final video with audio created successfully");
            resolve();
          })
          .on("error", (err, stdout, stderr) => {
            console.error("Error adding audio:", err);
            console.error(stderr);
            reject(err);
          });
      });

      return outputPath;
    } catch (error) {
      console.error("Failed to add audio to video:", error);
      throw error;
    }
  }

  async process() {
    try {
      await this.initialize();
      const tempVideoPath = await this.createVideoWithText();
      await this.addAudioToVideo(tempVideoPath);
      console.log("Video processing completed successfully");
    } catch (error) {
      console.error("Video processing failed:", error);
      throw error;
    }
  }
}

module.exports = VideoProcessor;
