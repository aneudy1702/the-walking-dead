var _ = require('lodash');
var config = require('./config');
var Q = require('q');
var PS = require('./pubsub');
var pollManager = require('./pollManager')();
var http = require('http');
var logMsg = '[Tumblr]: [Media-Mananger]: ';
var mainRepo = {
    blogs: {}
};

//get media base on tag. if a tag is not passed 
var _getBlogImages = function (params, cb) {
    var repo = mainRepo.blogs;
    var set = [];
    var since = params.since ? parseInt(params.since) : null;
    var blogHostNames = params.blogs.toString().split(',');
    var list;
    var pollSets;
    var aTime;
    var bTime;

    _.forEach(blogHostNames, function (item) {
        pollSets = pollManager.sets(), list = repo[item] || [];
        _addToSet(set, list, since);
        if (pollSets[item]) {
            pollManager.resetPollingExpiritations(item); //keep polling alive if it is being used
        } else {
            _startGathering(blogHostNames, '/posts');
        }
    });

    cb(set.sort(function (a, b) {
        aTime = parseInt(a.createdAt, 10);
        bTime = parseInt(b.createdAt, 10);
        return bTime - aTime;
    }));
};

var _addToSet = function (set, listx, since) {
    var list = listx.media ? listx.media : listx;
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

var _startGathering = function (blogHostNames, what) {
    var repo, b, blogName, length = blogHostNames.length;

    for (b = length; b--;) {
        blogName = blogHostNames[b];
        repo = mainRepo.blogs[blogName] = {};
        repo.media = [];
        repo.linksUsed = {};
        repo.info;
        _gather(repo, blogName, what);
    }
};

var _gather = function (repo, blogHostName, what) {
    var api_key = config.baseUrl.api_key,
        prefix = config.baseUrl.prefix;
    http.get(prefix + blogHostName + what + api_key, function (res) {
        var body = '';
        res.on('data', function (d) {
            body += d;
        });

        res.on('end', function () {
            body = JSON.parse(body);
            response = body.response;
            posts = response.posts;
            repo.info = response.blog;
            _.forEach(posts, function (m) {
                if (m.photos) {
                    var p, length = m.photos.length;
                    for (p = length; p--;) {
                        if (m.photos[p].original_size.url
                            .indexOf('.gif') == -1) {
                            if (!(m.post_url in repo.linksUsed)) {
                                var media = new _imageObjBuilder(
                                    m, repo.info, p);
                                repo.media.push(media);
                                repo.linksUsed[media.link] =
                                    'used';
                                console.log(logMsg +
                                    'image added to ' +
                                    blogHostName +
                                    ' with url' + media.link
                                );
                            }
                        }
                    }
                }
            });
            pollManager.activatePoll(blogHostName, what, repo);
        });
    });
};

var _mediaObjUpdater = function (blogHostName, media, index) {
    try {
        var repo = mainRepo.blogs[blogHostName],
            oldList = repo.media;
    } catch (e) {
        console.log(logMsg +
            'There was an Exception while updating media List for ' +
            blogHostName + ' - ', e);
        return;
    }

    if (media.photos[index].original_size.url.indexOf('.gif') == -1) {
        if (!(media.post_url in repo.linksUsed)) {
            media = new _imageObjBuilder(media, repo.info, index);
            repo.media.push(media);
            repo.linksUsed[media.link] = 'used';
            console.log(logMsg + blogHostName + ' added img ' +
                media.link);
        }
    }
};

var _imageObjBuilder = function (m, bloginfo, index) {
    this.text = (m.caption ? m.caption : m.tags).toString().split('#')
        .join(' #');

    var width = m.photos[index].alt_sizes[2] ? m.photos[index].alt_sizes[
        2].width : m.photos[index].original_size.width,
        height = m.photos[index].alt_sizes[2] ? m.photos[index].alt_sizes[
            2].height : m.photos[index].original_size.height;
    width = width < 480 ? 480 : width;
    height = height < 380 ? 380 : height;
    this["_source"] = "tumblr";
    this["_date"] = this["createdAt"] = Math.floor(m.timestamp * 1000);

    this["link"] = m.post_url;

    this["media"] = {
        "sizes": {
            medium: {
                w: width,
                h: height,
                resize: 'fit'
            },
            thumb: {
                w: width,
                h: height,
                resize: 'fit'
            },
            small: {
                w: width,
                h: height,
                resize: 'fit'
            },
            large: {
                w: width,
                h: height,
                resize: 'fit'
            }
        },
        "url": m.photos[index].original_size.url
    };

    this.dateAdded = new Date().getTime();

    var blogHostName = bloginfo.url.replace('http://', '');

    this["userInfo"] = {
        "id": bloginfo.updated,
        "name": bloginfo.title,
        "screen_name": bloginfo.name,
        "profile_img_url": 'http://api.tumblr.com/v2/blog/' + blogHostName + 'avatar',
        "blog_url": bloginfo.url
    }
};


module.exports.api = function () {
    return {
        init: function () {
            var blogs = mainRepo.blogs;

            PS.subscribe('iUpdatesByGetRequest', function (
                blogHostName, media, index) {
                _mediaObjUpdater(blogHostName, media, index);
            });

            PS.subscribe('Set-PollDestroyed', function (blogHostName) {
                try {
                    delete blogs[blogHostName];
                    console.log(logMsg + 'removed ' +
                        blogHostName +
                        ' from the media object and the polling queue.'
                    );
                } catch (e) {
                    console.log(logMsg +
                        'error subscribing to Set-PollDestroyed ' +
                        e);
                }
            });
        },

        getBlogImages: function (tagNames, cb) {
            _getBlogImages(tagNames, cb);
        },

        whatsPolling: function (res) {
            pollManager.whatsPolling(res);
        }
    };
};