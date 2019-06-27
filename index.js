const fs = require('fs');

const neededDirs = ['tmp'];

neededDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
})