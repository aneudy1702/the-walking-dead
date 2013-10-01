module.exports = function (app) {
    //downloaded and core modules
    var instgManager = require('./lib/instgManager'),
        api = instgManager.api();

    api.init();

    app.get('/openbox-us/instagram/tag', function (req, res) {
        res.set('Cache-Control', 'max-age=5');
        var params = req.query;
        if (params.names) {
            //this means we have search terms
            api.getMediaByTag(params, function (mediaList) {
                res.json(mediaList);
            });
        } else if (params.id) {
            api.getMediaByUser(params, function (mediaList) {
                res.json(mediaList);
            });
        } else {
            res.json([]);
        }

        // process.on('uncaughtException', function (err) {
        // 	console.log('HEY!! Caught exception: ' + err);
        // });
    });

    app.get('/openbox-us/instagram/whatspolling', api.whatsPolling);

    return true;
};