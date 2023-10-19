/* eslint-disable import/extensions */
const express = require("express");
const session = require('express-session');
require("dotenv").config();
const utils = require("../utils");
const cors = require("cors");
const cookieParser = require('cookie-parser')
const crypto = require('crypto');
// https://www.makeuseof.com/node-js-sessions-persist-data/
// https://awstip.com/deploying-a-nodejs-application-with-aws-ec2-ssl-and-a-load-balancer-38885230fc6f

// instantiate app
const app = express();
app.use(express.json());
app.use(
  cors(
    {
      origin: process.env.NODE_ENV === 'development' ? process.env.UI_D_ENDPOINT : process.env.UI_P_ENDPOINT,
      exposedHeaders: ['Set-Cookie'],
      credentials: true
    }
  ),
  cookieParser(),
  session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: true,
  })
);
const router = require("./router/index.js");

// API ROUTES
app.use("/api/signup", router.signup);
app.use("/api/login", router.login);
app.use("/api/cookieLogin", router.cookieLogin);
app.use("/api/logout", router.logout);
app.use("/api/password_reset", router.passwordReset);
app.use("/api/search", router.search);
app.use("/api/contact", router.contact);
app.use('/api/account', router.account);
app.use('/', (req, res, next) => {
  if (req.headers.host === 'solgood.media') {
    return res.redirect(301, 'https://www.solgood.media');
  }
  return next();
})

// 404 Error
app.get("*", (req, res) => {
  res.status(404).send(utils.response(404, false, null, "Route not found"));
});

app.listen(
  process.env.PORT,
  console.log(`Connected to the Express server on port: ${process.env.PORT}`)
);

// typical response object:

/**
 * {
 *     status: Number,
 *     success: Boolean,
 *     response: Object
 * }
 */
