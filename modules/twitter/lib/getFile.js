var fs = require('fs');
var Q = require('q');

module.exports = {

	asJSON: function(path) {

		var deferred = Q.defer();

		var JSONdata;

		fs.readFile(path, 'utf-8', function(err, fd) {

		    if (err) {

		      console.log('Could not read file at ' + path);
		      deferred.reject({ message : 'Could not read file at ' + path });
		      return;

		    } 
		    else {

		      JSONdata = JSON.parse(fd);
		      
		    }

		    deferred.resolve(JSONdata);
		  
		});

		return deferred.promise;

	}

}