function loadFile(url,callback){
	var xhr=new XMLHttpRequest();
	xhr.open('GET',url, true);
	xhr.responseType='arraybuffer';
	xhr.send();
	xhr.onload=function(){
		if(xhr.status!=200){
			alert("load error");
			return false;
		}
		callback(new Uint8Array(xhr.response));
	}
}
function ready(){
	var url=document.getElementById('url').value;
	var chunkNum=document.getElementById('chunkNum').value;
	loadFile(url,function(response){
		var file=new Blob([response],{type: 'video/webm'});
		var chunkSize=Math.ceil(file.size / chunkNum);
		var i=0;
		(function sendChunk(i){
			var startByte=chunkSize*i;
			var chunk=file.slice(startByte,startByte+chunkSize);
			var chunk_name="slice"+i+".webm";
			url="saveFile.php";
			var xhr=new XMLHttpRequest();
			xhr.open('POST',url,true);
			xhr.setRequestHeader("X-File-Name",chunk_name);
			xhr.setRequestHeader("X-File-Size",chunk.size);
			//xhr.setRequestHeader("Content-Type","multipart/form-data");
			var formdata=new FormData(); 
			formdata.append("file",chunk);
			xhr.send(formdata);
			xhr.onload=function(){
				if(xhr.status!=200){
					alert("send error");
				}
				else{
					alert(xhr.response);
				}
				if(i<chunkNum-1){
					i++;
					sendChunk(i);
				}
			}
		}
		 )(i);
	})
}

