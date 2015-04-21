Log.setLogLevel(Log.i);
var mediaSource;
var video;
var movieInfo;
var downloader = new Downloader();
var autoplay = false;
var playButton;
var jsonFile;
window.onload= function (){
	video = document.getElementById('v');
	playButton = document.getElementById("playButton");
	jsonFile=document.getElementById('jsonFile').value;
	video.addEventListener("seeking", onSeeking);
	reset();
}
function loadJson(jsonFile,callback){
	var xhr=new XMLHttpRequest();
	xhr.open('GET',jsonFile, true);
	xhr.send();
	xhr.onload=function(){
		if(xhr.status!=200){
			alert("load json file error");
			return false;
		} 
		callback(xhr.response); //handle JsonFile
	}
}
function play(){
	playButton.disabled=true;
	jsonFile=document.getElementById('jsonFile').value;
	//ayalyze jsonFile
	loadJson(jsonFile,function(response){
		//read json
		var json = eval("(" + response + ")");
		//judge the type of the media file and choose different method to play 
		if(json["fileType"]=="webm"){
			playWebm(json);
		}
		else if(json["fileType"]=="mp4"){
			playMp4(json);
		}

	}
	)
}
function playWebm(json){
	var sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');
	var chunkJsons=json.chunkJsons;
	//read chunks
	var i=0;
	(function readChunk(i){
		loadChunk(chunkJsons[i].chunkName,
			function(response){
				var file = new Blob([new Uint8Array(response)], {type: 'video/webm'});
				var reader=new FileReader();
				reader.readAsArrayBuffer(file);
				reader.onload=function(){
					sourceBuffer.appendBuffer(new Uint8Array(reader.result));
					if(i<chunkJsons.length-1){
						i++;
						readChunk(i);
					}
				}
			}
		)
	}
	)(i);	
}
function playMp4(json){
	var ms = video.ms;
	if (ms.readyState !== "open") {
		return;
	}
	mp4box = new MP4Box();
	mp4box.onMoovStart = function () {
		Log.i("Application", "Starting to parse movie information");
	}
	mp4box.onReady = function (info) {
		Log.i("Application", "Movie information received");
		movieInfo = info;
		if (!autoplay) {
			stop();
		}
		if (info.isFragmented) {
			ms.duration = info.fragment_duration/info.timescale;
		} else {
			ms.duration = info.duration/info.timescale;
		}
		displayMovieInfo(info);
		if (autoplay) {
			initializeAllSourceBuffers();
		}
	}
	mp4box.onSegment = function (id, user, buffer, sampleNum) {	
		var sb = user;
		//saveBuffer(buffer, 'track-'+id+'-segment-'+sb.segmentIndex+'.m4s');
		sb.segmentIndex++;
		sb.pendingAppends.push({ id: id, buffer: buffer, sampleNum: sampleNum });
		Log.i("Application","Received new segment for track "+id+" up to sample #"+sampleNum+", segments pending append: "+sb.pendingAppends.length);
		onUpdateEnd.call(sb);
	}
	autoplay=true;
	downloader.setCallback(
		function (response, end, error) { 
			if (response) {
				var currentLength = mp4box.appendBuffer(response);
				downloader.setCurrentLength(currentLength); 
			}
			if (end) {
				mp4box.flush();
			}
			if (error) {
				reset();
			}
		}
	);
	//downloader.setInterval(1000);
	downloader.init(json);
	downloader.start();

}
function mediaSourceClose(){
	//log
}
function readyPlay(){
	resetMediaSource();
	playButton.disabled = true;
}
function reset() {
	stop();
	downloader.reset();
	resetMediaSource();
	resetDisplay();
}
function resetMediaSource() {
	window.MediaSource = window.MediaSource || window.WebkitMediaSource;
	mediaSource = new MediaSource();
	mediaSource.video = video;
	video.ms = mediaSource;
	mediaSource.addEventListener('sourceopen', onSourceOpen, false);
	mediaSource.addEventListener('webkitsourceopen', onSourceOpen, false); 
	mediaSource.addEventListener('sourceclose', onSourceClose, false); 
	mediaSource.addEventListener('webkitsourceclose', onSourceClose, false); 
	video.src = window.URL.createObjectURL(mediaSource);
	/* todo: remove text tracks */
}
function onSourceClose(e) {
	var ms = e.target;
	Log.e("MSE", "Source closed, video error: "+ (ms.video.error ? ms.video.error.code : "(none)"));
	Log.d("MSE", ms);
}

function onSourceOpen(e) {
	var ms = e.target;
	Log.i("MSE", "Source opened");
	Log.d("MSE", ms);
}
function loadChunk(chunkName,callback){
	var xhr=new XMLHttpRequest();
	xhr.open('GET',chunkName,true);
	xhr.responseType='arraybuffer';
	xhr.send();
	xhr.onload=function(){
		if(xhr.status!=200){
			alert("load Chunk file error");
			return false;
		}
		else{
			callback(xhr.response);
		}
	}
}
function initializeAllSourceBuffers() {
	if (movieInfo) {
		var info = movieInfo;
		for (var i = 0; i < info.tracks.length; i++) {
			var track = info.tracks[i];
			addBuffer(video, track.id, track.codec);
		}
		initializeSourceBuffers();
	}
}
function addBuffer(video, track_id, codec) {
	var sb;
	var ms = video.ms;
	var mime = 'video/mp4; codecs=\"'+codec+'\"';
	if (MediaSource.isTypeSupported(mime)) {
		Log.i("MSE - SourceBuffer #"+track_id,"Creation with type '"+mime+"'");
		sb = ms.addSourceBuffer(mime);
		sb.ms = ms;
		sb.id = track_id;
		mp4box.setSegmentOptions(track_id, sb, { nbSamples: 1000} );
		sb.pendingAppends = [];
	} 
}
function initializeSourceBuffers() {
	var initSegs = mp4box.initializeSegmentation();
	for (var i = 0; i < initSegs.length; i++) {
		var sb = initSegs[i].user;
		sb.addEventListener("updateend", onInitAppended);
		Log.i("MSE - SourceBuffer #"+sb.id,"Appending initialization data");
		sb.appendBuffer(initSegs[i].buffer);
		sb.segmentIndex = 0;
	}
}
function onInitAppended(e) {
	var sb = e.target;
	if (sb.ms.readyState === "open") {
		sb.sampleNum = 0;
		sb.removeEventListener('updateend', onInitAppended);
		sb.addEventListener('updateend', onUpdateEnd.bind(sb));
		/* In case there are already pending buffers we call onUpdateEnd to start appending them*/
		onUpdateEnd.call(sb);
	}
}
function onUpdateEnd() {
	if (this.sampleNum) {
		mp4box.releaseUsedSamples(this.id, this.sampleNum);
		delete this.sampleNum;
	}
	if (this.ms.readyState === "open" && this.updating === false && this.pendingAppends.length > 0) {
		var obj = this.pendingAppends.shift();
		Log.i("MSE - SourceBuffer #"+this.id, "Appending new buffer, pending: "+this.pendingAppends.length);
		this.sampleNum = obj.sampleNum;
		this.appendBuffer(obj.buffer);
	}
}
function start() {
	startButton.disabled = true;
	downloader.setChunkStart(mp4box.seek(0, true).offset);
	downloader.setChunkSize(parseInt(chunkSizeLabel.value));
	downloader.setInterval(parseInt(chunkTimeoutLabel.value));
	downloader.resume();
}	
function stop() {
	if (!downloader.isStopped()) {
		downloader.stop();
	}
	playButton.disabled = false;
}		
function resetDisplay() {
	infoDiv.innerHTML = '';
}
function onSeeking(e) {
	var i, start, end;
	var seek_info;
	if (video.lastSeekTime !== video.currentTime) {
		for (i = 0; i < video.buffered.length; i++) {
			start = video.buffered.start(i);
			end = video.buffered.end(i);
			if (video.currentTime >= start && video.currentTime <= end) {
				return;
			}
		}
		/* Chrome fires twice the seeking event with the same value */
		Log.i("Application", "Seeking called to video time "+Log.getDurationString(video.currentTime));
		downloader.stop();
		resetCues();
		seek_info = mp4box.seek(video.currentTime, true);
		downloader.setCurrentLength(seek_info.offset);
		downloader.resume();
		video.lastSeekTime = video.currentTime;
	}
}
function resetCues() {
	for (var i = 0; i < video.textTracks.length; i++) {
		var texttrack = video.textTracks[i];
		while (texttrack.cues.length > 0) {
			texttrack.removeCue(texttrack.cues[0]);
		}
	}
} 
