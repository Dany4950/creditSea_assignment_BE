const { Schema, model } = require('mongoose');

module.exports = model('Counter', new Schema({ name: { type: String, unique: true }, seq: { type: Number, default: 0 } }));
