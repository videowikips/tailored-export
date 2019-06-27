const { exec } = require('child_process');
const async = require('async');
const fs = require('fs');
const converter = require('./converter');
// const aws = require('aws-sdk')
// const TranscribeService = new aws.TranscribeService()
const rabbitmqService = require('./vendors/rabbitmq');
const RABBITMQ_SERVER = process.env.RABBITMQ_SERVER;
const CONVERT_VIDEO_TO_ARTICLE_QUEUE = 'CONVERT_VIDEO_TO_ARTICLE_QUEUE';

const SILENECE_THREASHOLD = 0.5;

const transcription = require('./trans2.json');
let channel;
// rabbitmqService.createChannel(RABBITMQ_SERVER, (err, ch) => {
//     if (err) throw err;
//     channel = ch;
//     channel.assertQueue(CONVERT_VIDEO_TO_ARTICLE_QUEUE, { durable: true });
//     channel.consume(CONVERT_VIDEO_TO_ARTICLE_QUEUE, onConvertVideoToArticle)
//     // setTimeout(() => {
//     //     channel.sendToQueue(CONVERT_VIDEO_TO_ARTICLE_QUEUE, new Buffer(JSON.stringify({ videoId: 15 })));
//     // }, 2000);
// })

function onConvertVideoToArticle(msg) {
    const content = JSON.parse(msg.content.toString())
    console.log(content);
}

const videoPath = './2.mp4';
// converter.extractAudioFromVideo('2.mp4', '2.mp3')
// .then(res => {
//     console.log(res)
// })
// .catch(e => console.log(e));
converter.breakVideoIntoSlides(videoPath, transcription)
.then((res) => {
    console.log('result is', res);
})
.catch((err) => console.log('err is', err));
