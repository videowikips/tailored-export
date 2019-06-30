const fs = require('fs');
const { exec } = require('child_process');
const neededDirs = ['tmp'];

neededDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
})

exec(`node_modules/pm2/bin/pm2 start worker.js -i 2 --name=TVW_EXPORTER`, (err) => {
    if (err) {
        console.log('error intializing', err);
    } else {
        console.log('started exporter worker')
    }
})

exec(`node_modules/pm2/bin/pm2 start cronJobs.js --name=TVW_EXPORTER_CRONJOBS`, (err) => {
    if (err) {
        console.log('error intializing', err);
    } else {
        console.log('started exporter worker')
    }
})