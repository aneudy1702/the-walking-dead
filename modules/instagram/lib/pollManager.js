var _ = require('lodash');
var PS = require('./pubsub');
var https = require('https');
var config = require('./config');
var Instagram;
var pollSets = {};
var MEDIA_DELAY = 4968;
var STOP_POLL_TIME = 300000; //five minutes
var EXPIRATION_TIME = 604800000; // one week
var logMsg = '[Instagram-PollingMananger]: ';

Object.size = function (obj) {
    var size = 0,
        key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            size++;
        }
    }
    return size;
};

var _PollingLoop = function (tagName) {
    var logMsg = logMsg + '[pollingLoop]:[tag] ';
    var adjustedDelay = (MEDIA_DELAY * Object.size(pollSets));
    var validPoll = false;
    var set = pollSets[tagName];

    if (!set.polling && !set.restart) {
        return;
    }
    set.polling = true;
    set.restart = false;

    (function (tag, delay, instagram) {
        instagram.tags.recent({
            name: tag,
            complete: function (data, pagination) {
                _.forEach(data, function (m) {
                    try {
                        PS.publish('iUpdatesByGetRequest', [
                            tag, m, 'tags',
                            function (add) {
                                delay = add ? delay +
                                    200 : delay - 100;
                            }
                        ]);
                    } catch (e) {
                        console.log(logMsg +
                            " not polling " + tag + " - " +
                            e);
                        console.log(logMsg +
                            " Restarting " + tag);
                        _PollingLoop(tagName);
                    }
                });

                set.rePoll = setTimeout(function () {
                    _PollingLoop(tagName);
                }, delay);
            },
            error: function (errorMessage, errorObj, caller) {
                console.log(logMsg + " not polling " +
                    tag + " - " + errorMessage + " - " +
                    errorObj);
                set.polling = false;
                set.stop = true;

                console.log(logMsg + " Restarting " +
                    tag);

                set.rePoll = setTimeout(function () {
                    _PollingLoop(tagName);
                }, delay);

                return;
            }
        });
    })(tagName, adjustedDelay, Instagram);
};

var _PollingLoopByUser = function (userId, restart) {
    var _logMsg = logMsg + '[pollingLoop]:[user] ';
    var adjustedDelay = (MEDIA_DELAY * Object.size(pollSets));
    var validPoll = false;
    var set = pollSets[userId];

    if (!set.polling) {
        return;
    }

    if (restart) {
        console.log(_logMsg + 'restarted polling for ' +
            userId);
    }

    (function (userId, delay) {
        var access_token = config.baseUrl.access_token;
        var prefix = config.baseUrl.prefix;
        var options = {
            host: 'api.instagram.com',
            port: null,
            method: 'GET',
            path: prefix + userId + access_token
        };

        https.get(options, function (res) {

            var body = '';
            res.on('data', function (d) {
                body += d;
            });

            res.on('end', function () {
                try {
                    body = JSON.parse(body);
                    var data = body.data;
                    _.forEach(data, function (m) {
                        PS.publish(
                            'iUpdatesByGetRequest', [
                                userId, m, 'users'
                            ]);
                    });
                } catch (e) {
                    console.log(_logMsg +
                        " not polling for " + userId +
                        " - " + e);
                    console.log(_logMsg +
                        " Restarting " + userId);
                    _PollingLoopByUser(userId, true);
                }

                set.rePoll = setTimeout(function () {
                    _PollingLoopByUser(userId);
                }, delay);
            });
        }).on('error', function (e) {
            console.log(e);
        });

    })(userId, adjustedDelay);
};

var _stopPolling = function (tagName) {
    try {
        var set = pollSets[tagName];
        set.polling = false;
        set.restart = true;
        set.stop = true;
        clearTimeout(set.rePoll);
        clearTimeout(set._stopPolling);
        console.log(logMsg + '[deleteSet-Poll]: ' + tagName +
            ' has being stopped.');
    } catch (e) {
        console.log(logMsg + '[deleteSet-Poll]: ' + tagName +
            ' hasn\'t being stopped.');
    }
};

var _deleteSet = function (tagName) {
    try {
        var set = pollSets[tagName];

        clearTimeout(set.expiration);
        clearTimeout(set.stopPoll);
        clearTimeout(set.rePoll);
        clearTimeout(set._deleteSet);
        delete set;

        PS.publish('Set-PollDestroyed', [tagName]);
        console.log(logMsg + '[deleteSet-Poll]: ' + tagName +
            ' due to a week of inactivity.');
    } catch (e) {
        console.log(logMsg + '[deleteSet-Poll]: ' + tagName +
            ' hasn\'t being deleted.');
    }
};

module.exports = function () {


    return {

        init: function (instagram) {
            Instagram = instagram;

            if (Instagram === undefined) {
                console.log(logMsg +
                    'Instagram instance is missing');
                return;
            }

        },

        activatePoll: function (tagName, isByUser) {
            var _logMsg = logMsg + '[activatePolling]: ';
            var sets = pollSets;
            var restart = false;

            if (tagName === undefined) {
                console.log(_logMsg +
                    'tag name not passed. not polling');
                return;
            }

            // create set type
            var set = sets[tagName];
            if (set === undefined) {
                set = sets[tagName] = {
                    name: tagName,
                    isByUser: isByUser,
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
                _stopPolling(tagName);
            }, STOP_POLL_TIME);

            //set timeout to delete the poll if inactive
            set.expiration = setTimeout(function () {
                _deleteSet(tagName, 'Inactive');
            }, EXPIRATION_TIME);
            set.expirationTimeSet = true;
            // if not already polling, begin the polling loop
            if (!set.polling) {
                set.polling = true;
                if (!isByUser) {
                    _PollingLoop(tagName);
                } else {
                    _PollingLoopByUser(tagName);
                }

                if (restart) {
                    console.log(_logMsg +
                        'restarted polling: ' + tagName);
                } else {
                    console.log(_logMsg + 'started polling: ' +
                        tagName);
                }
            }
        },

        sets: function () {
            return pollSets;
        },

        resetPollingExpiritations: function (tagName) {
            var sets = pollSets;
            var set = sets[tagName];

            // clear stop poll and expiration timeouts
            clearTimeout(set.stopPoll);
            clearTimeout(set.expiration);

            //set timeout to stop the poll if inactive
            set.stopPoll = setTimeout(function () {
                _stopPolling(tagName);
            }, STOP_POLL_TIME);

            //set timeout to delete the poll if inactive
            set.expiration = setTimeout(function () {
                _deleteSet(tagName, 'Inactive');
            }, EXPIRATION_TIME);

            if (!set.polling) {
                set.restart = true;
                this.activatePoll(tagName, set.isByUser);
            }
        },

        whatsPolling: function (res) {
            var result = [],
                sets = pollSets,
                setsLength = Object.size(sets);

            if (setsLength > 0) {
                _.forEach(sets, function (set) {
                    if (!set.polling) {
                        result.push('The tag/user ' + set.name +
                            ' is currently stopped');
                    } else {
                        result.push('The tag/user ' + set.name +
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