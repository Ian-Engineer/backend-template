const express = require("express");
const cookieLogin = express.Router();
const utils = require("../../../utils");
const jwt = require("jsonwebtoken")
require("dotenv").config();
const bcrypt = require("bcrypt");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

cookieLogin.route("/").get(async (req, res, next) => {
  let status;
  const authToken = req.cookies.authToken;
  if (authToken === undefined) {
    status = 200;
    res
      .status(status)
      .send(utils.response(
        status,
        false,
        [],
        'authToken not found'
      ))
      return;
  }
  const decodedToken = jwt.verify(authToken, process.env.JSON_TOKEN_KEY)
  // query user_session table for this token
  const sessionQueryString = "SELECT * from user_sessions WHERE user_id = $1 AND id = $2";
  const sessionQueryParams = [decodedToken.id, authToken];
  const validSession = await utils
  .queryPG(sessionQueryString, sessionQueryParams, req.baseUrl)
  .then((result) => {
      // see if it is expired
      if (result.data && result.data.length === 0){
        status = 200;
        res
          .status(status)
          .send(utils.response(
            status,
            false,
            [],
            "Session token not found"
          ))
          return false;
      } else if (new Date() > new Date(result.data[0].expiration_date)) {
        status = 200;
        res
          .status(status)
          .send(
            utils.response(
              status,
              false,
              [],
              "Expired session token"
            )
          );
        return false;
      }
      return true;
    })
    .catch((error) => {
      status = 500;
      console.log(`Error in ${req.baseUrl} at session search: `, error);
      res
        .status(status)
        .send(utils.response(status, false, null, error.message));
      return false;
    });
    if (validSession) {
      // query users table for the user's id
      const userQueryString = "SELECT id, email, created_at, first_name, last_name, password FROM users WHERE id = $1 AND email = $2"
      const userQueryParams = [decodedToken.id, decodedToken.email]
      await utils
        .queryPG(userQueryString, userQueryParams, req.baseUrl)
        .then(async result => {
          // if email not found
          if (result.data.length === 0) {
            status = 200;
            res
              .status(status)
              .send(
                utils.response(
                  status,
                  false,
                  [],
                  "User does not exist."
                )
              )
              return null;
          } else {
            status = 200;
            // alter the user_session expiration date on the table
            let expiration = new Date()
            // expiration = new Date(expiration.setDate(expiration.getDate() + process.env.JSON_EXPIRATION))
            expiration.setDate(expiration.getDate() + Number(process.env.JSON_EXPIRATION))
            const updateSessionString = "UPDATE user_sessions SET expiration_date = $1 WHERE user_id = $2 AND id = $3"
            const updateSessionParams = [expiration, decodedToken.id, authToken]
            await utils
              .queryPG(updateSessionString,updateSessionParams, req.baseUrl)
            // return the user's data, but remove the password first
            let { password, ...userData} = result.data[0]

            res
              .status(status)
              .send(utils.response(
                status,
                true,
                userData,
                ""
              ))
          }
        })
        .catch((error) => {
          status = 500;
          console.log(`Error in ${req.baseUrl} at user search: `, error);
          res
            .status(status)
            .send(utils.response(status, false, null, error.message));
          return;
        });
    }
});

module.exports = cookieLogin; // CHANGE 'TEMPLATE' TO YOUR ROUTE
