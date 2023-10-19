const express = require("express");
const passwordReset = express.Router(); // CHANGE 'passwordReset' TO THE NAME OF YOUR ROUTE
const utils = require("../../../utils");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
require("dotenv").config();
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const createResetPasswordEmail = (resetLink, expiration) => `
  <p>Hello,</p>
  <p>A password reset request has been initiated for your account.</p>
  <p>Click the following button to reset your password:</p>
  <p><a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border: none; border-radius: 5px; cursor: pointer;">Reset Password</a></p>
  <p>This link is valid until: ${new Date(expiration).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  })}
  <p>If you did not request this password reset, please ignore this email.</p>
  <p>If you'd like to contact us, please use our contact us page.<p>
`;

passwordReset.route("/").post(async (req, res) => {
  let status;
  const userEmail = req.body.email

  // check our user table to see if the email is in use
  let userId;
  const checkEmailQueryString = `SELECT id from users WHERE email = $1`
  const checkEmailQueryParams = [userEmail]
  const emailInUse = await utils
    .queryPG(checkEmailQueryString, checkEmailQueryParams, req.baseUrl)
    .then(result => {
      if (result.success) {
        if (result.data.length === 0) return false
        userId = result.data[0].id
        return true
      } else {
        status = 500;
        res.status(status).send(utils.response(status, false, [], 'Error checking for user in database.'))
        return true;
      }
    })
    .catch((error)=>{
      status = 500
      console.log(error)
      return utils.response(status, false, null, 'Error checking if email is in use.')
    })
  
    if (!emailInUse) {
      status = 200;
      res.status(status).send(utils.response(status, false, [], 'Email is not in use. Please create an account.'))
      return;
    }

  // delete the existing user_session for this email. Logs the user out everywhere
  const deleteSessionQueryString = 'DELETE FROM user_sessions WHERE user_id = $1';
  const deleteSessionQueryParams = [userId];
  const deletedSession = utils.queryPG(deleteSessionQueryString, deleteSessionQueryParams, req.baseUrl)
    .then(result => {
      if (result.success) return true;
      return false;
    })
    .catch(error => {
      console.log(error)
      return false;
    })

    if (!deletedSession) { // if it was unable to delete the users's sessions everywhere, it asks them to do it again.
      status = 500;
      res.status(status).send(utils.response(status, false, [], 'Error changing your password everywhere. Please try again.'))
      return;
    }

  const client = new SESClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    }
  })

  // Generate users token for their email
  const tempToken = utils.createAuthToken({email: userEmail}, 1)
  // insert that token into the database
  const insertTokenQueryString = `INSERT INTO password_reset (token, expiration, email) VALUES($1, $2, $3)`
  const insertTokenQueryParams = [tempToken.token, tempToken.expiration, userEmail]
  const insertSuccess = await utils
    .queryPG(insertTokenQueryString, insertTokenQueryParams, req.baseUrl)
    .then(result => result.success)
    .catch(error=>{
      status = 500;
      console.log(`Error in ${req.baseUrl}: `, error)
      res.status(status).send(utils.response(status, false, null, 'Error saving users temporary token.'))
    })
  if (!insertSuccess) { // if it failed to insert the session token, stop there
    return
  }
  // create the link including that token
  const resetLink = process.env.NODE_ENV === 'development' ? `${process.env.UI_D_ENDPOINT}/password_reset/${tempToken.token}` :
  `${process.env.UI_P_ENDPOINT}/password_reset/${tempToken.token}`; // Replace with your actual reset password URL

  // Create the email message
  const emailMessage = createResetPasswordEmail(resetLink, tempToken.expiration);

    const params = {
      Destination: {
        ToAddresses: [userEmail]
      },
      Message: {
        Subject: {
          Data: 'Password Reset'
        },
        Body: {
          Html: {
            Data: emailMessage
          }
        }
      },
      Source: "solgood.noreply@gmail.com"
    };

    try {
      await client.send(new SendEmailCommand(params));
      status = 200;
      res.status(status).send(utils.response(status, true, [], `An email with instructions to reset your password has been sent to ${userEmail}`))
    } catch (error) {
      console.log(error)
      status = 500;
      res.status(status).send(utils.response(status, false, [], `Error sending password reset email to ${userEmail}. Please try again.`))
    }
});

passwordReset.route('/:token').post((async (req, res) => {
  let status;
  // the req url should include the token
  const tempToken = req.params.token;
  const decodedToken = jwt.verify(tempToken, process.env.JSON_TOKEN_KEY)
  const userEmail = decodedToken.email.toLowerCase();
  // the req body should include the new password
  const body = req.body;
  // validate request body
  const bodyVerify = utils.validateRequestBody(body, [
    { prop: "password", type: "string" },
  ]);
  if (bodyVerify.length > 0) {
    let status = 400;
    res.status(status).send(utils.response(status, false, null, bodyVerify));
    return;
  }

  // check the password_reset table for the user with this token
  const checkUserQueryString = 'SELECT expiration FROM password_reset WHERE token = $1 AND email = $2'
  const checkUserQueryParams = [tempToken, userEmail]
  const validToken = await utils
    .queryPG(checkUserQueryString, checkUserQueryParams, req.baseUrl)
    .then(result => {
      if (result.success) {
        // check expiration of token
        if (result.data.length > 0 && new Date() < result.data[0].expiration) {
            // delete token from password_reset table
            const deleteResetQueryString = 'DELETE FROM password_reset WHERE token = $1 AND email = $2'
            const deleteResetQueryParams = [tempToken, userEmail]
            utils.queryPG(deleteResetQueryString, deleteResetQueryParams, req.baseUrl)
            return true;
        } 
        return false;
      } else {
        status = 500
        res.status(status).send(utils.response(status,false,[],"Error checking for user's token"))
        return false;
      }
    })
    .catch(error => {
      console.log(error)
      status = 500;
      res.status(status).send(utils.response(status, false, [], "Error checking for valid token."))
    })
    if (!validToken) {
      status = 200
      res.status(status).send(utils.response(status, false, [], 'Invalid token.'))
      return; // exits if the token is invalid, continues if its valid
    }

    // encrypt the new password
    const encryptedPassword = await bcrypt.hash(body.password, Number(process.env.BCRYPT_SALT)) 
    // query the database to update the user's password
    const updateUserQueryString = 'UPDATE users SET password = $1 WHERE email = $2 RETURNING id'
    const updateUserQueryParams = [encryptedPassword, userEmail]
    await utils.queryPG(updateUserQueryString, updateUserQueryParams, req.baseUrl)
      .then(async result => {
        if (result.success) {
          const loginUserQueryString = "SELECT * from users WHERE email = $1";
          const loginUserQueryParams = [userEmail];
          const sessionCreated = await utils.queryPG(loginUserQueryString,loginUserQueryParams, req.baseUrl)
            .then(async result => {
              if (result.success) {
                if (result.data && result.data.length > 0) {
                  let userData= result.data[0]
                  status = 200;
                  // create an item in the user_sessions table for this sign in
                  const authToken = utils.createAuthToken({email: userData.email, id: userData.id}, process.env.JSON_EXPIRATION)
                  delete userData.password;
                  // save authToken to user_session
                  const addTokenString = "INSERT INTO user_sessions (id, user_id, expiration_date) VALUES($1, $2, $3)"
                  const addTokenParams = [authToken.token, userData.id, authToken.expiration]
                  await utils.queryPG(addTokenString, addTokenParams, req.baseUrl);

                  userData = await utils.getStripeSubscription(userData)
                  let expiration = new Date()
                  expiration.setDate(expiration.getDate() + Number(process.env.JSON_EXPIRATION))

                  res
                    .cookie('authToken', authToken.token, {
                      secure: true,
                      sameSite: 'none',
                      expires: expiration
                    })
                    .status(status)
                    .send(utils.response(status, result.success, userData, "Password changed and user logged in"));
                  return true;
                }
              }
            })
            .catch(error => {
              console.log(error)
              return false;
            })
            if (!sessionCreated) {
              status = 200
              res.status(status).send(utils.response(status, true, [], 'Password changed.'))
              return;
            }
        } else {
          status = 200
          res.status(status).send(utils.response(status, false, [], "Error updating password. Please try again."))
        }
      })
      .catch( error => {
        console.log(error)
        status = 500
        res.status(status).send(utils.response(status, false, [], "Error changing your password. Please try again."))
      })
}))

module.exports = passwordReset; // CHANGE 'passwordReset' TO YOUR ROUTE
