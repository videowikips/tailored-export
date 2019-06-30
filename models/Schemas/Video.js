const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { SchemaNames } = require('./utils/schemaNames');

const CONVERT_STATUS_ENUM = ['uploading', 'uploaded', 'transcriping', 'cutting', 'proofreading', 'converting', 'failed', 'done'];

const VideoSchema = new Schema({
    url: { type: String },
    title: { type: String },
    langCode: { type: String },
    numberOfSpeakers: { type: Number },
    organization: { type: Schema.Types.ObjectId, ref: SchemaNames.organization },
    
    audioUrl: { type: String },
    transcriptionUrl: { type: String },
    jobName: { type: String }, // AWS Transcribe job name
    transcripingProgress: { type: Number, default: 0 },
    convertingProgress: { type: Number, default: 0 },
    status: { type: String, enum: CONVERT_STATUS_ENUM, default: 'uploading' },
})

module.exports = { VideoSchema };