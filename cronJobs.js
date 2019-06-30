require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const CronJob = require('cron').CronJob;

const { queues } = require('./constants');
const { TRANSCRIBE_FINISH_QUEUE } = queues;
console.log('finis queue', TRANSCRIBE_FINISH_QUEUE)
const DB_CONNECTION_URL = process.env.DB_CONNECTION_URL;
const RABBITMQ_SERVER = process.env.RABBITMQ_SERVER;

// Services
const rabbitmqService = require('./vendors/rabbitmq');
const videoHandler = require('./dbHandlers/video');
const transcribeService = require('./vendors/transcribe');


mongoose.connect(DB_CONNECTION_URL);
let channel;
rabbitmqService.createChannel(RABBITMQ_SERVER, (err, ch) => {
    if (err) throw err;
    channel = ch;
    channel.assertQueue(TRANSCRIBE_FINISH_QUEUE, { durable: true });
    console.log('Cron job connected to rabbitmq');
})

const breakTranscribedIntoSlidesJob = new CronJob({
    cronTime: '* * * * *',
    onTick: function() {
        console.log('tick')
        if (!channel) return;
        videoHandler.find({ status: 'transcriping' })
        .then((videos) => {
            if (!videos || videos.length === 0) return;
            videos.forEach((video) => {
                transcribeService.getTranscriptionStatus(video.jobName)
                .then(({ status, data }) => {
                    if (status && status.toLowerCase() === 'completed') {
                        console.log(data);
                        channel.sendToQueue(TRANSCRIBE_FINISH_QUEUE, new Buffer(JSON.stringify({ videoId: video._id })), { persistent: true });
                        videoHandler.updateById(video._id, { status: 'cutting', transcriptionUrl: data.TranscriptionJob.Transcript.TranscriptFileUri })
                        .then(res => {
                            console.log('cutting ', res);
                        })
                        .catch(err => {
                            console.log(err)
                        })
                    }
                })
                .catch(err => {
                    console.log('error getting transcription status', video, err);
                })
            })
        })
        .catch(err => {
            console.log('error finding videos', err);
        })
    }
})

breakTranscribedIntoSlidesJob.start();