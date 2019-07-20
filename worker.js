require('dotenv').config({ path: '.env' });

const uuid = require('uuid').v4;
const fs = require('fs');
const mongoose = require('mongoose');
const async = require('async');

const converter = require('./converter');
const utils = require('./utils');

const DB_CONNECTION_URL = process.env.DB_CONNECTION_URL;
const RABBITMQ_SERVER = process.env.RABBITMQ_SERVER;
// Services
const transcribeService = require('./vendors/transcribe');
const storageService = require('./vendors/storage');
const videoHandler = require('./dbHandlers/video');
const articleHandler = require('./dbHandlers/article');

const rabbitmqService = require('./vendors/rabbitmq');
const { queues } = require('./constants');
const { TRANSCRIBE_FINISH_QUEUE, TRANSCRIBE_VIDEO_QUEUE, CONVERT_VIDEO_TO_ARTICLE_QUEUE } = queues;

const AUDIO_DIRECTORY_NAME = 'audio';

mongoose.connect(DB_CONNECTION_URL) // connect to our mongoDB database //TODO: !AA: Secure the DB with authentication keys

let channel;
rabbitmqService.createChannel(RABBITMQ_SERVER, (err, ch) => {
    if (err) throw err;
    channel = ch;
    channel.prefetch(1)
    channel.assertQueue(TRANSCRIBE_VIDEO_QUEUE, { durable: true });
    channel.assertQueue(TRANSCRIBE_FINISH_QUEUE, { durable: true });
    channel.assertQueue(CONVERT_VIDEO_TO_ARTICLE_QUEUE, { durable: true });
    channel.consume(TRANSCRIBE_VIDEO_QUEUE, onTranscribeVideo)
    channel.consume(TRANSCRIBE_FINISH_QUEUE, onTranscribeFinish)
    channel.consume(CONVERT_VIDEO_TO_ARTICLE_QUEUE, onConvertVideoToArticle)
    setTimeout(() => {
        // channel.sendToQueue(TRANSCRIBE_FINISH_QUEUE, new Buffer(JSON.stringify({ videoId: "5d32e316aef7df5a5f0b793f" })));
    }, 2000);
})

function onTranscribeVideo(msg) {
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
            const videoPath = `tmp/${uuid()}.${utils.getFileExtension(video.url)}`;
            return utils.downloadFile(video.url, videoPath);
        })
        .then(videoPath => {
            tmpFiles.push(videoPath);
            const audioPath = `tmp/${uuid()}.mp3`;
            return converter.extractAudioFromVideo(videoPath, audioPath);
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
            cleanupFiles(tmpFiles);
        })
        .catch(err => {
            cleanupFiles(tmpFiles);
            channel.ack(msg)
            console.log(err);
            return videoHandler.updateById(videoId, { status: 'failed' });
        })
}

function onTranscribeFinish(msg) {
    const { videoId } = JSON.parse(msg.content.toString());
    // Find video
    // Download transcription for processing
    // Break video into slides
    // Create a new article with the slides
    // Change video status to proofreading
    // cleanup
    const tmpFiles = [];
    let video;
    let transcriptionPath;
    let videoPath;
    videoHandler.findById(videoId)
        .then((v) => {
            video = v;
            if (!video) throw new Error('Invalid video id');
            console.log(video)
            transcriptionPath = `./tmp/${uuid()}.${utils.getFileExtension(video.transcriptionUrl)}`;
            videoPath = `./tmp/${uuid()}.${utils.getFileExtension(video.url)}`;
            console.log('downloading trans');
            return utils.downloadFile(video.transcriptionUrl, transcriptionPath)
        })
        .then((transcriptionPath) => {
            tmpFiles.push(transcriptionPath);
            console.log('download video')
            return utils.downloadFile(video.url, videoPath);
        })
        .then(videoPath => {
            tmpFiles.push(videoPath);
            return converter.breakVideoIntoSlides(videoPath, require(transcriptionPath), video.numberOfSpeakers);
        })
        .then(slides => {
            // Format slides to match article schema
            const formattedSlides = utils.formatSlidesToSlideSpeakerSchema(slides);
            const newArticle = {
                title: video.title,
                version: 1,
                slides: formattedSlides,
                video: video._id,
                numberOfSpeakers: video.numberOfSpeakers,
                langCode: video.langCode,
                speakersProfile: utils.getSpeakersFromSlides(formattedSlides),
                organization: video.organization,
            }
            return articleHandler.create(newArticle)

        })
        .then(article => {
            console.log('article created');
            return videoHandler.updateById(videoId, { status: 'proofreading', article: article._id });
        })
        .then(() => {
            return utils.getRemoteFileDuration(videoPath);
        })
        .then(duration => {
            return videoHandler.updateById(videoId, { duration });
        })
        .then(() => {
            console.log('done');
            cleanupFiles(tmpFiles);
            channel.ack(msg);
        })
        .catch(err => {
            console.log(err);
            cleanupFiles(tmpFiles);
            channel.ack(msg);
            return videoHandler.updateById(videoId, { status: 'failed' });
        })
}

function onConvertVideoToArticle(msg) {
    const { videoId } = JSON.parse(msg.content.toString());
    let tmpFiles = [];
    let video;
    let article;
    let videoPath;
    // download original video
    // cut it using the timing provided by the user
    // cut silent parts and add them as slides
    // uploaded cutted parts
    // cleanup

    videoHandler.findById(videoId)
        .then(v => {
            if (!v) throw new Error('Invalid video id');
            console.log('converting to article', v)
            video = v;
            videoPath = `./tmp/${uuid()}.${utils.getFileExtension(video.url)}`;
            return articleHandler.find({ video: video._id, version: 1 })
        })
        .then((a) => {
            if (!a || a.length === 0) throw new Error('Invalid article');
            article = a[0].toObject();
            return utils.downloadFile(video.url, videoPath);
        })
        .then((videoPath) => {
            tmpFiles.push(videoPath);
            return converter.cutSlidesIntoVideos(article.slides.slice(), videoPath)
        })
        .then(slides => {
            /*
                1- if it's English video with 1 speaker, generate tts audio, if more than one speaker, don't generate TTS and leave original audio
                2- if it's Hindi with one speaker and the speaker is female, generate tts audio, otherwise dont
                3- other langs dont generate tts 
            */
           const { langCode, speakersProfile } = article;
           if (langCode.toLowerCase().indexOf('en') === 0 && speakersProfile.length === 1) {
            //    English with one speaker
            return converter.convertSlidesTextToSpeach('en', speakersProfile[0].speakerGender, slides);
           } else if (langCode.toLowerCase().indexOf('hi') === 0 && speakersProfile.length === 1 && speakersProfile[0].speakerGender === 'female') {
            //    Hindi with one female speaker
            return converter.convertSlidesTextToSpeach('hi', 'female', slides);
           } else {
               return converter.extractAudioFromSlidesVideos(slides);
           }
        })
        .then((slides) => {
            return new Promise((resolve, reject) => {
                slides.forEach(v => tmpFiles.push(v.video) && tmpFiles.push(v.audio));
                console.log('after cut')
                const uploadFuncArray = [];
                slides.forEach((video) => {
                    uploadFuncArray.push((cb) => {
                        const videoName = video.video.split('/').pop();
                        const audioName = video.audio.split('/').pop();
                        storageService.saveFile('slides', videoName, fs.createReadStream(video.video))
                        .then((res) => {
                            video.url = res.url;
                            console.log('uploaded video', videoName);
                            storageService.saveFile('slides', audioName, fs.createReadStream(video.audio))
                            .then((res) => {
                                video.audio = res.url;
                                console.log('uploaded audio', audioName);
                                cb();
                            })
                            .catch((err) => cb(err));
                        })
                        .catch((err) => {
                            cb(err);
                        });
                    })
                })
                async.parallelLimit(uploadFuncArray, 2, (err, result) => {
                    console.log('done uploading')
                    if (err) return reject(err);
                    return resolve(slides);
                })
            })
        })
        .then((videoSlides) => {
            console.log('updating slides with video')
            const modifiedSlides = article.slides.slice();
            videoSlides.forEach((videoSlide) => {
                modifiedSlides[videoSlide.slideIndex].content[videoSlide.subslideIndex].media = [{ url: videoSlide.url, mediaType: 'video', duration: videoSlide.endTime - videoSlide.startTime }];
                modifiedSlides[videoSlide.slideIndex].content[videoSlide.subslideIndex].audio = videoSlide.audio;
            })
            return articleHandler.updateById(article._id, { slides: modifiedSlides });
        })
        .then(() => {
            return videoHandler.updateById(videoId, { status: 'done' });
        })
        .then(() => {
            console.log('done');
            cleanupFiles(tmpFiles);
            channel.ack(msg);
        })
        .catch(err => {
            console.log(err);
            cleanupFiles(tmpFiles);
            channel.ack(msg);
            return videoHandler.updateById(videoId, { status: 'failed' });
        })
}

function cleanupFiles(files) {
    files.forEach((file) => {
        fs.unlink(file, () => { });
    })
}