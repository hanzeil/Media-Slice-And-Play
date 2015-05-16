Log.setLogLevel(Log.i);
var mediaSource;
var video;
var movieInfo;
var downloader = new Downloader();
var playButton;
var jsonFile;
window.onload = function() {
	video = document.getElementById('v');
	playButton = document.getElementById("playButton");
	jsonFile = document.getElementById('jsonFile').value;
	video.addEventListener("seeking", onSeeking);
	//init
	playButton.disabled = false;
	downloader.reset();
	resetMediaSource();
	resetDisplay();
}

function loadJson(jsonFile, callback) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', jsonFile, true);
	xhr.send();
	xhr.onload = function() {
		if (xhr.status != 200) {
			Log.e("Load","Load json file error");
			alert("Load json file error");
			return false;
		}
		callback(xhr.response); //handle JsonFile
	}
}

function play() {
	playButton.disabled = true;
	jsonFile = document.getElementById('jsonFile').value;
	//ayalyze jsonFile
	loadJson(jsonFile, function(response) {
		//read json
		var json = eval("(" + response + ")");
		//judge the type of the media file and choose different method to play 
		if (json["fileType"] == "webm") {
			playWebm(json);
		} else if (json["fileType"] == "mp4") {
			playMp4(json);
		}

	})
}

function playWebm(json) {
	var sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');
	var chunkJsons = json.chunkJsons;
	downloader.setCallback(function(response, eof) {
		downloader.setCurrentLength(response.byteLength + downloader.currentLength);
		var file = new Blob([new Uint8Array(response)], {
			type: 'video/webm'
		});
		var reader = new FileReader();
		reader.readAsArrayBuffer(file);
		reader.onload = function() {
			if (eof == false) {
				sourceBuffer.appendBuffer(new Uint8Array(reader.result));
				Log.i("MSE - SourceBuffer Appending new buffer");
			}
		}
	});
	downloader.init(json);
	downloader.start();
}

function playMp4(json) {
	var ms = video.ms;
	if (ms.readyState !== "open") {
		return;
	}
	mp4box = new MP4Box();
	mp4box.onMoovStart = function() {
		Log.i("Application", "Starting to parse movie information");
	}
	mp4box.onReady = function(info) {
		Log.i("Application", "Movie information received");
		movieInfo = info;
		displayMovieInfo(info);
		initializeAllSourceBuffers();
	}
	mp4box.onSegment = function(id, user, buffer, sampleNum) {
		var sb = user;
		//saveBuffer(buffer, 'track-'+id+'-segment-'+sb.segmentIndex+'.m4s');
		sb.segmentIndex++;
		sb.pendingAppends.push({
			id: id,
			buffer: buffer,
			sampleNum: sampleNum
		});
		Log.i("Application", "Received new segment for track " + id + " up to sample #" + sampleNum);
		onUpdateEnd.call(sb);
		if (id == 1) {
			downloader.setInterval(1000);
		}
	}
	downloader.setCallback(
		function(response, end, error) {
			if (response) {
				var currentLength = mp4box.appendBuffer(response);
				// 以下if-else暂时处理mp4box处理mp4文件头部时，返回的currentLength错误。
				var chunkNum = downloader.chunkNum;
				if (chunkNum < 5 && currentLength > json.chunkJsons[chunkNum + 1].chunkOffset) {
					downloader.setCurrentLength(response.byteLength * (chunkNum + 1));
				} else {
					downloader.setCurrentLength(currentLength);
				}
			}
			if (end) {
				mp4box.flush();
			}
			if (error) {
				reset();
			}
		}
	);
	downloader.init(json);
	downloader.start();

}

function mediaSourceClose() {
	//log
}

function readyPlay() {
	resetMediaSource();
	playButton.disabled = true;
}

function reset() {
	if (!downloader.isStopped()) {
		downloader.stop();
	}
	releaseBuffers();
	playButton.disabled = false;
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
	Log.i("MSE", "Source closed");
	Log.d("MSE", ms);
}

function onSourceOpen(e) {
	var ms = e.target;
	Log.i("MSE", "Source opened");
	Log.d("MSE", ms);
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
	var mime = 'video/mp4; codecs=\"' + codec + '\"';
	if (MediaSource.isTypeSupported(mime)) {
		Log.i("MSE - SourceBuffer #" + track_id, "Creation with type '" + mime + "'");
		sb = ms.addSourceBuffer(mime);
		sb.ms = ms;
		sb.id = track_id;
		mp4box.setSegmentOptions(track_id, sb, {
			nbSamples: 1000
		});
		sb.pendingAppends = [];
	}
}

function initializeSourceBuffers() {
	var initSegs = mp4box.initializeSegmentation();
	for (var i = 0; i < initSegs.length; i++) {
		var sb = initSegs[i].user;
		sb.addEventListener("updateend", onInitAppended);
		Log.i("MSE - SourceBuffer #" + sb.id, "Appending initialization data");
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
		Log.i("MSE - SourceBuffer #" + this.id, "Appending new buffer");
		this.sampleNum = obj.sampleNum;
		this.appendBuffer(obj.buffer);
	}
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
		Log.i("Application", "Seeking called to video time " + Log.getDurationString(video.currentTime));
		downloader.stop();
		resetCues();
		releaseBuffers();
		video.lastSeekTime = video.currentTime;
		seek_info = mp4box.seek(video.currentTime, true);
		downloader.setCurrentLength(seek_info.offset);
		downloader.resume();
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

function releaseBuffers() {
	var ms = video.ms;
	for (var i = 0; i < ms.activeSourceBuffers.length; i++) {
		var sb = ms.activeSourceBuffers[i];
		for (var j = 0; j < sb.buffered.length; j++) {
			var startRange = sb.buffered.start(j);
			var endRange = sb.buffered.end(j);
			if (sb.updating != true && startRange < endRange)
				Log.i("MSE - SourceBuffer", "remove buffer from time(" + Log.getDurationString(startRange) + ") to (" + Log.getDurationString(endRange) + ")");
			if(sb.updating!=true){
				sb.remove(startRange, endRange);
			}
		}
	}
}

function computeWaitingTimeFromBuffer() {
	var ms = video.ms;
	var sb;
	var startRange, endRange;
	var currentTime = video.currentTime;
	var playbackRate = video.playbackRate;
	var maxStartRange = 0;
	var minEndRange = Infinity;
	var ratio;
	var wait;
	var duration;
	/* computing the intersection of the buffered values of all active sourcebuffers around the current time, 
	may already be done by the browser when calling video.buffered (to be checked: TODO) */
	for (var i = 0; i < ms.activeSourceBuffers.length; i++) {
		sb = ms.activeSourceBuffers[i];
		for (var j = 0; j < sb.buffered.length; j++) {
			startRange = sb.buffered.start(j);
			endRange = sb.buffered.end(j);
			if (sb.updating != true && currentTime - 10 > startRange) {
				Log.i("MSE - SourceBuffer", "remove buffer from time(" + Log.getDurationString(startRange) + ") to (" + Log.getDurationString(currentTime) + ")");
				sb.remove(startRange, currentTime - 10);
			}
			if (currentTime >= startRange && currentTime <= endRange) {
				if (startRange >= maxStartRange) maxStartRange = startRange;
				if (endRange <= minEndRange) minEndRange = endRange;
				break;
			}
			//remove  played medias
		}
	}

	duration = minEndRange - maxStartRange;
	ratio = (currentTime - maxStartRange) / duration;
	Log.i("Downloader", "Playback position (" + Log.getDurationString(currentTime) + ") in current buffer [" + Log.getDurationString(maxStartRange) + "," + Log.getDurationString(minEndRange) + "]: " + Math.floor(ratio * 100) + "%");
	if (ratio >= 3 / (playbackRate + 3) || currentTime === 0) {
		Log.i("Downloader", "Downloading immediately new data!");
		/* when the currentTime of the video is at more than 3/4 of the buffered range (for a playback rate of 1), 
		immediately fetch a new buffer */
		return 1; /* return 1 ms (instead of 0) to be able to compute a non-infinite bitrate value */
	} else {
		/* if not, wait for half (at playback rate of 1) of the remaining time in the buffer */
		wait = 1000 * (minEndRange - currentTime) / (2 * playbackRate);
		Log.i("Downloader", "Waiting for " + Log.getDurationString(wait, 1000) + " s for the next download");
		return wait;
	}
}