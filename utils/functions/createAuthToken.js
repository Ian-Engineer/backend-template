const jwt = require('jsonwebtoken');
require("dotenv").config();

const createAuthToken = (userData, expirationOffset) => {
    // set expiration date based off of right now
    const now = new Date();
    const expiration = new Date(now)
    expiration.setDate(expiration.getDate() + Number(expirationOffset))
    // create token
    const token = jwt.sign({...userData, expiration}, process.env.JSON_TOKEN_KEY)
    // return the token
    return {token, expiration};
}

module.exports = createAuthToken;