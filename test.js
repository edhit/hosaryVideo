// index.js
const readline = require("readline");
const runProcess = require("./processVideo");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Введите суру: ", (param1) => {
  rl.question("Введите аяты (например 2-4): ", (param2) => {
    rl.question("Введите имя обложки: ", (param3) => {
      runProcess(Number(param1), param2, param3);
      rl.close();
    });
  });
});
