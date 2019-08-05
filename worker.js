require('dotenv').config({ path: '.env' });

const mongoose = require('mongoose');


const DB_CONNECTION_URL = process.env.DB_CONNECTION_URL;
const RABBITMQ_SERVER = process.env.RABBITMQ_SERVER;

const rabbitmqService = require('./vendors/rabbitmq');
const { queues } = require('./constants');
const { TRANSCRIBE_FINISH_QUEUE, TRANSCRIBE_VIDEO_QUEUE, CONVERT_VIDEO_TO_ARTICLE_QUEUE, EXPORT_ARTICLE_TRANSLATION } = queues;


mongoose.connect(DB_CONNECTION_URL) // connect to our mongoDB database //TODO: !AA: Secure the DB with authentication keys
const onTranscribeVideoHandler = require('./handlers/onTranscribeVideo');
const onTranscribeFinishHandler = require('./handlers/onTranscribeFinish');

let channel;
rabbitmqService.createChannel(RABBITMQ_SERVER, (err, ch) => {
    if (err) throw err;
    channel = ch;
    channel.prefetch(1)
    channel.assertQueue(TRANSCRIBE_VIDEO_QUEUE, { durable: true });
    channel.assertQueue(TRANSCRIBE_FINISH_QUEUE, { durable: true });
    channel.assertQueue(CONVERT_VIDEO_TO_ARTICLE_QUEUE, { durable: true });

    channel.consume(TRANSCRIBE_VIDEO_QUEUE, onTranscribeVideoHandler(channel));
    channel.consume(TRANSCRIBE_FINISH_QUEUE, onTranscribeFinishHandler(channel));
    setTimeout(() => {
        // channel.sendToQueue(TRANSCRIBE_VIDEO_QUEUE, new Buffer(JSON.stringify({ videoId: "5d47a77f43f8a763614fc1d6" })));
    }, 2000);
})
