var mediaSource;
var video;
var movieInfo;
var downloader = new Downloader();
var autoplay = false;
var playButton,startButton,loadButton,initButton;
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
function mediaSourcePlay(){
	//ayalyze jsonFile
	var jsonFile=document.getElementById('jsonFile').value;
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
		addSourceBufferListener(info);
		if (autoplay) {
			initializeAllSourceBuffers();
		} else {
			initAllButton.disabled = false;
		}
	}
	mp4box.onSegment = function (id, user, buffer, sampleNum) {	
		var sb = user;
		//saveBuffer(buffer, 'track-'+id+'-segment-'+sb.segmentIndex+'.m4s');
		sb.segmentIndex++;
		sb.pendingAppends.push({ id: id, buffer: buffer, sampleNum: sampleNum });
		Log.i("Application","Received new segment for track "+id+" up to sample #"+sampleNum+", segments pending append: "+sb.pendingAppends.length);
		//onUpdateEnd.call(sb, true);
	}
	autoplay=true;
	loadButton.disabled = true;
	playButton.disabled = true;
	downloader.setCallback(
		function (response, end, error) { 
			if (response) {
				var nextStart = mp4box.appendBuffer(response);
				downloader.setChunkStart(nextStart); 
				//downloader.resume();
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
	downloader.setJson(json);
	Log.setLogLevel(2);
	downloader.setChunkSize(parseInt(json.chunkJsons[0].ChunkSize));
	downloader.getFileLength(json.fileLength);
	loadButton.disabled = true;
	downloader.start();

}
function mediaSourceClose(){
	//log
}
function readyPlay(){
	video = document.getElementById('v');
	playButton = document.getElementById("playButton");
	loadButton = document.getElementById("loadButton");
	initAllButton = document.getElementById("initButton");
	resetMediaSource();
}
function resetMediaSource() {
	window.MediaSource = window.MediaSource || window.WebkitMediaSource;
	mediaSource = new MediaSource();
	mediaSource.video = video;
	video.ms = mediaSource;
	mediaSource.addEventListener('sourceopen', mediaSourcePlay, false);
	mediaSource.addEventListener('webkitsourceopen', mediaSourcePlay, false); 
	mediaSource.addEventListener('sourceclose', mediaSourceClose, false); 
	mediaSource.addEventListener('webkitsourceclose', mediaSourceClose, false); 
	video.src = window.URL.createObjectURL(mediaSource);
	/* todo: remove text tracks */
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
function addSourceBufferListener(info) {
	for (var i = 0; i < info.tracks.length; i++) {
		var track = info.tracks[i];
		var checkBox = document.getElementById("addTrack"+track.id);
		if (!checkBox) continue;
		checkBox.addEventListener("change", (function (track_id, codec) { 
			return function (e) {
				var check = e.target;
				if (check.checked) { 
					addBuffer(video, track_id, codec);
					initButton.disabled = false;
				} else {
					initButton.disabled = removeBuffer(video, track_id);
				}
			};
		})(track.id, track.codec));
	}
}
function initializeAllSourceBuffers() {
	if (movieInfo) {
		var info = movieInfo;
		for (var i = 0; i < info.tracks.length; i++) {
			var track = info.tracks[i];
			addBuffer(video, track.id, track.codec);
		}
		initAllButton.disabled = true;
		playButton.disabled = false;
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
		mp4box.setSegmentOptions(track_id, sb, { nbSamples: 20} );
		sb.pendingAppends = [];
	} 
}

function initializeSourceBuffers() {
	var initSegs = mp4box.initializeSegmentation();
	for (var i = 0; i < initSegs.length; i++) {
		var sb = initSegs[i].user;
		//sb.addEventListener("updateend", onInitAppended);
		Log.i("MSE - SourceBuffer #"+sb.id,"Appending initialization data");
		sb.appendBuffer(initSegs[i].buffer);
		//saveBuffer(initSegs[i].buffer, 'track-'+initSegs[i].id+'-init.mp4');
		sb.segmentIndex = 0;
	}
	initAllButton.disabled = true;	
}
function displayMovieInfo(info) {
	var html = "Movie Info";
	html += "<div>";
	html += "<table>";
	html += "<tr><th>File Size</th><td>"+info.length+" bytes</td></tr>";
	html += "<tr><th>Brands</th><td>"+info.brands+"</td></tr>";
	html += "<tr><th>Creation Date</th><td>"+info.created+"</td></tr>";
	html += "<tr><th>Modified Date</th><td>"+info.modified+"</td></tr>";
	html += "<tr><th>Timescale</th><td>"+info.timescale+"</td></tr>";
	html += "<tr><th>Duration</th><td>"+info.duration+" ("+Log.getDurationString(info.duration,info.timescale)+")</td></tr>";
	html += "<tr><th>Bitrate</th><td>"+Math.floor((info.length*8*info.timescale)/(info.duration*1000))+" kbps</td></tr>";
	html += "<tr><th>Progressive</th><td>"+info.isProgressive+"</td></tr>";
	html += "<tr><th>Fragmented</th><td>"+info.isFragmented+"</td></tr>";
	html += "<tr><th>MPEG-4 IOD</th><td>"+info.hasIOD+"</td></tr>";
	if (info.isFragmented) {
		html += "<tr><th>Fragmented duration</th><td>"+info.fragment_duration+" ("+Log.getDurationString(info.fragment_duration,info.timescale)+")</td></tr>";
	}
	html += "</table>";
	html += getTrackListInfo(info.videoTracks, "Video");
	html += getTrackListInfo(info.audioTracks, "Audio");
	html += getTrackListInfo(info.subtitleTracks, "Subtitle");
	html += getTrackListInfo(info.metadataTracks, "Metadata");
	html += getTrackListInfo(info.otherTracks, "Other");
	html += "</div>";
	infoDiv.innerHTML = html;
}
function getBasicTrackHeader() {
	var html = '';
	html += "<th>Track ID</th>";
	html += "<th>Track References</th>";
	html += "<th>Alternate Group</th>";
	html += "<th>Creation Date</th>";
	html += "<th>Modified Date</th>";
	html += "<th>Timescale</th>";
	html += "<th>Media Duration</th>";
	html += "<th>Number of Samples</th>";
	html += "<th>Bitrate (kbps)</th>";
	html += "<th>Codec</th>";
	html += "<th>Language</th>";
	html += "<th>Track Width</th>";
	html += "<th>Track Height</th>";
	html += "<th>Track Layer</th>";
	return html;
}

function getBasicTrackInfo(track) {
	var html = '';
	html += "<td>"+track.id+"</td>";
	html += "<td>";
	if (track.references.length === 0) {
		html += "none";
	} else {
		for (var i = 0; i < track.references.length; i++) {
			if (i > 0) html += "<br>";
			html += "Reference of type "+track.references[i]+" to tracks "+track.references[i].track_ids;
		}
	}
	html += "</td>";
	html += "<td>"+track.alternate_group+"</td>";
	html += "<td>"+track.created+"</td>";
	html += "<td>"+track.modified+"</td>";
	html += "<td>"+track.timescale+"</td>";
	html += "<td>"+track.duration+" ("+Log.getDurationString(track.duration,track.timescale)+") </td>";
	html += "<td>"+track.nb_samples+"</td>";
	html += "<td>"+Math.floor(track.bitrate/1024)+"</td>";
	html += "<td>"+track.codec+"</td>";
	html += "<td>"+track.language+"</td>";
	html += "<td>"+track.track_width+"</td>";
	html += "<td>"+track.track_height+"</td>";
	html += "<td>"+track.layer+"</td>";
	return html;
}

function getVideoTrackHeader() {
	var html = '';
	html += "<th>Width</th>";
	html += "<th>Height</th>";
	return html;
}

function getVideoTrackInfo(track) {
	var html = '';
	html += "<td>"+track.video.width+"</td>";
	html += "<td>"+track.video.height+"</td>";
	return html;
}

function getAudioTrackHeader() {
	var html = '';
	html += "<th>Sample Rate</th>";
	html += "<th>Channel Count</th>";
	html += "<th>Volume</th>";
	return html;
}

function getAudioTrackInfo(track) {
	var html = '';
	html += "<td>"+track.audio.sample_rate+"</td>";
	html += "<td>"+track.audio.channel_count+"</td>";
	html += "<td>"+track.volume+"</td>";
	return html;
}
function getTrackListInfo(tracks, type) {
	var html = '';
	if (tracks.length>0) {html += type+" track(s) info";
		html += "<table>";
		html += "<tr>";
		html += getBasicTrackHeader();
		switch (type) {
			case "Video":
				html += getVideoTrackHeader();
				break;				
			case "Audio":
				html += getAudioTrackHeader();
				break;				
			case "Subtitle":
				break;				
			case "Metadata":
				break;				
			case "Hint":
				break;				
			default:
				break;				
		}
		html += "<th>Source Buffer Status</th>";
		html += "</tr>";
		for (var i = 0; i < tracks.length; i++) {
			html += "<tr>";
			html += getBasicTrackInfo(tracks[i]);
			switch (type) {
				case "Video":
					html += getVideoTrackInfo(tracks[i]);
					break;				
				case "Audio":
					html += getAudioTrackInfo(tracks[i]);
					break;				
				case "Subtitle":
					break;				
				case "Metadata":
					break;				
				case "Hint":
					break;	
				default:
					break;
			}					
			var mime = 'video/mp4; codecs=\"'+tracks[i].codec+'\"';
			if (MediaSource.isTypeSupported(mime)) {
				html += "<td id=\"buffer"+tracks[i].id+"\">"+"<input id=\"addTrack"+tracks[i].id+"\" type=\"checkbox\">"+"</td>";
			} else {
				html += "<td>Not supported by your browser, exposing track content using HTML TextTrack <input id=\"addTrack"+tracks[i].id+"\" type=\"checkbox\"></td>";
			}
			html += "</tr>";
		}
		html += "</table>";	
	}
	return html;
}
