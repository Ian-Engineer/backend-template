const express = require("express");

const logout = express.Router(); // CHANGE 'TEMPLATE' TO THE NAME OF YOUR ROUTE
const utils = require("../../../utils");
const jwt = require("jsonwebtoken")
require("dotenv").config();

// SQL DATABASE ROUTES

logout.route("/").delete(async (req, res) => {
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
        "authToken not found"
      ))
  }
  const decodedToken = jwt.verify(authToken, process.env.JSON_TOKEN_KEY)
  const queryString = "DELETE FROM user_sessions WHERE user_id = $1 AND id = $2";
  const queryParams = [decodedToken.id, authToken];
  await utils
    .queryPG(queryString, queryParams, req.baseUrl)
    .then((result) => {
      if (result.success){
        status = 200;
        res
          .status(status)
          .send(utils.response(
            status,
            true,
            [],
            "User logged out of device"
          ))
          return;
      } else {
        status = 500;
        res.status(status).send(utils.response(
          status,
          false,
          [],
          "Error logging out of session"
        ));
        return;
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

module.exports = logout; // CHANGE 'TEMPLATE' TO YOUR ROUTE
