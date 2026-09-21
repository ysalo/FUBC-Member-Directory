const packageMetadata = require("./package.json");

module.exports = ({ config }) => ({
  ...config,
  version: packageMetadata.version,
});