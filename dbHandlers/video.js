const VideoModel = require('../models').Video;

function findById(videoId) {
    return VideoModel.findById(videoId)
}

function update(conditions, keyValMap) {
    return VideoModel.updateMany(condition, { $set: keyValMap })
}

function updateById(id, keyValMap) {
    return VideoModel.findByIdAndUpdate(id, { $set: keyValMap })
}

function find(conditions) {
    return VideoModel.find(conditions)
}

module.exports = {
    findById,
    update,
    updateById,
    find,
}
