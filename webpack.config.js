const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

module.exports = {
  entry: './backend.js',
  target: 'node',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'backend.js'
  },
  mode: "production"
}