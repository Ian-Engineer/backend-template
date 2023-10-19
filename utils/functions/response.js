function response(status, success, data, message = "") {
  return {
    status,
    success,
    data,
    message,
  };
}

module.exports = response;
