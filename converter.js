const fs = require('fs');
const { exec } = require('child_process');
const uuid = require('uuid').v4;
const transcribeParser = require('./transcribeParser');
const utils = require('./utils');
const async = require('async');

function normalizeCommandText(text) {
    return text.replace(/\:|\'|\"/g, '');
}

function cutVideo(videoPath, targetPath, start, end, content) {
    return new Promise((resolve, reject) => {
        const command = `ffmpeg -y -ss ${utils.formatCutTime(start)} -i ${videoPath} -t ${end} ${targetPath}`;
        exec(command, (err, stdout, stderr) => {
            if (err) return reject(err);
            if (!fs.existsSync(targetPath)) return reject(new Error('Something went wrong'));
            return resolve(targetPath);
        })
    })
}

function extractAudioFromSlidesVideos(slides) {

    return new Promise((resolve, reject) => {
        const extractAudioFuncArray = [];
        slides.forEach(videoSlide => {
            extractAudioFuncArray.push((cb) => {
                const targetPath = `tmp/audio-${uuid()}.mp3`;
                extractAudioFromVideo(videoSlide.video, targetPath)
                .then(() => {
                    videoSlide.audio = targetPath;
                    cb();
                })
                .catch((err) => {
                    cb(err);
                })
            })
        });
        async.parallelLimit(extractAudioFuncArray, 2, (err) => {
            if (err) return reject(err);
            return resolve(slides);
        })
    })
}

function extractAudioFromVideo(videoPath, targetPath) {
    return new Promise((resolve, reject) => {
        const command = `ffmpeg -y -i ${videoPath} -map 0:a:0 ${targetPath}`;
        exec(command, (err) => {
            if (err) return reject(err);
            if (!fs.existsSync(targetPath)) return reject(new Error('Something went wrong'));
            return resolve(targetPath);
        })
    })
}

function cutSlidesIntoVideos(slides, videoPath) {
    return new Promise((resolve, reject) => {
        const videoCuts = [];
        slides.forEach((slide, slideIndex) => {
            slide.content.forEach((subslide, index) => {
                videoCuts.push((cb) => {
                    const targetPath = `tmp/${slideIndex}.${index}${uuid()}.${videoPath.split('.').pop()}`;
                    // const targetPath = `tmp/${index}-${uuid()}.${videoPath.split('.').pop()}`;
                    cutVideo(videoPath, targetPath, subslide.startTime, subslide.endTime - subslide.startTime)
                        .then((res) => {
                            console.log('done', slideIndex, index); cb(null, { ...subslide, video: targetPath, slideIndex, subslideIndex: index })
                        })
                        .catch(cb);
                })
            })
        })

        async.series(videoCuts, (err, result) => {
            if (err) return reject(err);
            return resolve(result);
        })
    })
}

function breakVideoIntoSlides(videoPath, transcription) {
    return new Promise((resolve, reject) => {
        utils.getRemoteFileDuration(videoPath)
            .then((videoDuration) => {
                const slides = utils.formatTranscribedSlidesToCut(transcribeParser.parseTranscription(transcription), videoDuration);
                return resolve(slides);
            })
            .catch(reject)
    })
}

module.exports = {
    cutVideo,
    cutSlidesIntoVideos,
    breakVideoIntoSlides,
    extractAudioFromSlidesVideos,
    extractAudioFromVideo,
}
