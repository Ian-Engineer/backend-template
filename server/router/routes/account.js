const express = require("express");

const account = express.Router(); // CHANGE 'TEMPLATE' TO THE NAME OF YOUR ROUTE
const utils = require("../../../utils");
const bcrypt = require("bcrypt");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// SQL DATABASE ROUTES

account.route("/change-password").post(async (req, res) => {
  let status;
  try {
  // validate request body
  const bodyVerify = utils.validateRequestBody(req.body, [
    { prop: "password", type: "string" },
    { prop: 'email', type: 'string' },
    { prop: 'newPassword', type: 'string'}
  ]);
  if (bodyVerify.length > 0) {
    status = 400;
    res.status(status).send(utils.response(status, false, null, bodyVerify));
    return;
  }

  // get user with that email
  const queryString = "SELECT * from users WHERE email = $1";
  const queryParams = [req.body.email];
  await utils
    .queryPG(queryString, queryParams, req.baseUrl)
    .then(async (result) => {
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

      const passwordMatch = await bcrypt.compare(
        req.body.password,
        result.data[0].password
      );


      if (passwordMatch) { // SUCCESSFUL SIGN IN
        // delete the existing user_session for this email. Logs the user out everywhere
        const deleteSessionQueryString = 'DELETE FROM user_sessions WHERE user_id = $1';
        const deleteSessionQueryParams = [result.data[0].id];
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

        let userData= result.data[0]
        status = 200;
        // create an item in the user_sessions table for this sign in
        const authToken = utils.createAuthToken({email: userData.email, id: userData.id}, process.env.JSON_EXPIRATION)
        delete userData.password;
        // save authToken to user_session
        const addTokenString = "INSERT INTO user_sessions (id, user_id, expiration_date) VALUES($1, $2, $3)"
        const addTokenParams = [authToken.token, userData.id, authToken.expiration]
        await utils.queryPG(addTokenString, addTokenParams, req.baseUrl);
        
        //hash the password
        const password = await bcrypt.hash(
          req.body.newPassword,
          Number(process.env.BCRYPT_SALT)
        );
        const changePasswordString = "UPDATE users SET password = $1 WHERE id = $2 RETURNING id, email, created_at, autoPlay"
        const changePasswordParams = [password, result.data[0].id]
        await utils.queryPG(changePasswordString, changePasswordParams, req.baseUrl)
        .then(async result => {
          // if result is successful
          if (result.success) {
            // get subscription status
            let userData = result.data[0];
            userData = await utils.getStripeSubscription(userData);
            status = 200;
            let expiration = new Date()
            expiration.setDate(expiration.getDate() + Number(process.env.JSON_EXPIRATION))
            // input new session into user_sessions
            // create an item in the user_sessions table for this sign in
            const authToken = utils.createAuthToken({email: userData.email, id: userData.id}, process.env.JSON_EXPIRATION)
            // save authToken to user_session
            const addTokenString = "INSERT INTO user_sessions (id, user_id, expiration_date) VALUES($1, $2, $3)"
            const addTokenParams = [authToken.token, userData.id, authToken.expiration]
            await utils.queryPG(addTokenString, addTokenParams, req.baseUrl);
            // pass the cookie
            res
              .cookie('authToken', authToken.token, {
                secure: true,
                sameSite: 'none',
                expires: expiration
              })
              .status(status)
              .send(utils.response(status, result.success, userData, "Password successfully changed."));
            return;
          } else {
            status = 500
            res
              .status(status)
              .send(utils.response(status, false, {}, 'Error updating password.'))
          }
        })
        .catch(error => {
          status = 500;
          res
            .status(status)
            .send(utils.response(status, false, error, 'Error updating password'))
        })
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
      res.status(status).send(result);
    });
  } catch (error) {
    status = 500;
    res.status(status).send(utils.response(status, false, {}, 'Error updating password.'))
  }
});

account.route("/change-email").post(async (req, res) => {
  let status;
  try {
  // validate request body
  const bodyVerify = utils.validateRequestBody(req.body, [
    { prop: "password", type: "string" },
    { prop: 'email', type: 'string' },
    { prop: 'newEmail', type: 'string'}
  ]);
  if (bodyVerify.length > 0) {
    status = 400;
    res.status(status).send(utils.response(status, false, {}, bodyVerify));
    return;
  }

  // get user with that email
  const queryString = "SELECT * FROM users WHERE email IN ($1, $2)";
  const queryParams = [req.body.email, req.body.newEmail];
  await utils
    .queryPG(queryString, queryParams, req.baseUrl)
    .then(async (result) => {
      if (result.data.length > 1) {
        status = 200;
        res
          .status(status)
          .send(
            utils.response(
              status,
              false,
              result.data,
              "New email is already in use by another account."
            )
          );
        return;
      }
      let user = {};
      // iterate through the results, returning the currentUser
      for (let i = 0; i < result.data.length; i++) {
        if (result.data[i].email === req.body.email) {
          user = result.data[i]
          break;
        }
      }

      const passwordMatch = await bcrypt.compare(
        req.body.password,
        user.password
      );


      if (passwordMatch) { // SUCCESSFUL SIGN IN
        // delete the existing user_session for this email. Logs the user out everywhere
        const deleteSessionQueryString = 'DELETE FROM user_sessions WHERE user_id = $1';
        const deleteSessionQueryParams = [user.id];
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
            res.status(status).send(utils.response(status, false, {}, 'Error changing your password everywhere. Please try again.'))
            return;
          }

        //hash the password
        const changePasswordString = "UPDATE users SET email = $1 WHERE id = $2"
        const changePasswordParams = [req.body.newEmail, user.id]
        await utils.queryPG(changePasswordString, changePasswordParams, req.baseUrl)
        .then(async result => {
          if (result.success){
            try {
              // get the customer id associated with stripe
              const customers = await stripe.customers.search({query: `email:"${req.body.email}"`})
  
              if (customers.data.length > 0) { // update the list of customers if there is one
                for (let i = 0; i < customers.data.length; i++) {
                  const customer = customers.data[i];
                  await stripe.customers.update(customer.id, {email: req.body.newEmail})
                }
              } // no else required, do nothing if a customer is not registered with stripe
            } catch (error) {
              console.log(error)
              status = 400;
              res.status(status).send(utils.response(status, false, {}, 'Error updating your subscription email. Please contact solgood44@gmail.com to correct the issue.'))
              return;
            }
            status = 200;
            res
              .status(status)
              .send(utils.response(status, result.success, {}, "Email successfully changed."));
            return;
          } else {
            status = 500;
            res
              .status(status)
              .send(utils.response(status, false, {}, result.message))
            return;
          }
        })
        .catch(error => {
          console.log(error);
          status = 500;
          res
            .status(status)
            .send(utils.response(status, false, error, 'Error updating your subscription email. Please contact solgood44@gmail.com to correct the issue.'))
          return;
        })
        } else {
        status = 200;
        res
          .status(status)
          .send(utils.response(status, false, {}, "Incorrect password"));
        return;
      }
    })
    .catch((error) => {
      status = 500;
      console.log(`Error in ${req.baseUrl}: `, error);
      res.status(status).send(utils.response(status, false, {}, error.message));
      return;
    });
  } catch (error) {
    console.log(error)
    status = 500;
    res.status(status).send(utils.response(status, false, {}, 'Error updating email.'))
    return;
  }
});

account.route('/update-auto-play').post(async(req, res) => {
  let status;
  try {
    // validate request body
    const bodyVerify = utils.validateRequestBody(req.body, [
      { prop: "autoPlay", type: "boolean" },
      { prop: 'id', type: 'number' },
    ]);
    if (bodyVerify.length > 0) {
      status = 400;
      res.status(status).send(utils.response(status, false, {}, bodyVerify));
      return;
    }

    const queryString = `
    UPDATE users
    SET autoPlay = $1
    WHERE id = $2`
    const queryParams = [req.body.autoPlay, req.body.id]
    await utils.queryPG(queryString, queryParams, req.baseUrl)
      .then(result => {
        if (result.success) {
          status = 200;
          res.status(status).send(utils.response(status, true, null, 'Successfully updated preference'))
        } else {
          status = 400;
          res.status(status).send(utils.response(status, false, null, 'Unexpected Error updating account settings.'))
        }
      })
  } catch (error) {
    console.log(error)
    status = 400;
    res.status(status).send(utils.response(status, false, null, 'Unexpected Error updating account settings.'))
  }
})

module.exports = account; // CHANGE 'TEMPLATE' TO YOUR ROUTE
