var zeebox = require('zeebox'),
    _ = require('lodash'),
    PS = require('./pubsub');
    cache = zeebox.localcache.init(),
    metrics = zeebox.metrics;


var PollManager = function (twit) {
   this.twit = twit;
   this.sets = {};
   this.mediaDelay = 10000;
   this.stopPollTime = 300000; //five minutes
   this.expirationTime = 604800000; // one week
   this.logMsg = '[PollingMananger]: ';
};

_.extend(PollManager.prototype, {

   _PollingLoop: function(type, setId) {

      var logMsg = this.logMsg + '[pollingLoop]: ';
      var since = this.sets[type].Polls[setId].last_id;
      var restObj = this.sets[type].Polls[setId].restObj;
      var that = this;
      var adjustedDelay = 0;
      var validPoll = false;

      if(this.sets[type].Polls[setId].polling === false) {
         return;
      }

      //adjust the media delay based on how many polls are polling (per type)
      for (var p=this.sets[type].IDs.length; p--;) {
         var sid = this.sets[type].IDs[p];
         if(this.sets[type].Polls[sid].polling) {
            adjustedDelay += this.mediaDelay;
         }
      }

      (function (setId, restObj, since, type, delay) {

         var tweets;
         var tempSinceId = since;
         restObj.since_id = since;
         
         that.twit._getRequest(type, restObj).then(function(data){

            tweets = (data.statuses) ? data.statuses : data;

            for(var t=tweets.length; t--;) { 

               if (tweets[t].id > that.sets[type].Polls[setId].last_id) {
                  PS.publish('TweetsByGetRequest', [setId, tweets[t]]); 
               }

               //update most recent tweet time
               if (tweets[t].id > tempSinceId) {
                  tempSinceId = tweets[t].id;
               }

            }

            that.sets[type].Polls[setId].last_id = tempSinceId;
            
            that.sets[type].Polls[setId].rePoll = setTimeout(function(){
               that._PollingLoop(type, setId);
            }, delay);

         }, function(error){
               zeebox.logger.error(logMsg + " not pollling " + setId + " - " + error + "");
               that.sets[type].Polls[setId].polling = false;
         });

      })(setId, restObj, since, type, adjustedDelay);

   },

   _stopPolling: function(type, setId) {

      this.sets[type].Polls[setId].polling = false;
      clearTimeout(this.sets[type].Polls[setId].rePoll);
      zeebox.logger.info(this.logMsg + 'stopped polling set: ' + setId);

   },

   _deleteSet: function(setId, message) {
   
      //clear the polling loop and the expiration timeout
      clearTimeout(this.sets[type].Polls[setId].expiration);
      clearTimeout(this.sets[type].Polls[setId].stopPoll); 
      clearTimeout(this.sets[type].Polls[setId].rePoll); 

      delete this.sets[type].Polls[setId];
      this.sets[type].IDs.splice(this.sets[type].IDs.indexOf(setId), 1);
      PS.publish('SetDestroyed', [setId]);
      zeebox.logger.info(this.logMsg + '[deleteSet]: because its ' + message +' Deleted: ' + setId);

   },

});

module.exports = function() {

   var pollManager;

   return {

      init : function (twit) {
         if(twit === undefined) {
            zeebox.logger.info(logMsg + 'no twit passed to init.');
            return;
         }

         pollManager = new PollManager(twit);
      },

      activatePoll: function (type, restObj, setId) {

         var logMsg = pollManager.logMsg + '[activatePolling]: ';
         var sets = pollManager.sets;
         var restart = false;

         if ((restObj === undefined) || (type === undefined) || (setId === undefined)) {
            zeebox.logger.error(logMsg + 'object, type or setId not passed.');
         }

         // create set type
         if (typeof sets[type] === 'undefined') {
            sets[type] = {
               IDs : [],
               Polls : {}
            };
         }

         // if set exists, notify restart
         if ((sets[type].IDs.indexOf(setId) !== -1) && (sets[type].Polls[setId].polling === false)) {
            restart = true;
         }

         // if set doesn't exist, create it
         if (sets[type].IDs.indexOf(setId) === -1) {

            sets[type].IDs.push(setId);
            sets[type].Polls[setId] = {
               restObj: restObj,  
               polling: false,
               expiration: {},
               stopPoll: {},
               rePoll: {},
               last_id: 000000000000000001
            };

         }

         // clear stop poll and expiration timeouts
         clearTimeout(sets[type].Polls[setId].stopPoll); 
         clearTimeout(sets[type].Polls[setId].expiration); 

         //set timeout to stop the poll if inactive
         sets[type].Polls[setId].stopPoll = setTimeout(function() {
            pollManager._stopPolling(type, setId);
         }, pollManager.stopPollTime);

         //set timeout to delete the poll if inactive
         sets[type].Polls[setId].expiration = setTimeout(function() {
            pollManager._deleteSet(type, setId, 'Inactive');
         }, pollManager.expirationTime);

         // if not already polling, begin the polling loop
         if (sets[type].Polls[setId].polling === false) {
            pollManager.sets[type].Polls[setId].polling = true;
            pollManager._PollingLoop(type, setId);
            if (restart) {
               zeebox.logger.info(logMsg + 'restarted polling: ' + setId);
            }
            else {
               zeebox.logger.info(logMsg + 'started polling: ' + setId);
            }
            
         }

      },

      whatsPolling : function () {

         var setsPolling = {};

         for (var key in pollManager.sets) {
            var setIds = pollManager.sets[key].IDs;
            setsPolling[key] = [];
            for (var s=setIds.length; s--;) {
               if (pollManager.sets[key].Polls[setIds[s]].polling) {
                  setsPolling[key].push(setIds[s]);
               }
            }
         }

         return setsPolling;

      }

   };

};