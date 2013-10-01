//downloaded and core modules
var pollManager = require('./pollManager')(),
    mediaManager = require('./mediaManager').api();

module.exports.api = function () {
    var tumblrManager;
    mediaManager.init();
    return {
        getBlogImages: function (params, cb) {
            mediaManager.getBlogImages(params, cb);
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
 **/