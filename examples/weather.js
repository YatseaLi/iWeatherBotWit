'use strict';

/******
let YQL = require('yql');

let query = new YQL('select * from weather.forecast where (location = 94089)');

query.exec(function(err, data) {
  var location = data.query.results.channel.location;
  var condition = data.query.results.channel.item.condition;
  
  console.log('The current weather in ' + location.city + ', ' + location.region + ' is ' + condition.temp + ' degrees.');
});
 */
let Wit = null;
let interactive = null;
try {
  // if running from repo
  Wit = require('../').Wit;
  interactive = require('../').interactive;
} catch (e) {
  Wit = require('node-wit').Wit;
  interactive = require('node-wit').interactive;
}

const accessToken = (() => {
  if (process.argv.length !== 3) {
    console.log('usage: node examples/quickstart.js <wit-access-token>');
    process.exit(1);
  }
  return process.argv[2];
})();

// Quickstart example
// See https://wit.ai/ar7hur/quickstart

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

const actions = {
  send(request, response) {
    const {sessionId, context, entities} = request;
    const {text, quickreplies} = response;
    console.log('sending...', JSON.stringify(response));
  },
  weatherForecast({context, entities}) {
    console.log('context: ', JSON.stringify(context));
    console.log('entities: ', JSON.stringify(entities));
    
    var location = firstEntityValue(entities, 'location');
    var forecastDate = firstEntityValue(entities, 'datetime');
    if(!forecastDate) 
        forecastDate = 'today';

    console.log('location: ', location);
    console.log('forecastDate: ', forecastDate);
    if (location) {
      context.forecastResult = 'It is rainy in ' + location + ' ' +forecastDate; // we should call a weather API here
      delete context.missingLocation;
    } else {
      context.missingLocation = true;
      delete context.forecastResult;
    }

    console.log('context in reponse: ', JSON.stringify(context));
    return context;
  },
};

const client = new Wit({accessToken, actions});
interactive(client);
