Log.setLogLevel(Log.i);
function Downloader() {
	this.isActive = false;
	this.currentLength = 0;
	this.chunkSize = 0;
	this.chunkOffset = 0;
	this.totalLength = 0;
	this.chunkTimeout = 500;
	this.url = null;
	this.json = null;
	this.callback = null;
	this.eof = false;
	this.setDownloadTimeoutCallback = null;
	this.chunkNum=0;
	this.chunkTotalNum=0;
}


Downloader.prototype.reset = function() {
	this.currentLength = 0;
	this.totalLength = 0;
	this.json=null;
	this.chunkSize=0;
	this.chunkOffset=0;
	this.chunkNum=0;
	this.chunkTotalNum=0;
	this.eof = false;
}

Downloader.prototype.setChunkSize = function(size) {
	this.chunkSize = size;
}

Downloader.prototype.setCurrentLength = function(currentLength) {
	this.currentLength = currentLength;
	this.eof = false;
}

Downloader.prototype.setInterval = function(timeout) {
	this.chunkTimeout = timeout;
}

Downloader.prototype.setUrl = function(url) {
	this.url = url;
}
Downloader.prototype.init = function(json){
	this.json = json;
	var chunk=this.json.chunkJsons[this.chunkNum];
	this.currentLength=0;
	this.chunkSize=chunk.chunkSize;
	this.chunkOffset=chunk.chunkOffset;
	this.url=chunk.chunkName;
	this.totalLength=this.json.fileLength;
	this.chunkTotalNum=this.json.chunkJsons.length;
}
Downloader.prototype.setChunk = function(chunkNum){
	this.chunkNum=chunkNum;
	var Chunk=this.json.chunkJsons[this.chunkNum];
	this.chunkSize=Chunk.chunkSize;
	this.chunkOffset=Chunk.chunkOffset;
	this.url=Chunk.chunkName;
}
Downloader.prototype.setCallback = function(callback) {
	this.callback = callback;
}

Downloader.prototype.isStopped = function () {
	return !this.isActive;
}

Downloader.prototype.getFileLength = function () {
	return this.totalLength;
}

Downloader.prototype.getFile = function() {
	var dl = this;
	if (dl.totalLength && this.currentLength >= dl.totalLength) {
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
	var range = null;
	//set the range need to receive,(because mp4box.appendbuffer is not always read all of the buffer)
	xhr.start = this.currentLength;
	range = 'bytes=' + (this.currentLength-this.chunkOffset) + '-';
	var maxRange = this.chunkSize-1;
	range += maxRange;
	xhr.setRequestHeader('Range', range);
	xhr.send();
	xhr.onerror = function(e) {
		dl.callback(null, false, true);
	}
	xhr.currentLength=this.currentLength;
	xhr.onreadystatechange = function (e) { 
		if ((xhr.status == 200 || xhr.status == 206 || xhr.status == 304 || xhr.status == 416) && xhr.readyState == this.DONE) {
			var rangeReceived = xhr.getResponseHeader("Content-Range");
			Log.i("Downloader", "Received data range Chunk#"+dl.chunkNum+": "+rangeReceived+" chunkOffset: "+dl.chunkOffset);
			/* if the length of the file is not known, we get it from the response header */
			var buffer = xhr.response;
			buffer.fileStart = xhr.currentLength;
			dl.callback(buffer, dl.eof); 
			if (dl.isActive === true && dl.eof === false) {
				if (dl.setDownloadTimeoutCallback) dl.setDownloadTimeoutCallback(timeoutDuration);
				Log.i("Downloader", "Next download scheduled in "+dl.chunkTimeout+ ' ms.');
				// the next chunk
				if(dl.chunkNum+1>=dl.json.chunkJsons.length){
					dl.eof = true;
					Log.i("Downloader", "File download done.");
					dl.callback(null, true);
					return ;
				}
				//read next chunk,only if this chunk is read done
				var nextChunk=dl.json.chunkJsons[dl.chunkNum+1];
				if(nextChunk.chunkOffset<=dl.currentLength){
					dl.setChunk(dl.chunkNum+1);
				}
				dl.chunkTimeout=computeWaitingTimeFromBuffer();
				window.setTimeout(dl.getFile.bind(dl),dl.chunkTimeout);
			} else {
				/* end of file */
				Log.i("Downloader", "File download done.");
			}
		}
	};
}

Downloader.prototype.start = function() {
	Log.i("Downloader", "Starting file download");
	this.isActive = true;
	if (this.chunkSize === 0) {
		this.chunkSize = Infinity;
	}
	this.getFile();
}
Downloader.prototype.resume=function(){
	Log.i("Downloader", "resuming file download");
	this.isActive=true;
	//judge which chunk need to download
	for(this.chunkNum=0;this.chunkNum<this.chunkTotalNum;this.chunkNum++){
		if(this.json.chunkJsons[this.chunkNum].chunkOffset>=this.currentLength){
			break;
		}
	}
	this.chunkNum=this.chunkNum>0?this.chunkNum-1:0;
	this.setChunk(this.chunkNum);
	this.getFile();
}
Downloader.prototype.stop = function() {
	Log.i("Downloader", "Stopping file download");
	this.isActive = false;
}
