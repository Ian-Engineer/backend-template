const validateRequestBody = (reqBody, requiredFields) => {
  const missingFields = [];
  const wrongTypes = [];

  for (const field of requiredFields) {
    if (!(field.prop in reqBody)) {
      missingFields.push(field.prop);
    } else if (typeof reqBody[field.prop] !== field.type) {
      wrongTypes.push(field.prop);
    }
  }
  let message = "";
  if (missingFields.length > 0) {
    message = message + `Missing fields: ${missingFields.join(", ")}. `;
  }
  if (wrongTypes.length > 0) {
    message = message + `Wrong input types for: ${wrongTypes.join(", ")}.`;
  }

  return message;
};

module.exports = validateRequestBody;
