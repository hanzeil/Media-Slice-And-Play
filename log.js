function Logger(id){
	this.el = document.getElementById('log');
}
Logger.prototype.log = function(msg) {
	var fragment = document.createDocumentFragment();
	fragment.appendChild(document.createTextNode(msg));
	fragment.appendChild(document.createElement('br'));
	this.el.appendChild(fragment);
};
Logger.prototype.clear = function() {
	this.el.textContent = '';
};
var logger = new Logger('log');
