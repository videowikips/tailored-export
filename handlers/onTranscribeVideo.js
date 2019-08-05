const fs = require('fs');
const uuid = require('uuid').v4;
const path = require('path');
const videoHandler = require('../dbHandlers/video');
const storageService = require('../vendors/storage');
const transcribeService = require('../vendors/transcribe');

const utils = require('../utils');

const AUDIO_DIRECTORY_NAME = 'audio';

const onTranscribeVideo = channel => (msg) => {
    const { videoId } = JSON.parse(msg.content.toString());
    const tmpFiles = [];
    // Get the video
    // Extract audio from it
    // upload the audio to s3 for transcription
    // start a transcription job
    // update video status to transcribing
    let video;
    let audioUrl;
    videoHandler.findById(videoId)
        .then((v) => {
            video = v;
            console.log('video is', video);
            const videoPath = `${path.join(__dirname, '../tmp')}/${uuid()}.${utils.getFileExtension(video.url)}`;
            return utils.downloadFile(video.url, videoPath);
        })
        .then(videoPath => {
            tmpFiles.push(videoPath);
            const audioPath = `${path.join(__dirname, '../tmp')}/${uuid()}.mp3`;
            return utils.extractAudioFromVideo(videoPath, audioPath);
        })
        .then((audioPath) => {
            console.log('extracted audio');
            tmpFiles.push(audioPath);
            return storageService.saveFile(AUDIO_DIRECTORY_NAME, `${uuid()}.mp3`, fs.createReadStream(audioPath));
        })
        .then((res) => {
            console.log('saved audio file');
            audioUrl = res.url;
            return transcribeService.transcribe(res.url, video.langCode, video.numberOfSpeakers)
        })
        .then((res) => {
            console.log('transcribe started', res);
            return videoHandler.updateById(videoId, { jobName: res.jobName, status: 'transcriping', audioUrl });
        })
        .then((res) => {
            console.log('job started', res);
            channel.ack(msg);
            // Cleanup
            utils.cleanupFiles(tmpFiles);
        })
        .catch(err => {
            utils.cleanupFiles(tmpFiles);
            channel.ack(msg)
            console.log(err);
            return videoHandler.updateById(videoId, { status: 'failed' });
        })
}

module.exports = onTranscribeVideo;