'use strict';

const https = require('https');
const fetch = require('node-fetch');

function formatDate(date) {
    //date = new Date(date);
    console.log('date:', date)
    var year = date.substring(0, 4);
    var monthIndex = parseInt(date.substring(5, 7)) - 1;
    var day = date.substring(8, 10);

    var monthNames = [
        "Jan", "Feb", "Mar",
        "Apr", "May", "Jun", "Jul",
        "Aug", "Sep", "Oct",
        "Nov", "Dec"
    ];

    console.log(day + ' ' + monthNames[monthIndex] + ' ' + year);
    return day + ' ' + monthNames[monthIndex] + ' ' + year;
}

var getWeather = function (location, forecastDate) {
    //var url = 'https://query.yahooapis.com/v1/public/yql?q=select%20item.condition%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location + '%22)&format=json';
    var targetDate = formatDate(forecastDate);
    var url = 'https://query.yahooapis.com/v1/public/yql?q=select%20item.condition%2C%20item.forecast%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location
        + '%22)%20and%20item.forecast.date%3D%22' + targetDate + '%22%20and%20u%3D%27c%27&format=json';

    return fetch(url, {
        method: 'GET'
    })
        .then(rsp => {
            var res = rsp.json();
            console.log('yql result: ', JSON.stringify(res));
            return res;
        })
        .then(json => {
            if (json.error && json.error.message) {
                throw new Error(json.error.message);
            }
            console.log('yql result: ', JSON.stringify(json));
            var forecast = json.query.results.channel.item.forecast;
            //weatherJson.weather[0].description
            var currCondition = json.query.results.channel.item.condition;
            var forecastResult = 'Currently in ' + location + ' it is ' + currCondition.temp
                + ' C with ' + currCondition.text + '.\nHigh: ' + forecast.high + ' C, Low: ' + forecast.low + ' C.';;

            /**
                        var forecastResult = forecast.text + ' in ' + location + ' on ' + forecast.date +
                            '.\nHigh: ' + forecast.high + ' C, Low: ' + forecast.low + ' C.'; // we should call a weather API here 
             */

            console.log('forecast result: ', forecastResult);
            return json;
        });
};

var getWeatherByRange = function (location, forecastInterval) {
    //var url = 'https://query.yahooapis.com/v1/public/yql?q=select%20item.condition%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location + '%22)&format=json';
    var forecastBeginDate = formatDate(forecastInterval.from);
    var forecastEndDate = formatDate(forecastInterval.to);
    var url = 'https://query.yahooapis.com/v1/public/yql?q=select%20item.condition%2C%20item.forecast%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location
        + '%22)%20and%20item.forecast.date%20%20%3E%3D%20%22' + forecastBeginDate + '%22%20and%20%20item.forecast.date%20%20%3C%3D%20%22' + forecastEndDate + '%22%20and%20u%3D%27c%27&format=json';

    return fetch(url, {
        method: 'GET'
    })
        .then(rsp => {
            var res = rsp.json();
            //console.log('yql result: ', JSON.stringify(res));
            return res;
        })
        .then(json => {
            if (json.error && json.error.message) {
                throw new Error(json.error.message);
            }
            console.log('yql result: ', JSON.stringify(json),'\n');
            var forecastResult = '';
            if (json.query.count > 1) {
                var channels = json.query.results.channel;

                channels.forEach(function (element) {
                    var forecast = element.item.forecast;
                    forecastResult += forecast.date +'('+forecast.day+'): '+ forecast.text +', High: '+forecast.high+'°C,'+ 'Low: '+forecast.low+'°C.\n';
                }, this);
            }
            else if (json.query.count === 1) {
                var forecast = json.query.results.channel.item.forecast;
                //weatherJson.weather[0].description
                var currCondition = json.query.results.channel.item.condition;
                forecastResult = 'Currently in ' + location + ' it is ' + currCondition.temp
                    + ' C with ' + currCondition.text + '.\nHigh: ' + forecast.high + ' C, Low: ' + forecast.low + ' C.';;
            }
            else {
                //no result
            }

            console.log('forecast result: ', forecastResult);
            return json;
        });
};


//getWeather('Melbourne', new Date().toISOString());
let forecastInterval = {};
forecastInterval.from = '2017-07-12T00:00:00.000+10:00';
forecastInterval.to = '2017-07-22T00:00:00.000+10:00';
getWeatherByRange('Melbourne', forecastInterval);