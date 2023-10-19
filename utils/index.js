const response = require("./functions/response");
const queryPG = require("./functions/queryPG");
const validateRequestBody = require("./functions/validateRequestBody");
const createAuthToken = require("./functions/createAuthToken")
// const checkDropboxToken = require('./functions/checkDropboxToken')

const utils = {
  response,
  queryPG,
  validateRequestBody,
  createAuthToken,
  // checkDropboxToken
};

module.exports = utils;
