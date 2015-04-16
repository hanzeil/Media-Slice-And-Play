function Downloader() {
	this.isActive = false;
	this.realtime = false;
	this.chunkStart = 0;
	this.chunkSize = 0;
	this.totalLength = 0;
	this.chunkTimeout = 1000;
	this.url = null;
	this.json = null;
	this.callback = null;
	this.eof = false;
	this.setDownloadTimeoutCallback = null;
	this.chunkNum=0;
}

Downloader.prototype.setDownloadTimeoutCallback = function(callback) {
	this.setDownloadTimeoutCallback = callback;
}

Downloader.prototype.reset = function() {
	this.chunkStart = 0;
	this.totalLength = 0;
	this.eof = false;
}

Downloader.prototype.setRealTime = function(_realtime) {
	this.realtime = _realtime;
}

Downloader.prototype.setChunkSize = function(_size) {
	this.chunkSize = _size;
}

Downloader.prototype.setChunkStart = function(_start) {
	this.chunkStart = _start;
	this.eof = false;
}

Downloader.prototype.setInterval = function(_timeout) {
	this.chunkTimeout = _timeout;
}

Downloader.prototype.setUrl = function(_url) {
	this.url = _url;
}
Downloader.prototype.setJson = function(_json){
	this.json = _json;
}
Downloader.prototype.setCallback = function(_callback) {
	this.callback = _callback;
}

Downloader.prototype.isStopped = function () {
	return !this.isActive;
}

Downloader.prototype.getFileLength = function () {
	return this.totalLength;
}

Downloader.prototype.getFile = function() {
	var dl = this;
	if (dl.totalLength && this.chunkStart>= dl.totalLength) {
		dl.eof = true;
	}
	if (dl.eof === true) {
		Log.i("Downloader", "File download done.");
		this.callback(null, true);
		return;
	}
	var xhr = new XMLHttpRequest();
	xhr.open("GET", this.url, true);
	xhr.responseType = "arraybuffer";
	xhr.send();
	xhr.onerror = function(e) {
		dl.callback(null, false, true);
	}
	xhr.onload = function (e) { 
		if ( xhr.status == 200 ){
			var buffer = xhr.response;
			buffer.fileStart = dl.chunkStart;
			dl.callback(buffer, dl.eof); 
			//if (dl.isActive === true && dl.eof === false) {
			//	var timeoutDuration = 0;
			//	if (!dl.realtime) {
			//		timeoutDuration = dl.chunkTimeout;
			//	} else {
			//		timeoutDuration = computeWaitingTimeFromBuffer(video);
			//	}
			//	if (dl.setDownloadTimeoutCallback) dl.setDownloadTimeoutCallback(timeoutDuration);
			//	Log.i("Downloader", "Next download scheduled in "+Math.floor(timeoutDuration)+ ' ms.');
			//	window.setTimeout(dl.getFile.bind(dl), timeoutDuration);
			//} else {
			//	/* end of file */
			//}
		}
	};
}

Downloader.prototype.start = function() {
	Log.i("Downloader", "Starting file download");
	this.chunkStart = 0;
	this.resume();
}

Downloader.prototype.resume = function() {
	Log.i("Downloader", "Resuming file download");
	this.isActive = true;
	if(this.chunkNum>=this.json.chunkJsons.length){
		return ;
	}
	this.url=this.json.chunkJsons[this.chunkNum].chunkName;
	this.chunkNum++;
	if (this.chunkSize === 0) {
		this.chunkSize = Infinity;
	}
	this.getFile();
}

Downloader.prototype.stop = function() {
	Log.i("Downloader", "Stopping file download");
	this.isActive = false;
}
