module.exports = {

	validIdGenerator : function (string) {
		string = string.toLowerCase();
		var string = string.replace(/ /g, '');
		string = string.replace(/\&/g, '');
		string = string.replace(/\./g, '');
		string = string.replace(/\|/g, '');
		string = string.replace(/,/g, '');
		return string;
	}

};

