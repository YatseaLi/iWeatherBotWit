'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');

let Wit = null;
let log = null;
try {
  // if running from repo
  Wit = require('../').Wit;
  log = require('../').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}

var https = require('https');

Date.prototype.addDays = function (days) {
  this.setDate(this.getDate() + parseInt(days));
  return this;
};

function getFirstDateOfNextMonth() {
  var now = new Date();
  var result;
  if (now.getMonth() == 11) {
    result = new Date(now.getFullYear() + 1, 0, 1);
  } else {
    result = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return result;
}

function formatDate(date) {
  //date = new Date(date);
  console.log('date in formatDate:', date)
  if (typeof date === 'undefined')
    date = new Date().toISOString();

  var year = date.substring(0, 4);
  var monthIndex = parseInt(date.substring(5, 7)) - 1;
  var day = date.substring(8, 10);

  var monthNames = [
    "Jan", "Feb", "Mar",
    "Apr", "May", "Jun", "Jul",
    "Aug", "Sep", "Oct",
    "Nov", "Dec"
  ];

  //console.log(day + ' ' + monthNames[monthIndex] + ' ' + year);
  return day + ' ' + monthNames[monthIndex] + ' ' + year;
}

var getWeather = function (location, forecastInterval) {
  //var url = 'https://query.yahooapis.com/v1/public/yql?q=select%20item.condition%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location + '%22)&format=json';
  //var targetDate = formatDate(forecastDate);
  var forecastBeginDate = formatDate(forecastInterval.from);
  var forecastEndDate = formatDate(forecastInterval.to);
  var url = null;
  if (forecastBeginDate === forecastEndDate) {
    url = 'https://query.yahooapis.com/v1/public/yql?q=select%20item.condition%2C%20item.forecast%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location +
      '%22)%20and%20item.forecast.date%3D%22' + forecastBeginDate + '%22%20and%20u%3D%27c%27&format=json';
  } else {
    url = 'https://query.yahooapis.com/v1/public/yql?q=select%20item.forecast%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location +
      '%22)%20and%20item.forecast.date%20%20%3E%3D%20%22' + forecastBeginDate + '%22%20and%20%20item.forecast.date%20%20%3C%20%22' + forecastEndDate + '%22%20and%20u%3D%27c%27&format=json';

  }

  return fetch(url, {
      method: 'GET'
    })
    .then(rsp => {
      var res = rsp.json();
      //console.log('yql result: ', JSON.stringify(res) );
      return res;
    })
    .then(json => {
      if (json.error && json.error.message) {
        throw new Error(json.error.message);
      }
      //console.log('yql result: ', JSON.stringify(json));
      return json;
    });
};

// Webserver parameter
const PORT = process.env.PORT || 8445;
process.env['WIT_TOKEN'] = 'DJCZVZZKQJ5UED7VUZXHQO75VQHG4ZFX';
process.env['FB_PAGE_TOKEN'] = 'EAAa5DvztF2YBAIA4JLK5mgZBv2JDi4MBx9ZC0AE60oSHwYmDN0g9XeqUoqtkexExUmw2r0KS1cEZAuFuKxj6pf815mZAjlZC3gjFmRJz3f4GH9reR165TkdIBfSu1zeNYF0VrfHKzX3xj3WN4MsZC20iF67j2ejZAehIZB0eCpQnVAZDZD';
process.env['FB_APP_SECRET'] = 'c7903dfad53410a2d8a526ae30fe7cd4';

// Wit.ai parameters

const WIT_TOKEN = process.env.WIT_TOKEN;

// Messenger API parameters
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
if (!FB_PAGE_TOKEN) {
  throw new Error('missing FB_PAGE_TOKEN')
}
const FB_APP_SECRET = process.env.FB_APP_SECRET;
if (!FB_APP_SECRET) {
  throw new Error('missing FB_APP_SECRET')
}

//define a fixed FB_VERIFY_TOKEN
let FB_VERIFY_TOKEN = 'yatsea-weatherbot';

/********
crypto.randomBytes(8, (err, buff) => {
  if (err) throw err;
  FB_VERIFY_TOKEN = buff.toString('hex');
  console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
});
 **/
// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: {
      id
    },
    message: {
      text
    },
  });
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body,
    })
    .then(rsp => rsp.json())
    .then(json => {
      if (json.error && json.error.message) {
        throw new Error(json.error.message);
      }
      return json;
    });
};

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {
      fbid: fbid,
      context: {}
    };
  }
  return sessionId;
};

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

// Our bot actions
const actions = {
  send({
    sessionId
  }, {
    text
  }) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      return fbMessage(recipientId, text)
        .then(() => null)
        .catch((err) => {
          console.error(
            'Oops! An error occurred while forwarding the response to',
            recipientId,
            ':',
            err.stack || err
          );
        });
    } else {
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart
  weatherForecast({
    context,
    entities
  }) {
    console.log('entities', JSON.stringify(entities));
    var location = firstEntityValue(entities, 'location');
    //if no location found from the input, then take it from conversation context
    if (location === null) {
      location = context.location;
    } else {
      context.location = location;
    }

    //try to get the first value of dateime
    //if not available, then try to get the range (from...to...)
    var forecastDate = firstEntityValue(entities, 'datetime');
    var forecastInterval = {};
    var isToday = false;
    var today = new Date().toISOString().substr(0, 10);

    if (null === forecastDate) {
      try {
        forecastInterval.from = entities.datetime[0].values[0].from.value;
        forecastInterval.to = entities.datetime[0].values[0].to.value;
        console.log('forecastInterval:', JSON.stringify(forecastInterval));
        context.forecastInterval = forecastInterval;
      } catch (e) {
        if (typeof context.forecastInterval !== 'undefined') {
          forecastInterval = context.forecastInterval;
        } else {
          forecastDate = new Date().toISOString();
          forecastInterval.from = forecastDate;
          forecastInterval.to = forecastDate;
          isToday = true;
        }
        console.log('forecastDate:', forecastDate);
      }
    } else {
      //Got the first value.
      forecastInterval.from = forecastDate;
      forecastInterval.to = forecastDate;
      var nowStr = new Date().toISOString();
      //Date format: 2017-07-13T18:20:49.000+10:00"
      //Check if the forcastDate(from Wit) is the same date in the host server.
      //There may be potential issue, for the nowStr isn't the current time of the client.
      if (forecastDate.substr(0, 10) === today) {
        isToday = true;
      }

      //The grain type is week, not day, so expand to week for end of forecast.
      if (entities.datetime[0].values[0].grain === 'week') {
        forecastInterval.to = new Date(forecastDate).addDays(7).toISOString();
        //console.log('found grain week-To:', forecastInterval.to);
      } else if (entities.datetime[0].values[0].grain === 'month') {
        var fdm = getFirstDateOfNextMonth();
        forecastInterval.from = fdm.toISOString();
        forecastInterval.to = fdm.addDays(7).toISOString();
      }

      context.forecastInterval = forecastInterval;
    }
    //Only isToday is not set then check if it is today.
    if ((isToday === false) && (forecastInterval.from.substr(0, 10) === today)) {
      isToday = true;
    }

    delete context.missingLocation;
    delete context.wrongCity;
    delete context.forecastResult;

    if (location && forecastInterval.from && forecastInterval.to) {
      return new Promise(function (resolve, reject) {
        return getWeather(location, forecastInterval).then(weatherJson => {
          //console.log('weather json',JSON.stringify(weatherJson));
          context.forecastResult = '';
          if (weatherJson.query.count > 1) {
            var channels = weatherJson.query.results.channel;
            context.forecastResult = 'Weather forecast in ' + location + ':\n';
            channels.forEach(function (element) {
              var forecast = element.item.forecast;
              context.forecastResult += forecast.date.substring(0, 6) + '(' + forecast.day + '): ' + forecast.text + ',' + forecast.low + '°C~' + forecast.high + '°C.\n';
            }, this);
            //delete context.forecastInterval;
          } else if (weatherJson.query.count === 1) {
            var forecast = weatherJson.query.results.channel.item.forecast;
            //weatherJson.weather[0].description
            var currCondition = weatherJson.query.results.channel.item.condition;
            if (isToday) {
              var currCondition = weatherJson.query.results.channel.item.condition;
              context.forecastResult = 'Currently in ' + location + ' it is ' + currCondition.text +
                ' with ' + currCondition.temp + ' °C.\nHigh: ' + forecast.high + ' °C, Low: ' + forecast.low + ' °C.';
            } else {
              context.forecastResult = 'It will be ' + forecast.text + ' in ' + location + ' on ' + forecast.date +
                ' with ' + forecast.low + '°C~' + forecast.high + '°C.\n'
              //'.\nHigh: ' + forecast.high + ' °C, Low: ' + forecast.low + ' °C.';
            }
            //delete context.forecastInterval;
          } else {
            //no result
            context.wrongCity = true;
          }

          //console.log('Forecast result: \n', context.forecastResult);
          //var weatherResult = weatherJson.query.results.channel.item.condition.text;
          //weatherJson.weather[0].description
          //context.forecastResult = forecastResult; // we should call a weather API here
          delete context.missingLocation;
          return resolve(context);
        })
      });
    } else {
      context.missingLocation = true;
      delete context.forecastResult;
      //return Promise.reject(context);
      return context;
    }
  },
};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
app.use(({
  method,
  url
}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({
  verify: verifyRequestSignature
}));

// Webhook setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message && !event.message.is_echo) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          console.log('senderid: ', sender);
          const sessionId = findOrCreateSession(sender);

          // We retrieve the message content
          const {
            text,
            attachments
          } = event.message;
          //console.log('sending...', JSON.stringify(res));
          console.log('sending...', text);
          if (attachments) {
            // We received an attachment
            // Let's reply with an automatic message
            fbMessage(sender, 'Sorry I can only process text messages for now.')
              .catch(console.error);
          } else if (text) {
            // We received a text message

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit.runActions(
                sessionId, // the user's current session
                text, // the user's message
                sessions[sessionId].context // the user's current session state
              ).then((context) => {
                // Our bot did everything it has to do.
                // Now it's waiting for further messages to proceed.
                console.log('Waiting for next user messages');

                // Based on the session state, you might want to reset the session.
                // This depends heavily on the business logic of your bot.
                // Example:
                // if (context['done']) {
                //   delete sessions[sessionId];
                // }

                // Updating the user's current session state
                sessions[sessionId].context = context;
              })
              .catch((err) => {
                console.error('Oops! Got an error from Wit: ', err.stack || err);
              })
          }
        } else {
          console.log('received event', JSON.stringify(event));
        }
      });
    });
  }
  res.sendStatus(200);
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
      .update(buf)
      .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

app.listen(PORT);
console.log('Listening on :' + PORT + '...');