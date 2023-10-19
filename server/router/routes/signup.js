const express = require("express");

const signup = express.Router(); // CHANGE 'TEMPLATE' TO THE NAME OF YOUR ROUTE
const utils = require("../../../utils");
const bcrypt = require("bcrypt");

// SQL DATABASE ROUTES

signup.route("/").post(async (req, res) => {
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

  //check if user already exists in the database
  const emailInUse = await utils
    .queryPG(
      "SELECT id, email, created_at, autoPlay FROM users WHERE email = $1",
      [body.email],
      req.baseUrl
    )
    .then((result) => {
      if (result.data.length === 0) return false;
      return utils.response(200, false, null, "Email in use.");
    })
    .catch((error) => {
      console.log(`Error in ${req.baseUrl}: `, error);
      return utils.response(
        200,
        false,
        null,
        "Error creating user, please try again."
      );
    });
  if (emailInUse) {
    res.status(emailInUse.status).send(emailInUse);
    return;
  }

  //hash the password
  body.password = await bcrypt.hash(
    body.password,
    Number(process.env.BCRYPT_SALT)
  );

  const queryString = `INSERT INTO users (email, created_at, password, autoPlay) VALUES($1, $2, $3, $4) RETURNING id, email, created_at, autoPlay`;
  const queryParams = [
    body.email.toLowerCase(),
    new Date().toISOString(),
    body.password,
    true
  ];
  let status;
  await utils
    .queryPG(queryString, queryParams, req.baseUrl)
    .then(async (result) => {
      // create an item in the user_sessions table for this sign in
      const authToken = utils.createAuthToken({email: result.data[0].email, id: result.data[0].id}, process.env.JSON_EXPIRATION)
      // save authToken to user_session
      const addTokenString = "INSERT INTO user_sessions (id, user_id, expiration_date) VALUES($1, $2, $3)"
      const addTokenParams = [authToken.token, result.data[0].id, authToken.expiration]
      await utils.queryPG(addTokenString, addTokenParams, req.baseUrl);
      status = 200;
      let expiration = new Date()
      expiration.setDate(expiration.getDate() + Number(process.env.JSON_EXPIRATION))
      res
        .cookie('authToken', authToken.token, {
          secure: true,
          sameSite: 'none',
          expires: expiration
        })
        .status(status)
        .send(utils.response(status, result.success, result.data[0], ""));
    })
    .catch((error) => {
      status = 500;
      console.log(`Error in ${req.baseUrl}: `, error);
      res
        .status(status)
        .send(
          utils.response(
            status,
            false,
            null,
            `Unexpected error in sign up.`
          )
        );
    });
});

module.exports = signup; // CHANGE 'TEMPLATE' TO YOUR ROUTE
