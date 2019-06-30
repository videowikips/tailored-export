const AWS = require('aws-sdk');
const uuid = require('uuid').v4;
const { accessKeyId, secretAccessKey, transcribeBucketName } = require('./config');

const transcribeService = new AWS.TranscribeService({
    region: 'eu-west-1',
    apiVersion: '2017-10-26',
    accessKeyId,
    secretAccessKey,
});

// const params = {
//     LanguageCode: en-US | es-US | en-AU | fr-CA | en-GB | de-DE | pt-BR | fr-FR | it-IT | ko-KR | es-ES | en-IN | hi-IN | ar-SA, /* required */
//     Media: { /* required */
//       MediaFileUri: 'STRING_VALUE'
//     },
//     MediaFormat: mp3 | mp4 | wav | flac, /* required */
//     TranscriptionJobName: 'STRING_VALUE', /* required */
//     MediaSampleRateHertz: 'NUMBER_VALUE',
//     OutputBucketName: 'STRING_VALUE',
//     Settings: {
//       ChannelIdentification: true || false,
//       MaxSpeakerLabels: 'NUMBER_VALUE',
//       ShowSpeakerLabels: true || false,
//       VocabularyName: 'STRING_VALUE'
//     }
// };
function transcribe(audioUrl, langCode, noOfSpeakers) {
    return new Promise((resolve, reject) => {
        const jobName = uuid();
        const params = {
            LanguageCode: langCode,
            Media: { /* required */
                MediaFileUri: audioUrl
            },
            MediaFormat: audioUrl.split('.').pop().toLowerCase(),
            TranscriptionJobName: jobName, /* required */
            OutputBucketName: transcribeBucketName,
            Settings: {
                MaxSpeakerLabels: noOfSpeakers,
                ShowSpeakerLabels: true,
            }
        };
        transcribeService.startTranscriptionJob(params, function (err, data) {
            if (err) return reject(err);
            return resolve({ jobName, data });
        });
    })
}

function getTranscriptionStatus(jobName) {
    return new Promise((resolve, reject) => {
        const params = {
            TranscriptionJobName: jobName,
        };
        transcribeService.getTranscriptionJob(params, function (err, data) {
            if (err) return reject(err);
            const job = data.TranscriptionJob;

            return resolve({ status: job.TranscriptionJobStatus, data });
        });
    })
}

module.exports = {
    transcribe,
    getTranscriptionStatus,
}