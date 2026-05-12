const webpack = require("webpack");
const path = require("path");
const fs = require("fs");

module.exports = {
  entry: {
    backend: "./backend.js",
    showbuilder: "./showbuilder.js",
  },
  target: "node",
  output: {
    path: path.join(__dirname, "dist"),
    filename: "[name].js",
  },
  plugins: [
    new webpack.IgnorePlugin({ resourceRegExp: /^(bufferutil|utf-8-validate)$/ }),
  ],
  mode: "production",
};
