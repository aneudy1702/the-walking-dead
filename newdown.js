// Setup express, socket.io, and http server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');    
var _ = require('lodash');
var argv = require('optimist').argv;
var modules = argv.modules && argv.modules.split(','); // pass modules to run

// Configure bone.io options
var bone = require('bone.io');
bone.set('io.options', {
    server: io
});

// Serves bone.io browser scripts
app.use(bone.static());

app.use(express.static(__dirname + '/public'));

_.each(fs.readdirSync(__dirname + '/modules'), function(module) {
    if (/^\./.test(module)) return; // ignore dotfiles

    // check for module list
    if (modules && ! _.contains(modules, module)) {
        return;
    }

    if ( ! fs.existsSync(__dirname + '/modules/' + module + '/startup.js')) {        
        return;
    }

    if ( ! require('./modules/' + module + '/startup')(app)) {
        console.log('Failed to load startup file for module ' + module);
    }
});


app.use(function(req, res) {
    res.json({message: 'route not found'}, 404);
});
    
// Listen up
server.listen(7076);