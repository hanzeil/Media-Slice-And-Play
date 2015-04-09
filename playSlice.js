window.MediaSource = window.MediaSource || window.WebKitMediaSource;
var mediaSource = new MediaSource();  
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
	var sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');
	//ayalyze jsonFile
	var jsonFile=document.getElementById('jsonFile').value;
	loadJson(jsonFile,function(response){
		//read json
		var json = eval("(" + response + ")");
		var chunkJsons=json.chunkJsons;
		//read chunks
		var i=0;
		(function readChunk(i){
			loadChunk(chunkJsons[i].chunkName,function(response){
				var file = new Blob([response], {type: 'video/webm'});
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
	)
}
function readyPlay(){
	//set mediasource API and <video> 
	var video = document.querySelector('video');
	video.src = window.URL.createObjectURL(mediaSource);
	mediaSource.addEventListener('sourceopen', mediaSourcePlay, false);
	mediaSource.addEventListener('webkitsourceopen', mediaSourcePlay, false); 
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
			callback(new Uint8Array(xhr.response));
		}
	}
}
