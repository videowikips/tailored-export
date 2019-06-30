const mongoose = require('mongoose');
const { SchemaNames } = require('./Schemas/utils/schemaNames');

const ArticleSchemas = require('./Schemas/Article');
const OrganizationSchemas = require('./Schemas/Organization');
const UserSchemas = require('./Schemas/User');
const VideoSchemas = require('./Schemas/Video');

const Article = mongoose.model(SchemaNames.article, ArticleSchemas.ArticleSchema);
const Organization = mongoose.model(SchemaNames.organization, OrganizationSchemas.OrganizationSchema);
const User = mongoose.model(SchemaNames.user, UserSchemas.UserSchema);
const Video = mongoose.model(SchemaNames.video, VideoSchemas.VideoSchema);

module.exports = {
    Organization,
    Article,
    Video,
    User,
}