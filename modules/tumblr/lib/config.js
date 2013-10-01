var instance = require('os').hostname();

module.exports = (function () {
    'strict mode';
    //TODO: get tumblr credentials for zeebox
    var config = {
        "credentials": {

            "local": {
                "user_id": "413038713",
                "client_id": "69be703819a24c69b51bc8a9dba015ef",
                "client_secret": "1093a830721f448bb7457c6c175e54f8",
                "token_id": "413038713.ab103e5.d3e9202ae1464a3b90f1c610840ffeb1",
                "username": "zeeboxlocal",
                "email": "zeeboxmanlocal@gmail.com",
                "gmailPswd": "zeeboxLocal",
                "password": "zeebox"
            },

            "local-aneudy": {
                "user_id": "267870305",
                "client_id": "1730aa9d92df434cb2df53e0f4798371",
                "client_secret": "c7a8b29e6d2d48d7baa101159b9be2c4",
                "token_id": "267870305.ab103e5.f03ab89361f745d1b8b8a2ca97df2707"
            },

            "dev-ue1a-openboxus1": {
                "user_id": "401186420",
                "client_id": "58d43611ef2340e090104fac986edfc8",
                "client_secret": "a02234cfb3bc4f2bbe7e4fa2a9d8236b",
                "token_id": "401186420.ab103e5.357042cd553844b0a49d5082105bbf91",
                "username": "zeeboxman",
                "email": "zeeboxman@gmail.com",
                "password": "zeebox"
            },

            "stage-ue1a-openboxus1": {
                "user_id": "413050131",
                "client_id": "3a5614afc6364cc9bad74a8a8d905e07",
                "client_secret": "e65dc8b52352469f9ddcb5dd31ed86e9",
                "token_id": "413050131.ab103e5.75f99ef0830a41eba7eeacc5ec7c936e",
                "username": "zeeboxstage1",
                "email": "zeeboxmanstage1@gmail.com",
                "gmailPswd": "zeeboxStage1",
                "password": "zeebox"
            },

            "stage-ue1b-openboxus1": {
                "user_id": "413075684",
                "client_id": "cb30beb7d66e4cc6a195667e55c8d6a6",
                "client_secret": "1c240f66b77a497fb51a7bb156bb1c3b",
                "token_id": "413075684.ab103e5.954f60a5755340d487ddcc4cc9bc0518",
                "username": "zeeboxstage2",
                "email": "zeeboxmanstage2@gmail.com",
                "gmailPswd": "zeeboxStage",
                "password": "zeebox"
            },

            "live-ue1a-openboxus1": {
                "user_id": "413086737",
                "client_id": "85b69efa0c04461e8f63d4ff1864cf5e",
                "client_secret": "7db0eda3963843bea8a12b7655481fbe",
                "token_id": "413086737.ab103e5.0d7e14ea320a413785d1b28068c8db7d",
                "username": "zeeboxlivea",
                "email": "zeeboxmanlivea@gmail.com",
                "password": "zeebox",
                "gmailPswd": "zeeboxLive1"
            },

            "live-ue1b-openboxus1": {
                "user_id": "413086737",
                "client_id": "2fda4aef69924c4898279840bb39b381",
                "client_secret": "4fe3a227d7eb4afc8259f985013bcdf6",
                "token_id": "413086737.ab103e5.0d7e14ea320a413785d1b28068c8db7d",
                "username": "zeeboxlivea",
                "email": "zeeboxmanlivea@gmail.com",
                "password": "zeebox",
                "gmailPswd": "zeeboxLive1"
            }
        },

        "baseUrl": {
            "api_key": "?api_key=vK0y7TPm48QaPN1YuP7wUGt0645URVI6WoRAOn65GGsB6ilhsp",
            "prefix": "http://api.tumblr.com/v2/blog/"
        }
    };

    var currentCreds;

    if (instance.indexOf('local') > -1) {
        if (instance.indexOf('aneudy') > -1) {
            currentCreds = config['credentials']['aneudy'];
        } else {
            currentCreds = config['credentials']['local'];
        }
    } else {
        currentCreds = config['credentials'][instance];
    }

    currentCreds.baseUrl = {};
    currentCreds.baseUrl.api_key = config.baseUrl.api_key;
    currentCreds.baseUrl.prefix = config.baseUrl.prefix;

    return currentCreds;
})();