const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: {
    backend: './backend.ts',
    showbuilder: './showbuilder.ts'
  },
  target: 'node',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new webpack.IgnorePlugin({ resourceRegExp: /^(bufferutil|utf-8-validate)$/ })
  ],
  mode: 'production'
};
