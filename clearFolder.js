const fs = require("fs");
const path = require("path");

const clearFolder = (tempFolder = "./temp") => {
  try {
    if (!fs.existsSync(tempFolder)) {
      fs.mkdirSync(tempFolder, { recursive: true });
      return;
    }

    fs.readdirSync(tempFolder).forEach((file) => {
      const filePath = path.join(tempFolder, file);
      fs.unlinkSync(filePath);
    });

    console.log(`Temporary folder ${tempFolder} cleared`);
  } catch (err) {
    console.error(`Error when cleaning the temporary folder: ${err.message}`);
    throw err; // Можно обработать ошибку на уровне вызова
  }
};

module.exports = { clearFolder };
