module.exports = function (app) {
//     var tumblrManager = require('./lib/tumblrManager');
//     var api = tumblrManager.api();

//     app.get('/openbox-us/tumblr/images', function (req, res) {
//         res.set('Cache-Control', 'max-age=5');
//         var params = req.query;
//         if (params.blogs) {
//             //this means we have search terms
//             api.getBlogImages(params, function (mediaList) {
//                 res.json(mediaList);
//             });
//         } else {
//             res.json([]);
//         }
//     });

//     app.get('/openbox-us/tumblr/whatspolling', function (req, res) {
//         api.whatsPolling(res);
//     });

    return true;
};