const express = require("express");
const login = express.Router();
const utils = require("../../../utils");
const bcrypt = require("bcrypt");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

login.route("/").post(async (req, res) => {
  const body = req.body;
  // validate request body
  const bodyVerify = utils.validateRequestBody(body, [
    { prop: "email", type: "string" },
    { prop: "password", type: "string" },
  ]);
  if (bodyVerify.length > 0) {
    let status = 400;
    res.status(status).send(utils.response(status, false, null, bodyVerify));
    return;
  }

  // get user with that email
  const queryString = "SELECT * from users WHERE email = $1";
  const queryParams = [body.email.toLowerCase()];
  let status;
  await utils
    .queryPG(queryString, queryParams, req.baseUrl)
    .then(async (result) => {
      // check if a user with that email was found
      if (result.data.length === 0) {
        status = 200;
        res
          .status(status)
          .send(
            utils.response(
              status,
              false,
              result.data,
              "This email is not registered"
            )
          );
        return;
      }

      // check if the hashed passwords match
      const passwordMatch = await bcrypt.compare(
        body.password,
        result.data[0].password
      );
      if (passwordMatch) { // SUCCESSFUL SIGN IN
        status = 200;
        // create an item in the user_sessions table for this sign in
        const authToken = utils.createAuthToken({email: result.data[0].email, id: result.data[0].id}, process.env.JSON_EXPIRATION)
        delete result.data[0].password;
        let userData = result.data[0]
        let expiration = new Date()
        expiration.setDate(expiration.getDate() + Number(process.env.JSON_EXPIRATION))
        // save authToken to user_session
        const addTokenString = "INSERT INTO user_sessions (id, user_id, expiration_date) VALUES($1, $2, $3)"
        const addTokenParams = [authToken.token, result.data[0].id, authToken.expiration]
        await utils.queryPG(addTokenString, addTokenParams, req.baseUrl);

        userData = await utils.getStripeSubscription(userData)

        res
          .cookie('authToken', authToken.token, {
            secure: true,
            sameSite: 'none',
            expires: expiration
          })
          .status(status)
          .send(utils.response(status, result.success, userData, ""));
        return;
      } else {
        status = 200;
        res
          .status(status)
          .send(utils.response(status, false, null, "Incorrect password"));
      }
    })
    .catch((error) => {
      status = 500;
      console.log(`Error in ${req.baseUrl}: `, error);
      res
        .status(status)
        .send(utils.response(status, false, null, error.message));
    });
});

module.exports = login; // CHANGE 'TEMPLATE' TO YOUR ROUTE
