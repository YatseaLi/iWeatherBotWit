let Wit = null;
let interactive = null;
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
    //console.log('date in formatDate:', date)
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
        url = 'https://query.yahooapis.com/v1/public/yql?q=select%20item.condition%2C%20item.forecast%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location
            + '%22)%20and%20item.forecast.date%3D%22' + forecastBeginDate + '%22%20and%20u%3D%27c%27&format=json';
    }
    else {
        url = 'https://query.yahooapis.com/v1/public/yql?q=select%20item.forecast%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location
            + '%22)%20and%20item.forecast.date%20%20%3E%3D%20%22' + forecastBeginDate + '%22%20and%20%20item.forecast.date%20%20%3C%20%22' + forecastEndDate + '%22%20and%20u%3D%27c%27&format=json';

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
        console.log('usage: node examples/iWeather.js <wit-access-token>');
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
        entities[entity][0].value;
    if (!val) {
        return null;
    }
    return typeof val === 'object' ? val.value : val;
};

const actions = {
    send(request, response) {
        const { sessionId, context, entities } = request;
        const { text, quickreplies } = response;
        return new Promise(function (resolve, reject) {
            console.log('iWeatherBot says: \n', response.text);
            return resolve();
        });
    },
    weatherForecast({ context, entities }) {
        console.log('entities', JSON.stringify(entities));
        var location = firstEntityValue(entities, 'location');
        if (location === null) {
            location = context.location;
        }
        else {
            context.location = location;
        }
        var forecastDate = firstEntityValue(entities, 'datetime');
        var forecastInterval = {};
        var isToday = false;
        if (null === forecastDate) {
            try {
                forecastInterval.from = entities.datetime[0].values[0].from.value;
                forecastInterval.to = entities.datetime[0].values[0].to.value;
                //console.log('forecastInterval:', JSON.stringify(forecastInterval));
                context.forecastInterval = forecastInterval;
            }
            catch (e) {
                if (typeof context.forecastInterval !== 'undefined') {
                    forecastInterval = context.forecastInterval;
                }
                else {
                    forecastDate = new Date().toISOString();
                    forecastInterval.from = forecastDate;
                    forecastInterval.to = forecastDate;
                    isToday = true;
                }
                //console.log('forecastDate:', forecastDate);
            }
        }
        else {
            forecastInterval.from = forecastDate;
            forecastInterval.to = forecastDate;
            if (entities.datetime[0].values[0].grain === 'week') {
                forecastInterval.to = new Date(forecastDate).addDays(7).toISOString();
                //console.log('found grain week-To:', forecastInterval.to);
            }
            else if (entities.datetime[0].values[0].grain === 'month') {
                var fdm = getFirstDateOfNextMonth();
                forecastInterval.from = fdm.toISOString();
                forecastInterval.to = fdm.addDays(7).toISOString();
            }
            context.forecastInterval = forecastInterval;
        }
        console.log('forecastInterval: ', JSON.stringify(forecastInterval));
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
                            context.forecastResult += forecast.date.substring(0,6) + '(' + forecast.day + '): ' + forecast.text + ',' + forecast.low + '°C~' +  forecast.high + '°C.\n';
                        }, this);
                        //delete context.forecastInterval;
                    }
                    else if (weatherJson.query.count === 1) {
                        var forecast = weatherJson.query.results.channel.item.forecast;
                        //weatherJson.weather[0].description
                        var currCondition = weatherJson.query.results.channel.item.condition;
                        if (isToday) {
                            var currCondition = weatherJson.query.results.channel.item.condition;
                            context.forecastResult = 'Currently in ' + location + ' it is ' + currCondition.text
                                + ' with ' + currCondition.temp + ' °C.\nHigh: ' + forecast.high + ' °C, Low: ' + forecast.low + ' °C.';
                        }
                        else {
                            context.forecastResult = 'It will be ' + forecast.text + ' in ' + location + ' on ' + forecast.date +
                                ' with ' + forecast.low + '°C~' + forecast.high + '°C.\n'
                            //'.\nHigh: ' + forecast.high + ' °C, Low: ' + forecast.low + ' °C.';
                        }
                        //delete context.forecastInterval;
                    }
                    else {
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

const client = new Wit({ accessToken, actions });
interactive(client);