var twitter = require('twit'),
    _ = require('lodash'),
    Q = require('q'),
    PS = require('./pubsub');
    getFile = require('./getFile'),
    cache = zeebox.localcache.init(),
    noVideo = false,
    https = require('https'),
    htmlparser = require("htmlparser");
    // require('http').globalAgent.maxSockets = 100000;

//custom utility modules
var util = require('./utility');

var ImageCollection = function(twit){
   this.mediaSets = {};
   this.setIds = []; 
   this.logMsg = '[Twitter]: [MediaManager]: ';
   this._setListeners();
};

_.extend(ImageCollection.prototype, {

   _setListeners: function () {

      var logMsg = this.logMsg + '[listListener]: ';
      var that = this;

      PS.subscribe('TweetsByGetRequest', function (setId, tweet) {             
         var vsid = util.validIdGenerator(setId);
         if (that.setIds.indexOf(setId) !== -1) {                             
            that._filterTweetForImage(setId, tweet, noVideo);                                      
         }
      });

      PS.subscribe('SetDestroyed', function (setId) {
         var vsid = util.validIdGenerator(setId);
         if (that.setIds.indexOf(setId) !== -1) {
            delete that.mediaSets[setId];
            that.setIds.splice(that.setIds.indexOf(setId), 1);
         }
         zeebox.logger.info(logMsg + 'Destoryed this list: ' + setId);
      });

      PS.subscribe('SetReset', function (setId) {
         var vsid = util.validIdGenerator(setId);
         if (that.setIds.indexOf(setId) !== -1) {
            that.mediaSets[setId] = []; //clear the set of stored media objects
         }
         zeebox.logger.info(logMsg + 'Reset this list: ' + setId);
      });

      PS.subscribe('SetInvalid', function (setId) {
         var vsid = util.validIdGenerator(setId);
         if (that.setIds.indexOf(setId) !== -1) {
            delete that.mediaSets[setId];
            that.setIds.splice(that.setIds.indexOf(setId), 1);
         }
         zeebox.logger.info(logMsg + 'This list is invalid: ' + setId + '. Total Lists: ' + that.setIds);
      });

   },

   _filterTweetForImage: function (setId, tweet, noVideo) {

      var logMsg = this.logMsg + '[filterTweetForImage]: ';

      //create empty set if not there
      if(typeof this.mediaSets[setId] === 'undefined') {
        this.mediaSets[setId] = {
          mediaObjs : [],
          imagesUsed : []
        };
      }
      var mediaSet
      var mediaEntity = tweet.entities.media;
      var urls = tweet.entities.urls;
      
      if (urls !== undefined) {
        this._mineImagesFromUrls(urls, tweet, setId);
      }
    
      if (!mediaEntity && tweet.retweeted_status) {
        mediaEntity = tweet.retweeted_status.entities.media;
      }       

      var vineUrl;
      
      if (mediaEntity) {
        this._buildObj(mediaEntity, tweet, setId);
      }

      var _this = this;
      _this._validVine(urls, function (videos) {        
        mediaEntity = {};
        mediaEntity.videos = videos;
        _this._buildObj(mediaEntity, tweet, setId);                      
      });
   },

   _validVine : function (urls, cb) {
        if (urls.length > 0 && urls[0].expanded_url.indexOf('vine') !== -1) {
            var _this = this;
            var url = urls[0].expanded_url;
            
            handler = new htmlparser.DefaultHandler(function (error, dom) {
                if (!error) {          
                    _.forEach(dom, function (domEl, index) {
                        if (domEl.raw === 'html') {
                            var videoInfo = _this.getBodyElement(domEl.children);
                            cb(videoInfo);
                        }
                    });
                }
            });
            // 'https://v.cdn.vine.co/r/thumbs/2BF0C3A7-F945-44C2-BD07-330734A62690-3123-0000049E6CF29B61_1fc11a71b44.1.3.mp4.jpg'            
            var path = url.split('https://vine.co')[1];
             var options = {
                host: 'vine.co',                               
                path: path,
                method: 'GET'
            };

            console.log(options)
            
            var _req = https.get(options, function (res) {
                res.setEncoding('utf8');
                if (res.statusCode !== 200) return;
                parser = new htmlparser.Parser(handler);                
                var body = '';
                res.on('data', function (d) { body += d; }); 
                res.on('end', function () { parser.parseComplete(body); });                
            });
            req.end();
            req.on('error', function (e) {
                console.log('error trying to reques vine url: ' + url, 'error: ' + e);
            });

            //don't increase server response latency. returns true, and the html parsing is treated as a promise.
            return true;
        } else {
            return false;
        }
   },

   getBodyElement: function (htmlChildren) {
        var length = htmlChildren.length,
            index, 
            bodyChildren, 
            bodyChildrenLength, 
            divCardChildren, 
            divCardChildrenLength, 
            videoContainer,
            videoContainerLength, 
            videoContainerChildren, 
            poster, 
            sourceUrl, 
            sourceType;

        for (index = length; index--;) {            
            if (htmlChildren[index].name === 'body') {
              bodyChildren = htmlChildren[index].children;
              bodyChildrenLength = bodyChildren.length;
              break;
            }
        }

        for (index = bodyChildrenLength; index--;) {            
            if (bodyChildren[index].raw === 'div class="card"') {
                divCardChildren = bodyChildren[index].children;
                divCardChildrenLength = divCardChildren.length;
                break;
            }
        }

        for (index = divCardChildrenLength; index--;) {
            if (divCardChildren[index].raw === 'div class="video-container"') {
                videoContainer = divCardChildren[index].children;
                videoContainerLength = videoContainer.length;
                break;
            }
        }

        for (index = videoContainerLength; index--;) {
            if (videoContainer[index].name === 'video') {
                poster = videoContainer[index].attribs.poster;
                videoContainerChildren = videoContainer[index].children;
                videoContainerChildrenLength = videoContainerChildren.length;
                break;
            }
        }

        for (index = videoContainerChildrenLength; index--;) {
            if (videoContainerChildren[index].name === 'source') {
                source = videoContainerChildren[index];
                sourceUrl = source.attribs.src;
                sourceType = source.attribs.type;
                break;
            }
        }

        return {
            url: sourceUrl.split('?')[0], 
            type: sourceType, 
            poster: poster,
            width: 460,
            height: 460
        };      
    },

    _buildObj: function (imageInfo, tweet, setId) {    
      var imgUrl;
      var sizeObj;
      var tweetDate = new Date(tweet.created_at).getTime();
      var currentDate = new Date().getTime();      
      
      if (imageInfo) { 
        if (!imageInfo.videos) {
            imageInfo = imageInfo[0];
            if (imageInfo.media_url) {        
                imgUrl = imageInfo.media_url;        
                sizeObj = imageInfo.sizes;
            } else { //instagram image
                imgUrl = imageInfo.url;
                sizeObj = {
                    "medium": {
                        "w": imageInfo.width,
                        "h": imageInfo.height
                    }
                };
            zeebox.logger.info("Got instagram image.");
            }
        } else {                    
            imgUrl = imageInfo.videos.poster.split('?')[0];
            sizeObj = {
                "medium": {
                    "w": imageInfo.videos.width,
                    "h": imageInfo.videos.height
                }
            };
        }         
      }              
                  
      if(this.mediaSets[setId].imagesUsed.indexOf(imgUrl) !== -1) {
        return false;
      }
      else {
        this.mediaSets[setId].imagesUsed.push(imgUrl);
      }        
      
      var mediaObj = {
        "_source": "twitter",
        "text": tweet.text,
        "id": tweet.id_str,
        "_date": tweetDate,
        "createdAt": tweet.created_at, 
        "media": {
          "sizes": sizeObj,
          "url": imgUrl          
        },
        "videos": imageInfo.videos,
        "dateAdded": currentDate,
        "userInfo": {
          "id": tweet.user.id_str,
          "name": tweet.user.name,
          "screen_name": tweet.user.screen_name,
          "profile_img_url": tweet.user.profile_image_url
        }
      };      
      
      this.mediaSets[setId].mediaObjs.push(mediaObj);
      
      if(this.mediaSets[setId].mediaObjs.length > 100) {
        this._pruneMediaSet(setId);
      }

      zeebox.logger.info(this.logMsg + 'list %s added img %s', setId, imgUrl);
   },

   _mineImagesFromUrls: function (urls, tweet, setId) {

      var possibleImageUrl = '';

        for(var u = 0; u < urls.length; u++) {
          
         possibleImageUrl = urls[u].expanded_url;

         //check for instragram Image
         if (possibleImageUrl.indexOf('instagr.am') !== -1) {
            this._fetchInstagramImage(possibleImageUrl, tweet, setId);
            zeebox.logger.info("Possible instragram image");
         } 

      }

   },

   _fetchInstagramImage: function (shortUrl, tweet, setId) {

      var logMsg = this.logMsg + '[fetchInstagramImage]: ';
      var path = '/oembed?url=' + shortUrl;
      var options = {
        host: 'api.instagram.com',
        port: 80,
        path: path,
        method: 'GET'
      };

      var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          if(chunk != 'No Media Match') {
            var imageInfo = JSON.parse(chunk);
            this._buildObj(imageInfo, tweet, setId);
          }
        });
      });

      req.on('error', function(e) {
        zeebox.logger.error(logMsg + 'problem with request: ' + e.message);
      });

      req.end();

   },

   _pruneMediaSet: function (listId) {

       this.mediaSets[listId].mediaObjs.splice(80, this.mediaSets[listId].mediaObjs.length-1);

   }

});

module.exports = function () {

   var imageCollection;

   return {

      init: function() {
         imageCollection = new ImageCollection();
      },

      startGathering: function (query, pollManager) {

         var logMsg = '[ImageCollection]: [setUpSets]: ';

         if (query.lists === undefined && query.keywords === undefined) {
            zeebox.logger.error(logMsg + 'no lists or keywords passed.');
            return;
         }

         noVideo = query.noVideo;

         var keywordsRequested = query.keywords || '';
         var validKeywordId = util.validIdGenerator(keywordsRequested);
         var listsRequested = query.lists || '';
         var listIds = listsRequested.split(',');
 
         // for lists
         for (var l=listIds.length; l--;) {

            var validListId = util.validIdGenerator(listIds[l]);

            if (imageCollection.setIds.indexOf(validListId) === -1){
               imageCollection.setIds.push(validListId);
            }

            // set up the poll for each list
            pollManager.activatePoll('lists/statuses', { list_id: validListId, count: 200 }, validListId);
            
         }

         // for keywords
         if (keywordsRequested !== '') {

            //for keywords
            if (imageCollection.setIds.indexOf(validKeywordId) === -1) {
               imageCollection.setIds.push(validKeywordId);
            }

            // set up the poll for the keywords passed
            pollManager.activatePoll('search/tweets', { q: keywordsRequested, count: 100, lang: 'en',result_type: 'popular' }, validKeywordId);

         }

      },

      getMedia: function(query) {

         var keywordsRequested = query.keywords || '',
            validKeywordId = util.validIdGenerator(keywordsRequested),
            listsRequested = query.lists || '',
            lists = listsRequested.split(','),
            since = query.since,
            requestSet = [];

         var sortFunction = function(a, b) {
            return b._date - a._date;
         };

         var compileRequestSet = function(set) {

            for (var m = set.length; m--;) {
               var media = set[m];
               if (since !== undefined) {
                  if(media.dateAdded >= since) {
                     requestSet.push(media);
                  }
               }
               else {
                  requestSet.push(media);
               } 
            }

         };

         // media from lists
         for (var l=lists.length; l--;) {

            var lid = util.validIdGenerator(lists[l]); //list Id

            if (imageCollection.mediaSets[lid] !== undefined) {
               var mediaSet = imageCollection.mediaSets[lid].mediaObjs;
               compileRequestSet(mediaSet);
            }

         } 

         //media from keywords
         if (imageCollection.mediaSets[validKeywordId] !== undefined) {
            compileRequestSet(imageCollection.mediaSets[validKeywordId].mediaObjs);
         }

         requestSet.sort(sortFunction);
         
         return requestSet;

      }

   };
};