const AWS = require('aws-sdk')
const { accessKeyId, secretAccessKey, bucketName } = require('./config');

const S3 = new AWS.S3({
    accessKeyId,
    secretAccessKey,
    region: 'eu-west-1',
})
function saveFile(directoryName, fileName, fileStream) {
    return new Promise((resolve, reject) => {
        S3.upload({
            Key: `${directoryName}/${fileName}`,
            Bucket: bucketName,
            Body: fileStream
        }, (err, data) => {
            if (err) return reject(err);
            return resolve({ url: data.Location, data });
        })
    })
}

function deleteFile(directoryName, fileName) {
    return false;
}

function getFile(directoryName, fileName) {
    return false;
}

function getDirectoryFiles(directoryName) {
    return false;
}

module.exports = {
    getFile,
    saveFile,
    deleteFile,
    getDirectoryFiles,
}