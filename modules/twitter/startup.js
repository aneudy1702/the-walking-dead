// //downloaded and core modules
// var http = require('http');
// var express = require('express');
// var fs = require('fs');
// var instance = require('os').hostname();
// var _ = require('lodash');
// var Q = require('q');
// var twitter = require('twit');

// //zeebox modules
// var zeebox = require('zeebox');
// var metrics = zeebox.metrics;

// //custom utility modules
// var PS = require('./lib/pubsub');
// var getFile = require('./lib/getFile');
  
// //custom modules
// var tpmManager = require('./lib/tpm'); //tweets per minute
// var pollManager = require('./lib/pollManager');
// var mediaManager = require('./lib/mediaManager');
// var twitterManager = require('./lib/twitterManager');

// var port = 8080;
 
// var twitterCreds;
// var keywordsFile;
// var accountName; //primary twitter acct from which to get lists

// var twit1;
// var tpm1;
// var pollM1;

// var appsIntialized = false;

// var logMsg = '[twitter]: ';

module.exports = function(app) {

//   /* get our set of twitter user credentials */

//   var twittercredsF = getFile.asJSON(__dirname + '/twitter_config.json').then(function(jsonRes){

//     twitterCreds = jsonRes;

//     if(instance.indexOf('local') !== -1) {
//       if(instance.indexOf('Jordan') !== -1) {
//         instance = 'local-jordan';
//       }
//       else if (instance.indexOf('Aneudy') !== -1) {
//         instance = 'local-aneudy';
//       }
//       else {
//         instance = 'local';
//       }
//     }

//     twit1 = twitterManager.init(twitterCreds[instance], instance);
//     zeebox.logger.info("[Twitter]: intialied with consumer_key " + twitterCreds[instance].consumer_key);

//   });

//   /* get our keywords file */
//   var keywordsFileF = getFile.asJSON(__dirname + '/keywords.json').then(function(jsonRes){
//     keywordsFile = jsonRes;
//   });

//   //check to see if all files have been gotten, then start stuff
//   Q.all([keywordsFileF, twittercredsF]).done(function () {

//     //tweets per minute set up
//     tpmManager.init(twit1, keywordsFile, 'tpm1');

//     //poll manager set up
//     pollM1 = new pollManager();
//     pollM1.init(twit1);

//     //image manager set up
//     mediaM1 = new mediaManager();
//     mediaM1.init();

//     appsIntialized = true;

//   });

//   app.use('/openbox-us/twitter', express['static'](__dirname + '/public'));

//   //tweets per minute 
//   app.get('/openbox-us/twitter/tpm', function(req, res) {

//     res.set('Cache-Control', 'max-age=5');

//     if (appsIntialized) {
//       twit1._activateStream('tpm1');
//       res.json(tpmManager.getTweetCounts(req.query));
//     }

//   });

//   //get tweets with images 
//   app.get('/openbox-us/twitter/media', function(req, res){
    
//     res.set('Cache-Control', 'max-age=5');

//     if (appsIntialized) {
//       mediaM1.startGathering(req.query, pollM1);
//       res.json(mediaM1.getMedia(req.query));
//     }

//   });

//   //what's currently polling
//   app.get('/openbox-us/twitter/whatsPolling', function(req, res){
    
//     res.set('Cache-Control', 'max-age=5');

//     res.json(pollM1.whatsPolling());

//   });

//   //keywords file
//   app.get('/openbox-us/twitter/keywords', function(req, res){

//     res.set('Cache-Control', 'max-age=5');
//     res.json(keywordsFile);
 
//   }); 

//   /*
//   Legacy Routes
//   */
//    app.get('/openbox-us/buzz/twitter/keywords/', function(req, res) {

//     res.set('Cache-Control', 'max-age=5');

//     if (appsIntialized) {
//       twit1._activateStream('tpm1');
//       res.json(tpm1.getTweetCounts(req.query));
//     }

//   });

//   app.get('/openbox-us/buzz/twitter/mediaLists', function(req, res){  

//     res.set('Cache-Control', 'max-age=5');

//     if (appsIntialized) {
//       mediaM1.startGathering(req.query, pollM1);
//       res.json(mediaM1.getMedia(req.query));
//     }

//   });

//   app.get('/openbox-us/buzz/keywords', function(req, res){

//     res.set('Cache-Control', 'max-age=5');
//     res.json(keywordsFile);

//   });

  return true;

};