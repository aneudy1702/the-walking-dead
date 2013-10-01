var _ = require('lodash');
var PS = require('./pubsub');
var Q = require('q');
var http = require('http');
var pollSets = {};
var mediaDelay = 3600;
var stopPollTime = 300000; //five minutes
var expirationTime = 604800000; // one week
var logMsg = '[Tumblr]:[PollingMananger]: ';
var count = 0;
var Mainrepo;
var config = require('./config');

Object.size = function (obj) {
    var size = 0,
        key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

var _PollingLoop = function (blogHostName, what, repo) {
    var _logMsg = logMsg + '[PollingLoop]: ';
    var adjustedDelay = (mediaDelay * Object.size(pollSets));
    var validPoll = false;
    var set = pollSets[blogHostName];

    if (!set.polling && !set.restart) {
        return;
    }
    set.polling = true;
    set.restart = false;

    //adjust the media delay based on how many polls are polling (per type)        
    (function (blogHostName, what, repo, delay) {
        var api_key = config.baseUrl.api_key;
        var prefix = config.baseUrl.prefix;

        http.get(prefix + blogHostName + what + api_key +
            '&limit=50', function (res) {
                var body = '';
                res.on('data', function (d) {
                    body += d;
                });

                res.on('end', function () {
                    var p, length;
                    try {
                        body = JSON.parse(body);
                        response = body.response;
                        repo.info = response.blog;
                        _.forEach(response.posts, function (m) {
                            if (m.photos) {
                                p, length = m.photos.length;
                                for (p = length; p--;) {
                                    PS.publish(
                                        'iUpdatesByGetRequest', [
                                            blogHostName,
                                            m, p
                                        ]);
                                }
                            }
                        });
                    } catch (e) {
                        console.log(_logMsg +
                            " not polling " + blogHostName +
                            " - " + e);
                        console.log(_logMsg +
                            " Restarting " + blogHostName);
                        //this is a purposed duplicate
                        pollSets[blogHostName].rePoll =
                            setTimeout(function () {
                                _PollingLoop(blogHostName,
                                    what, repo);
                            }, delay);
                    }

                    pollSets[blogHostName].rePoll =
                        setTimeout(function () {
                            _PollingLoop(blogHostName,
                                what, repo);
                        }, delay);

                })
            });
    })(blogHostName, what, repo, adjustedDelay);
};

var _stopPolling = function (blogHostName) {
    try {
        var set = pollSets[blogHostName];

        set.polling = false;
        set.stop = true;

        clearTimeout(set.rePoll);
        clearTimeout(set._stopPolling);

        console.log(logMsg + '[deleteSet-Poll]: ' +
            blogHostName + ' has being stopped.');
    } catch (e) {
        console.log(logMsg + '[deleteSet-Poll]: ' +
            blogHostName + ' hasn\'t being stopped.');
    }
};

var _deleteSet = function (blogHostName) {
    try {

        var set = pollSets[blogHostName];

        clearTimeout(set.expiration);
        clearTimeout(set.stopPoll);
        clearTimeout(set.rePoll);
        clearTimeout(set._deleteSet);
        delete set;

        PS.publish('Set-PollDestroyed', [blogHostName]);
        console.log(logMsg + '[deleteSet-Poll]: ' +
            blogHostName + ' due to a week of inactivity.');

    } catch (e) {
        console.log(logMsg + '[deleteSet-Poll]: ' +
            blogHostName + ' hasn\'t being deleted.');
    }
};

module.exports = function () {

    var pollManager;

    return {

        activatePoll: function (blogHostName, what, repo) {
            var _logMsg = logMsg + '[activatePolling]: ';
            var restart = false;
            var sets = pollSets;

            if (blogHostName === undefined) {
                console.log(_logMsg +
                    'blogHostName not passed.');
                return;
            }

            mainRepo = repo;

            // create set type
            var set = sets[blogHostName];
            if (set === undefined) {
                set = sets[blogHostName] = {
                    name: blogHostName,
                    what: what,
                    polling: false,
                    stop: false,
                    poll: null,
                    expiration: {},
                    stopPoll: {},
                    rePoll: {},
                    last_id: 000000000000000001
                };
            }

            // if set exists, notify restart
            if (set.stop) {
                set.stop = false;
                restart = true;
            }

            // clear stop poll and expiration timeouts
            clearTimeout(set.stopPoll);
            clearTimeout(set.expiration);

            //set timeout to stop the poll if inactive
            set.stopPoll = setTimeout(function () {
                _stopPolling(blogHostName);
            }, stopPollTime);

            //set timeout to delete the poll if inactive
            set.expiration = setTimeout(function () {
                _deleteSet(blogHostName, 'Inactive');
            }, expirationTime);
            set.expirationTimeSet = true;

            // if not already polling, begin the polling loop
            if (!set.polling) {
                set.polling = true;
                _PollingLoop(blogHostName, what, repo);

                if (restart) {
                    console.log(_logMsg +
                        'restarted polling: ' + blogHostName);
                } else {
                    console.log(_logMsg + 'started polling: ' +
                        blogHostName);
                }
            }
        },

        sets: function () {
            return pollSets;
        },

        resetPollingExpiritations: function (blogHostName) {
            var sets = pollSets,
                set = sets[blogHostName];
            // clear stop poll and expiration timeouts
            clearTimeout(set.stopPoll);
            clearTimeout(set.expiration);

            //set timeout to stop the poll if inactive
            set.stopPoll = setTimeout(function () {
                _stopPolling(blogHostName);
            }, stopPollTime);

            //set timeout to delete the poll if inactive
            set.expiration = setTimeout(function () {
                _deleteSet(blogHostName, 'Inactive');
            }, expirationTime);
            if (!set.polling) {
                set.restart = true;
                this.activatePoll(blogHostName, set.what, mainRepo);
            }
        },

        whatsPolling: function (res) {
            var result = [],
                sets = pollSets,
                setsLength = Object.size(sets);
            if (setsLength > 0) {
                _.forEach(sets, function (set) {
                    if (!set.polling) {
                        result.push('The blog ' + set.name +
                            ' is currently stopped');
                    } else {
                        result.push('The blog ' + set.name +
                            ' is currently polling');
                    }
                });
            } else {
                result.push('There is nothing polling.')
            }
            res.send(result);
        }
    }; // return statement ends here
};