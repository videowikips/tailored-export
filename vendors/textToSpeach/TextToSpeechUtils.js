const fs = require('fs');
const uuidV4 = require('uuid').v4
const AWS = require('aws-sdk');
const GCTextToSpeech = require('@google-cloud/text-to-speech')
const GCTTSClient = new GCTextToSpeech.TextToSpeechClient();

const { accessKeyId, secretAccessKey, bucketName } = require('./config');

const Polly = new AWS.Polly({
  signatureVersion: 'v4',
  region: 'us-east-1',
  accessKeyId,
  secretAccessKey,
});

const GOOGLE_VOICES = {
  male: {
    'en-US': 'en-US-Wavenet-D',
  },
  female: {
    'en-US': 'en-US-Wavenet-C',
  }
}

const LANG_VOICES = {
  'en-US': 'Joanna',
  'hi-IN': 'Aditi',
  'fr-CA': 'Chantal',
  'es-US': 'Penelope',
  'arb': 'Zeina',
  'ja-JP': 'Mizuki',
};

const LANG_CODES = {
  'en': 'en-US',
  'hi': 'hi-IN',
  'fr': 'fr-CA',
  'es': 'es-US',
  'ar': 'arb',
  'in': 'id-ID',
  'ja': 'ja-JP',
};

const AWS_LANGS = [
  'hi-IN',
  'fr-CA',
  'es-US',
  'arb',
  'ja-JP',
];

const GOOGLE_LANGS = [
  'en-US',
  'id-ID',
]

const textToSpeech = ({ text, lang, gender = 'male' }, targetPath, callback = () => {}) => {
  return new Promise((resolve, reject) => {
    const langCode = LANG_CODES[lang];
    console.log(langCode, gender)
    try {
      let generateAudioFunc;
      if (AWS_LANGS.indexOf(langCode) !== -1) {
        generateAudioFunc = generatePollyAudio;
      } else if (GOOGLE_LANGS.indexOf(langCode) !== -1) {
        generateAudioFunc = generateGoogleAudio;
      } else {
        reject(err);
        return callback(new Error('Language is not supported'))
      }
      generateAudioFunc({ text, langCode, gender }, (err, audio) => {
        if (err) {
          reject(err);
          return callback(err)
        }

        fs.writeFile(targetPath, audio.AudioStream, (err) => {
          if (err) {
            reject(err);
            return callback(err);
          }
          resolve(targetPath);
          return callback(null, targetPath);
        })
      })
    } catch (e) {
      reject(err);
      callback(e)
    }
  })
}
// Generate audio from Polly and check if output is a Buffer
const generatePollyAudio = ({ text, langCode }, cb) => {
  console.log('Lang code', langCode)
  const params = {
    Text: text,
    OutputFormat: 'mp3',
    LanguageCode: langCode,
    VoiceId: LANG_VOICES[langCode],
  }

  Polly.synthesizeSpeech(params).promise().then((audio) => {
    if (audio.AudioStream instanceof Buffer) {
      cb(null, audio)
    } else {
      cb('Audiostream is not a buffer')
    }
  })
}

const generateGoogleAudio = ({ text, langCode, gender }, cb) => {
  const request = {
    input: { text },
    voice: {
      languageCode: langCode,
      name: GOOGLE_VOICES[gender][langCode],
    },
    audioConfig: {
      audioEncoding: 'MP3',
      pitch: 0,
      speakingRate: 1,
    },
  }
  GCTTSClient.synthesizeSpeech(request)
    .then((response) => {
      if (response && response.length > 0) {
        if (response[0].audioContent instanceof Buffer) {
          cb(null, { AudioStream: response[0].audioContent })
        } else {
          cb('Audiostream is not a buffer')
        }
      } else {
        return cb('Something went wrong synthetizing speech');
      }
    })
}

// generateGoogleAudio({ text: 'test text', langCode: 'en-US', gender: 'female'})

const writeAudioStreamToS3 = (audioStream, filename, cb) => {
  putObject(bucketName, filename, audioStream, 'audio/mp3').then((res) => {
    if (!res.ETag) {
      cb('Error')
    } else {
      cb(null)
    }
  })
}

const putObject = (bucket, key, body, ContentType) =>
  s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType,
  }).promise()

const deleteAudios = (keys, callback) => {
  if (keys && keys.length > 0) {
    var objects = [];
    keys.forEach((key) => {
      objects.push({ Key: key })
    });

    const params = {
      Bucket: bucketName,
      Delete: {
        Objects: objects,
        Quiet: false
      }
    };

    s3.deleteObjects(params, (err, data) => {
      return callback(err, data);
    });
  } else {
    return callback('No keys specified!');
  }
}

module.exports = {
  textToSpeech,
}