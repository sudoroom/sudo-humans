var mailer = require('nodemailer')
var settings = require('../settings')

module.exports = function () {
  var transport = mailer.createTransport(settings.mailer)

  function createSubscription (user, opts, collective) {
    var mailOptions = {
      from: settings.mailFrom,
      to: user.email,
      subject: 'Subscription to sudoroom created',
      text: user.email + ' created a subscription to ' + collective + '.'
    }
    transport.sendMail(mailOptions, function (err, info) {
      if (err) {
        return console.trace(err)
      }
      console.log('message %s sent', info.messageId, info.response)
    })

  }

  function cancelSubscription (user, collective) {
    var mailOptions = {
      from: settings.mailFrom,
      to: user.email,
      subject: 'Subscription to sudoroom cancelled',
      text: user.email + ' cancelled their subscription to ' + collective + '.'
    }
    transport.sendMail(mailOptions, function (err, info) {
      if (err) {
        return console.trace(err)
      }
      console.log('message %s sent', info.messageId, info.response)
    })


  }

  function updateSubscription (user, collective) {
    var mailOptions = {
      from: settings.mailFrom,
      to: user.email,
      subject: 'Subscription to sudoroom updated',
      text: user.email + ' updated their subscription to ' + collective + '.'
    }
    transport.sendMail(mailOptions, function (err, info) {
      if (err) {
        return console.trace(err)
      }
      console.log('message %s sent', info.messageId, info.response)
    })

  }


  return {
    createSubscription: createSubscription,
    updateSubscription: updateSubscription,
    cancelSubscription: cancelSubscription
  }

}
