const ArticleModel = require('../models').Article;

function findById(videoId) {
    return ArticleModel.findById(videoId)
}

function update(conditions, keyValMap) {
    return ArticleModel.updateMany(condition, { $set: keyValMap })
}

function updateById(id, keyValMap) {
    return ArticleModel.findByIdAndUpdate(id, { $set: keyValMap })
}

function find(conditions) {
    return ArticleModel.find(conditions)
}

function create(values) {
    return ArticleModel.create(values);
}

module.exports = {
    findById,
    update,
    updateById,
    find,
    create,
}
