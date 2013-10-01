var express = require('express'),
   zeebox = require('zeebox'),
   _ = require('lodash'),
   metrics = zeebox.metrics,
   PS = require('./pubsub');

module.exports = (function() {

   var streamName,
      twitterManager,
      TPMset = {
        'keywords': [],
        'timer': {},
        'startTime' : 0,
        'elapsedTime' : 0
      },
      TPMModifier = 1, // factor to modify TPM count if we hit rate cap
      countInterval = 3, //60 must evenly be divisible by this number
      logMsg = "[Twitter]: [tpmManager]: ";

   function _createKeywordSetandStream(keywordsFile) {

      var i, 
          j,
          kw,
          tpmObj,
          keywordGroup,
          keywordSets = [],
          keywords = [];

      for (i=keywordsFile.keywords.length; i--;) {
         keywordSets.push(keywordsFile.keywords[i].text);
      }
         
      for (kw = keywordSets.length; kw--;) {

         keywordGroup = keywordSets[kw];

         /* 
         For the TPM Keyword Sets
         */

         tpmObj = {
            text : keywordGroup,
            count : 0,
            totalCount : 0,
            pastCounts : [],
            mediaUrls : [],
            tpm : 0
         };
       
         TPMset.keywords.push(tpmObj);

         /* 
         For the twitter stream
         */

         if(keywordGroup.indexOf('|') !== -1) {
            keywordGroup = keywordGroup.split('|');
            for (j=keywordGroup.length; j--;) {
               keywords.push(keywordGroup[j]);
            }
         } 
         else {
            keywords.push(keywordGroup);
         }

      }

      // create the actual twitter stream
      twitterManager._createStream(streamName, 'statuses/filter', { track: keywords });

      zeebox.logger.info(logMsg + 'polling for ' + keywords.length + ' keywords');

   };
   
   function _activateTPMclock() {

      TPMset.startTime = new Date().getTime();
      TPMset.elapsedTime = 0;

      function tpmLoop() {

         if (TPMset.elapsedTime < 60)
            TPMset.elapsedTime += countInterval;

         _calculateTPM();

         TPMset.timer = setTimeout(function(){
            tpmLoop();
         }, (countInterval * 1000));

      };

      TPMset.timer = setTimeout(function(){
         tpmLoop();
      }, (countInterval * 1000));

   };

   function _clearTPMclock() {
      
      var kw,
          keywords = TPMset.keywords;

      TPMset.elapsedTime = 0;
      clearTimeout(TPMset.timer); //clear the timing loop

      for (kw = keywords.length; kw--;) {
         keywords[kw].pastCounts = [];
         keywords[kw].count = 0;
         keywords[kw].tpm = 0;
      }
  };

   function _calculateTPM() {

      var kw,
          n,
          elapsedCount,
          tempTime,
          elapsedTime = TPMset.elapsedTime,
          keywords = TPMset.keywords;

      if (elapsedTime === 0)
         elapsedTime = (new Date().getTime() - TPMset.startTime) / 1000;

      for (kw = keywords.length; kw--;) {

         keywords[kw].pastCounts.push(parseInt(keywords[kw].count, 10));
         
         if (keywords[kw].pastCounts.length > (60 / countInterval))
            keywords[kw].pastCounts.shift();

         elapsedCount = 0;

         for (n = keywords[kw].pastCounts.length; n--;) {
            elapsedCount += keywords[kw].pastCounts[n];
         }

         keywords[kw].tpm =  Math.ceil((60 / elapsedTime) * elapsedCount * TPMModifier);
         keywords[kw].count = 0; //reset the count

      }

   };

   function _updateKeywordsCount(tweetData) {

      var kw,
          keywordSet,
          tweetString = tweetData.text.toLowerCase(),
          keywords = TPMset.keywords;

      for (kw = keywords.length; kw--;) {
         keywordSet = keywords[kw].text;
         if (testTweet(tweetString, keywordSet) !== -1) {
            keywords[kw].count++;
            keywords[kw].totalCount++;
         }
      }

      function testTweet(tweetString, keywordSet) {
         if(keywordSet.indexOf('|') !== -1) {
            keywordSet = keywordSet.split('|');
            for(var k = 0; k < keywordSet.length; k++) {
               if(tweetString.indexOf(keywordSet[k].toLowerCase()) !== -1)
                  return 1
            }
            return -1;
         } else {
            return tweetString.indexOf(keywordSet.toLowerCase());
         }
      };

   };

   return {

      init: function(twit, keywordsFile, name) {

         if (twit === undefined || keywordsFile === undefined || (keywordsFile.keywords.length < 1)) {
            zeebox.logger.error(logMsg + 'twit auth error or problem with keywords file.');
            return;
         }

         var getSafeName = _.memoize(function(name){
             return name.toLowerCase().replace(/\s/g, '_').replace(/\//g, '');
         });

         var name = getSafeName(name),
             subscribeID = twit.Proxy.auth.config.consumer_key + name;

         streamName = name;
         twitterManager = twit;

         _createKeywordSetandStream(keywordsFile);

         /*
         Event Listeners
         */

         PS.subscribe(subscribeID, function(tweet){
            _updateKeywordsCount(tweet);
         });

         PS.subscribe('stopStreaming', function(){
            _clearTPMclock();
         });

         PS.subscribe('streamStarted', function(){
            _activateTPMclock();
         });

         zeebox.logger.info(logMsg + name + ' intialized and is listening for tweets with this id ' + subscribeID);

      },

      getTweetCounts: function(query) {

         var keywordsRequested = query.keywords || '',
             kwr = keywordsRequested.split(','),
             responseJSON = { keywords: [] };

         for(var k=kwr.length; k--;) {

            for(var ks = TPMset.keywords.length; ks--;) {
               if(decodeURIComponent(kwr[k]) === TPMset.keywords[ks].text) {
                responseJSON.keywords.push(TPMset.keywords[ks]);
               }
            }

         }

         return responseJSON;

      }

   };

})();