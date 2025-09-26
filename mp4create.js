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
  maxTextWidth: 0.9,
  maxTextHeight: 0.2,
  minFontSize: 10,
  lineHeight: 1.2,
  lineHeight: 1.4,
};

class VideoProcessor {
  constructor(settings, log = false) {
    this.totalFrames = 0;
    this.canvas = createCanvas(config.videoWidth, config.videoHeight);
    this.ctx = this.canvas.getContext("2d");
    this.passthroughStream = new stream.PassThrough();

    this.log = log ? log : console.log;
    if (settings) {
      Object.assign(config, settings);
    }
  }

  async initialize() {
    await this.ensureDirectoryExists(config.folder);
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    registerFont(config.fontPath, { family: "AmiriQuran" });
    this.log("✅ VideoProcessor initialized successfully");
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      this.log(`📂 Created directory: ${dirPath}`);
    }
  }

  async getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration);
      });
    });
  }

  async createVideoWithText() {
    const duration = await this.getAudioDuration(
      path.join(config.folder, config.audioPath)
    );
    this.totalFrames = Math.ceil(duration) * config.fps;
    this.log(`🎬 Creating video with ${this.totalFrames} frames...`);

    const bgImage = await loadImage(
      path.join(config.folder, config.backgroundImage)
    );
    const outputPath = path.join(config.folder, config.tempVideoPath);

    await this.setupVideoPipeline(bgImage, outputPath);
    return outputPath;
  }

  async setupVideoPipeline(bgImage, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg()
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
  }

  generateFrames(bgImage) {
    for (let i = 0; i < this.totalFrames; i++) {
      this.renderFrame(bgImage, i);
    }
    this.passthroughStream.end();
  }

  renderFrame(bgImage, frameIndex) {
    // === Фон ===
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

    // === Разбиваем текст ===
    const stopMarks = /[ۚۖۗۛۜ۞]/g;
    const parts = config.arabicText.split(stopMarks).filter(Boolean);
    const totalChars = parts.reduce((sum, p) => sum + p.length, 0);

    // Определяем текущую часть
    let accumulated = 0;
    let currentPartIndex = 0;
    let partStart = 0;
    let partEnd = this.totalFrames;

    for (let i = 0; i < parts.length; i++) {
      const partLength = parts[i].length;
      const startFrame = Math.floor(
        (accumulated / totalChars) * this.totalFrames
      );
      const endFrame = Math.floor(
        ((accumulated + partLength) / totalChars) * this.totalFrames
      );

      if (frameIndex >= startFrame && frameIndex < endFrame) {
        currentPartIndex = i;
        partStart = startFrame;
        partEnd = endFrame;
        break;
      }
      accumulated += partLength;
    }

    const currentText = parts[currentPartIndex];
    const partFrames = partEnd - partStart;
    const localFrameIndex = frameIndex - partStart;

    // === Fade in/out ===
    const fadeFrames = Math.floor(1.5 * config.fps);
    let opacity = 1;
    if (localFrameIndex < fadeFrames) {
      opacity = localFrameIndex / fadeFrames;
    } else if (localFrameIndex > partFrames - fadeFrames) {
      opacity = 1 - (localFrameIndex - (partFrames - fadeFrames)) / fadeFrames;
    }

    // === Текст ===
    const maxWidth = config.videoWidth * 0.9;
    const targetHeight = config.videoHeight * 0.2;
    const textX = config.videoWidth / 2;
    const textY = config.videoHeight * 0.85;

    let fontSize = config.fontSize;
    let lines = [];
    let textHeight = 0;

    const wrapText = (text, maxWidth, fontSize) => {
      const words = text.split(" ");
      const lines = [];
      let currentLine = words[0] || "";

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
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    while (fontSize > config.minFontSize) {
      lines = wrapText(currentText, maxWidth, fontSize);
      textHeight = lines.length * fontSize * config.lineHeight;
      if (textHeight <= targetHeight) break;
      fontSize -= 2;
    }
    this.ctx.font = `${fontSize}px AmiriQuran`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    // === Свечение ===
    this.ctx.shadowColor = "rgba(255,255,255,0.9)";
    this.ctx.shadowBlur = 20;

    this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    this.ctx.strokeStyle = "rgba(0,0,0,0.6)";
    this.ctx.lineWidth = Math.max(1, fontSize * 0.03); // тонкая обводка

    if (lines.length === 0) {
      this.ctx.fillText("⚠ NO TEXT", textX, textY);
      this.ctx.strokeText("⚠ NO TEXT", textX, textY);
    } else {
      lines.forEach((line, index) => {
        const lineY =
          textY -
          textHeight / 2 +
          index * fontSize * (config.lineHeight || 1.4) + // увеличенный отступ
          fontSize / 2;

        this.ctx.strokeText(line, textX, lineY); // тонкая обводка
        this.ctx.fillText(line, textX, lineY);   // текст со свечением
      });
    }


    // Сбросить эффекты свечения
    this.ctx.shadowBlur = 0;

    // === Отладка ===
    if (frameIndex % (config.fps * 2) === 0) {
      this.log(
        `📝 Frame ${frameIndex} | Part ${currentPartIndex + 1}/${
          parts.length
        } | "${currentText}" | opacity=${opacity.toFixed(2)}`
      );
    }

    this.passthroughStream.write(this.canvas.toBuffer("image/png"));
  }

  async addAudioToVideo(videoPath) {
    const outputPath = path.join(config.folder, config.outputPath);
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .input(path.join(config.folder, config.audioPath))
        .videoCodec("copy")
        .audioCodec("aac")
        .outputOptions(["-shortest"])
        .save(outputPath)
        .on("end", () => {
          this.log("🎵 Final video with audio created successfully");
          resolve(outputPath);
        })
        .on("error", reject);
    });
  }

  async process() {
    await this.initialize();
    const tempVideoPath = await this.createVideoWithText();
    await this.addAudioToVideo(tempVideoPath);
    this.log("✅ Video processing completed successfully");
  }
}

module.exports = VideoProcessor;
