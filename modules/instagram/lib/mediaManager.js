var _ = require('lodash');
var config = require('./config');
var PS = require('./pubsub');
var instagram;
var pollManager = require('./pollManager')();
var https = require('https');
var mediaRepo = {
    tags: {
        list: {},
        polls: []
    },
    users: {
        list: {},
        polls: {}
    }
};
var logMsg = '[Instagram]:[Media-Mananger]: ';

module.exports.api = function () {
    var _getMediaByTag = function (params, cb) {
        var tagNames = params.names.split(',');
        var repo = mediaRepo.tags.list;
        var set = [];
        var since = params.since ? parseInt(params.since) : null;

        _.forEach(tagNames, function (item) {
            var pollSets = pollManager.sets(),
                list = repo[item] || [];
            addToSet(set, list, since);
            if (pollSets[item]) {
                pollManager.resetPollingExpiritations(item);
            }
        });

        cb(set.sort(function (a, b) {
            var aTime = parseInt(a.createdAt, 10);
            var bTime = parseInt(b.createdAt, 10);
            return bTime - aTime;
        }));

        startGathering(tagNames);
    };

    var _getMediaByUser = function (params, cb) {
        if (params.id === '' || params.id === void(0)) {
            console.log(logMsg + ' Invalid user id');
            cb([]);
            return;
        }

        var ids = params.id.split(',');
        var repo = mediaRepo.tags.list;
        var set = [];
        var since = params.since ? parseInt(params.since) : null;

        _.forEach(ids, function (item) {
            var pollSets = pollManager.sets(),
                list = repo[item] || [];
            addToSet(set, list, since);
            if (pollSets[item]) {
                pollManager.resetPollingExpiritations(item);
            }
        });

        cb(set.sort(function (a, b) {
            var aTime = parseInt(a.createdAt, 10);
            var bTime = parseInt(b.createdAt, 10);
            return bTime - aTime;
        }));

        startGathering(ids, true);
    };


    var addToSet = function (set, listx, since) {
        var list = listx.media ? listx.media : listx
        _.forEach(list, function (m) {
            if (since) {
                if (m.dateAdded > since) {
                    set.push(m);
                }
            } else {
                set.push(m);
            }
        });
    };


    var startGathering = function (terms, user_ids) {
        var media,
            repo,
            t,
            term;

        for (t = terms.length; t--;) {
            term = terms[t];
            if (!_.contains(mediaRepo.tags.polls, term)) { /*This means this is a new search term*/
                repo = mediaRepo.tags.list[terms] = {};
                repo.media = [];
                repo.linksUsed = {};
                gather(repo, term, user_ids);
            }
        }
    };

    var gather = function (repo, tagName, user_ids) {
        var options = {
            complete: function (data, pagination) {
                _.forEach(data, function (m, index) {
                    var media = new imageObjBuilder(m);
                    repo.media.push(media);
                    repo.linksUsed[media.link] = 'used';
                    console.log(logMsg +
                        'image added to tag/id ' + tagName +
                        ' with url ' + media.link);
                });

                mediaRepo.tags.polls.push(tagName);

                pollManager.activatePoll(tagName);
            },
            error: function (errorMessage, errorObj, caller) {
                console.log(logMsg + errorMessage + ': ' +
                    errorObj);
            }
        }

        if (!user_ids) {
            options.name = tagName;
            instagram.tags.recent(options);
        } else {
            options.user_id = tagName;
            instagram.users.recent(options);
        }
    };

    var mediaObjUpdater = function (type, tag, instagramUpdate,
        updateMediaDelay) {
        try {
            var repo = mediaRepo[type].list[tag],
                oldList = repo.media;
        } catch (e) {
            console.log(logMsg +
                'There was an Exception while updating media List for ' +
                type + ' ' + tag + ' - ' + e);
            return;
        }

        if (media.link in repo.linksUsed) {
            updateMediaDelay('+');
        } else {
            console.log(logMsg + 'image added to ' + type +
                ' ' + tag + ' with url ' + media.link);
            repo.media.push(media);
            repo.linksUsed[media.link] = 'used';
            updateMediaDelay();
        }
    };


    var imageObjBuilder = function (m, repo) {
        this.text = (m.caption ? m.caption.text : m.tags).toString().split('#').join(' #');
        this["_source"] = "instagram";
        this["_date"] = this["createdAt"] = Math.floor(parseInt(m.created_time,10) * 1000);
        this["link"] = m.link;
        this['videos'] = m.videos;
        this["media"] = {
            "sizes": {
                medium: {
                    w: m.images.standard_resolution.width,
                    h: m.images.standard_resolution.height,
                    resize: 'fit'
                },
                thumb: {
                    w: m.images.thumbnail.width,
                    h: m.images.thumbnail.height,
                    resize: 'fit'
                },
                small: {
                    w: m.images.low_resolution.width,
                    h: m.images.low_resolution.height,
                    resize: 'fit'
                },
                large: {
                    w: m.images.standard_resolution.width,
                    h: m.images.standard_resolution.height,
                    resize: 'fit'
                }
            },
            "url": m.images.standard_resolution.url
        };
        this.dateAdded = new Date().getTime();
        this["userInfo"] = {
            "id": m.user.id,
            "name": m.user.full_name,
            "screen_name": m.user.username,
            "profile_img_url": m.user.profile_picture
        }
    };

    return {

        init: function (instagramx) {
            var mediapolls = mediaRepo.tags.polls;

            instagram = instagramx;
            pollManager.init(instagram);

            PS.subscribe('iUpdatesByGetRequest', function (tag, media,
                type, updateMediaDelay) {
                mediaObjUpdater(type, tag, media,
                    updateMediaDelay);
            });

            PS.subscribe('Set-PollDestroyed', function (tagName) {
                try {
                    var index = _.indexOf(mediapolls, tagName);
                    mediapolls.splice(index, 1);
                    var repo = mediaRepo.tags.list[tagName];
                    delete repo;
                    console.log(logMsg + 'removed ' +
                        tagName +
                        ' from the media object and the polling queue.'
                    );
                } catch (e) {
                    console.log(logMsg +
                        'error subscribing to Set-PollDestroyed ' +
                        e);
                }
            });
        },

        getMediaByTag: function (params, cb) {
            _getMediaByTag(params, cb);
        },

        getMediaByUser: function (params, cb) {
            _getMediaByUser(params, cb);
        },

        whatsPolling: function (req, res) {
            pollManager.whatsPolling(res);
        }
    };
};


/*{ code: 420,
  error_type: 'OAuthRateLimitException',
  error_message: 'You have exceeded the maximum number of requests per hour. You have performed a total of 5927 requests in the last hour. Our general maximum request limit is set at 5000 requests per hour.' }
*/ //