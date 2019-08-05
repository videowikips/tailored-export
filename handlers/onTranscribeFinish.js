const videoHandler = require('../dbHandlers/video');
const articleHandler = require('../dbHandlers/article');
const path = require('path');
const uuid = require('uuid').v4;

const transcribeParser = require('../transcribeParser');

const utils = require('../utils');


const onTranscribeFinish = channel => (msg) => {
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
            transcriptionPath = `${path.join(__dirname, '../tmp')}/${uuid()}.${utils.getFileExtension(video.transcriptionUrl)}`;
            videoPath = `${path.join(__dirname, '../tmp')}/${uuid()}.${utils.getFileExtension(video.url)}`;
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
            const parsedTranscription = transcribeParser.parseTranscription(require(transcriptionPath), video.numberOfSpeakers);
            return utils.breakVideoIntoSlides(videoPath, parsedTranscription);
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
            utils.cleanupFiles(tmpFiles);
            channel.ack(msg);
        })
        .catch(err => {
            console.log(err);
            utils.cleanupFiles(tmpFiles);
            channel.ack(msg);
            return videoHandler.updateById(videoId, { status: 'failed' });
        })
}

module.exports = onTranscribeFinish;