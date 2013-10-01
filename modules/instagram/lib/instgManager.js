var instagram = require('instagram-node-lib'),
    config = require('./config'),    
    mediaManager = require('./mediaManager').api();

module.exports.api = function () {
    return {
        init: function () {
            var counter = 0;

            instagram.set('client_id', config['client_id']);
            instagram.set('client_secret', config['client_secret']);
            instagram.set('access_token', config['token_id']);

            mediaManager.init(instagram);

            // zeebox.logger.info(
            //     '[Instagram] [Manager]: initialized for ' + config[
            //         'client_id']);
        },

        getMediaByTag: function (params, cb) {
            mediaManager.getMediaByTag(params, cb);
        },

        getMediaByUser: function (params, cb) {
            mediaManager.getMediaByUser(params, cb);
        },

        whatsPolling: function (req, res) {
            mediaManager.whatsPolling(req, res);
        }
    };
};

/**
 * notes:
 *   useful link to retrieve toked id:
 *      https://api.instagram.com/oauth/authorize/?client_id=ab103e54c54747ada9e807137db52d77&redirect_uri=http://blueprintinteractive.com/tutorials/instagram/uri.php&response_type=code
 *
 **/