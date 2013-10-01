var zeebox = require('zeebox'),
    twitter = require('twit'),
    _ = require('lodash'),
    instance = require('os').hostname(),
    Q = require('q'),
    PS = require('./pubsub');
    fs = require('fs'),
    getFile = require('./getFile'),
    cache = zeebox.localcache.init();

var TwitterManager = function(proxy, name){
    this.Proxy = proxy;
    this.gets = {};
    this.streams = {}; 
    this.twitterOpts = {
        pauseDelay : 300000, // wait five minutes of inactivity before pausing
        restartDelay : 60000,
        getWindow: 900000, // 15 minutes
        getRateLimit: 180,
    }
    this.logMsg = "[Twitter]: [TwitterManager]: ";
};

_.extend(TwitterManager.prototype, {

    _createStream : function(streamName, type, obj) {

        if (type === undefined || obj === undefined || streamName === undefined) {
            zeebox.logger.error(this.logMsg + 'streamName, type or params undefined.');
            return;
        }

        var streamName = getSafeName(streamName);

        //check if stream already exists
        for (var key in this.streams) {
            if (key === streamName) {
              return; 
            }
        }

        var streamObj = {
            stream: '',
            activated: false,
            streaming: false,
            disconnectTimes: 0,
            delayedForRestart: false,
            streamTimeout: 0,
            restartTimeout: 0,
        };

        //create the actual stream
        streamObj.stream = this.Proxy.stream(type, obj);

        //file it in the twitter Manager
        this.streams[streamName] = streamObj;

        zeebox.logger.info(this.logMsg + 'created stream %s', streamName);

    },

    _activateStream : function(streamName) {

        var logMsg = this.logMsg + '[activateStream]: ';
        var pauseDelay = 300000; // wait five minutes of inactivity before pausing

        if (streamName === undefined) {
            zeebox.logger.error(logMsg + 'streamName undefined.');
            return;
        }

        var streamName = getSafeName(streamName);
        var streams = this.streams;
        var publishId = this.Proxy.auth.config.consumer_key + streamName;
        var streamFound = false;
        var streamObj;
        var stream;
        var that = this;

        //check if stream has been created
        for (var key in this.streams) {
            if (key === streamName) {
                streamObj = streams[key];
                stream = streamObj.stream;
                streamFound = true;
            }
        }

        if (!streamFound) {
            zeebox.logger.error(logMsg + 'stream not found.');
            return;
        }

        // reset the timeout if this fn gets re-fired
        clearTimeout(streamObj.streamTimeout); 

        //set timeout to stop the stream if inactive
        streamObj.streamTimeout = setTimeout(function() {
            that._stopStreaming(streamObj, publishId);
        }, this.twitterOpts.pauseDelay);

        // if you are already streaming or if it's delayed for restart don't continue
        if (streamObj.streaming || streamObj.delayedForRestart) {
            return;
        }

        //stream already exits, just restart it
        if ((streamObj.activated === true) && (streamObj.streaming === false)) {
            stream.start();
            PS.publish('streamStarted', [streamName]);
            streamObj.streaming = true;
            zeebox.logger.info(logMsg + 'streaming re-started for %s', publishId);
            return;
        }

        stream.on('tweet', function(tweet) {

            PS.publish(publishId, [tweet]); //publish out the tweet for subscribers

        }); //end stream.on - tweet

        stream.on('limit', function(response) {

            zeebox.logger.info(logMsg + '%s hit a limit', publishId);
            zeebox.logger.info(response);

        }); //end stream.on - limit

        stream.on('disconnect', function (response) {

            if (streamObj.streaming) {
                zeebox.logger.info(logMsg + 'stream %s disconnected', publishId);
                metrics.inc(logMsg + 'stream %s disconnected', publishId);
            }

            zeebox.logger.info(logMsg + " - " + response.disconnect.reason);

            streamObj.disconnectTimes++;

            that._streamReconnect(streamObj, publishId);

        }); //end stream.on disconnect

        stream.on('reconnect', function (request, response, connectInterval) {

            if (streamObj.streaming) {
                zeebox.logger.info(logMsg + 'trying to reconnect %s stream after ' + connectInterval + " milliseconds", publishId);
            }

        }); //end sream.on - reconnect

        stream.on('warning', function (warning) {
            zeebox.logger.info(warning);
        });

        stream.on('status_withheld', function (withheldMsg) {
            zeebox.logger.info(withheldMsg);
        });

        stream.on('connect', function (request) {
            zeebox.logger.info(logMsg + "connection made for stream " + publishId);
        });

        streamObj.activated = true;
        streamObj.streaming = true;

        PS.publish('streamStarted', [streamName]);
        zeebox.logger.info(logMsg + 'stream activated for %s', publishId);

    },

    _stopStreaming : function(streamObj, publishId) {

        var logMsg = this.logMsg + '[stopStreaming]: ';

        streamObj.streaming = false;
        streamObj.delayedForRestart = false;

        clearTimeout(streamObj.restartTimeout);

        streamObj.stream.stop();

        PS.publish('stopStreaming', [publishId]);
        zeebox.logger.info(logMsg + 'stream %s', publishId);

    },

    _streamReconnect : function(streamObj, publishId) {

        var logMsg = this.logMsg + '[streamReconnect]: ';
        var restartDelay = 60000;
        var that = this;

        //if we got disconnected 10 times from twitter, delete the stream
        if (streamObj.disconnectTimes > 10) {
            delete this.streamObj;
            zeebox.logger.info(logMsg + 'deleting stream ' + publishId);
            return;
        }

        // don't restart if we meant to stop
        if (streamObj.streaming) { 

            clearTimeout(streamObj.restartTimeout);
            streamObj.restartTimeout = setTimeout(function(){

                streamObj.delayedForRestart = false;
                zeebox.logger.info(logMsg + 'restarting twitter stream %s', publishId);

                streamObj.streamTimeout = setTimeout(function() {
                    that._stopStreaming(streamObj, publishId);
                }, that.twitterOpts.pauseDelay);

                streamObj.stream.start();

            }, this.twitterOpts.restartDelay);

        }

    },

    _getRequest : function(type, object) {

        var logMsg = this.logMsg + '[getRequest]: ';

        if (type === undefined || object === undefined) {
            zeebox.logger.error(logMsg + 'type or object undefined.');
            return;
        }

        var safeType = getSafeName(type);
        var publishId = this.Proxy.auth.config.consumer_key + safeType;
        var that = this;
        var currentTime = new Date().getTime();
        var elapsedTime = 0;
        var deferred = Q.defer();

        //check if get type is on file
        if (typeof this.gets[safeType] === 'undefined') {
            this.gets[safeType] = {
                count: 0,
                since: new Date().getTime()
            }
        }
        else {
            elapsedTime = currentTime - this.gets[safeType].since;
        }

        // check if we've exceeded our get request limit
        if ((elapsedTime < this.twitterOpts.getWindow) && (this.gets[safeType].count >= this.twitterOpts.getRateLimit)) {
            zeebox.logger.info(logMsg + 'exceeded limit. No tweets for you!');
            deferred.reject([]);
        }
        else {

            this.Proxy.get(type, object, function(err, reply){

                if(err) {
                    that._handleErrors(err);
                    deferred.reject(new Error(err));
                    return;
                }

                //publish and promise
                PS.publish(publishId, [reply]);
                deferred.resolve(reply);

            });

            //if we're past our window reset the count
            if (elapsedTime > this.twitterOpts.getWindow) {
                this.gets[safeType].count = 0;
                this.gets[safeType].since = new Date().getTime();
            }

            this.gets[safeType].count++;

        }

        return deferred.promise;

    },
   
    /* Handle the errors
     @param {error} : error object to be handled
    */
    _handleErrors : function(err){

        var logMsg = this.logMsg + '[handleErrors]: ';

        // no connection error
        if (typeof err.code !== 'undefined') {
            zeebox.logger.error(logMsg + 'Message: ' + err.syscall + '- Internet Connection unavailable.');
        }
        else { //twitter response error
            var error = JSON.parse(err.data);
            for(var e=error.errors.length; e--;) {
                var msg = error.errors[e].message;
                var code = error.errors[e].code;
                zeebox.logger.error(logMsg + 'Message: %s, Code: %s', msg, code);
            }
           
        }

    },

});

/* 
Memoized list name method which makes lower case and no white space 
@param {name} : the unique identifier for the list 
*/
var getSafeName = _.memoize(function(name){
    return name.toLowerCase().replace(/\s/g, '_').replace(/\//g, '');
});


module.exports = {

    init : function(acct, instance){

        var twitManager;

        if(!acct) {
            zeebox.logger.error('There is no configuration for this server');
            return;
        }

        var twit = new twitter({
            consumer_key: acct.consumer_key,
            consumer_secret: acct.consumer_secret,
            access_token: acct.access_token_key,
            access_token_secret: acct.access_token_secret
        });

        twitManager = new TwitterManager(twit, instance);
        return twitManager;

    }
};