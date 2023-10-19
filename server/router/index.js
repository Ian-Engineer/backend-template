/* eslint-disable comma-dangle */
/* eslint-disable import/extensions */

const login = require("./routes/login.js");
const signup = require("./routes/signup.js");
const cookieLogin = require("./routes/cookieLogin.js");
const logout = require('./routes/logout.js');
const passwordReset = require('./routes/passwordReset');
const search = require('./routes/search.js');
const contact = require('./routes/contact.js');
const account = require('./routes/account.js')
// IMPORT YOUR ROUTES AS SHOWN ABOVE

// EXPORT YOUR ROUTES AS SHOWN BELOW
const router = {
  login,
  signup,
  cookieLogin,
  logout,
  passwordReset,
  search,
  contact,
  account,
};

module.exports = router;
