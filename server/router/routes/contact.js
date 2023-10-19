const express = require("express");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const contact = express.Router(); // CHANGE 'TEMPLATE' TO THE NAME OF YOUR ROUTE
const utils = require("../../../utils");

contact.route("/").post(async (req, res) => {
  let status;
  // validate request body
  const bodyVerify = utils.validateRequestBody(req.body, [
    { prop: "email", type: "string" },
    { prop: "subject", type: "string" },
    { prop: 'message', type: "string"}
  ]);
  if (bodyVerify.length > 0) {
    status = 400;
    res.status(status).send(utils.response(status, false, null, bodyVerify));
    return;
  }

  const {subject, message, email} = req.body
  const client = new SNSClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    }
  })

  try {
    // Publish the message using SNS
    const params = {
      Message: `From: ${email}\n\n` + message,
      Subject: subject,
      TopicArn: process.env.CONTACT_ARN,
      MessageAttributes: {
        'SenderEmail': {
          DataType: 'String',
          StringValue: email
        }
      }
    };

    const publishCommand = new PublishCommand(params);
    await client.send(publishCommand)
      .then(result => {
        status = 200;
        res.status(status).send(utils.response(status, true, [], 'Email sent successfully.'));
      })

  } catch (error) {
    console.error('Error sending email:', error);
    status = 500;
    res.status(status).send(utils.response(status, false, [], 'Email failed to send.'));
  }
});

module.exports = contact; // CHANGE 'TEMPLATE' TO YOUR ROUTE
