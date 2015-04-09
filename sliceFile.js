//open the will-be-sliced file
function loadClientFile(url,callback){  //url only can be a file name now  please wait
	var xhr=new XMLHttpRequest();
	xhr.open('GET',url, true);
	xhr.responseType='arraybuffer';
	xhr.send();
	xhr.onload=function(){
		if(xhr.status!=200){
			alert("load original file error");
			return false;
		} 
		callback(new Uint8Array(xhr.response)); //slice and upload
	}
}
//entry function
function readySlice(){
	var url=document.getElementById('url').value;
	var chunkNum=document.getElementById('chunkNum').value;
	var fileName=url;
	loadClientFile(url,function(response){
		var file=new Blob([response],{type: 'video/webm'});
		var chunkSize=Math.ceil(file.size / chunkNum);
		//json
		var fileJson={};
		fileJson["fileName"]=fileName; 
		fileJson["chunkJsons"]=[];

		//send chunk
		var i=0;
		(function sendChunk(i){
			var startByte=chunkSize*i;
			var chunk=file.slice(startByte,startByte+chunkSize);
			var chunkName="slice"+i+".webm";
			//write json
			var chunkJson={};
			chunkJson["chunkName"]="uploads/"+chunkName;
			chunkJson["chunkOffset"]=startByte;
			chunkJson["chunkSize"]=chunkSize;
			fileJson["chunkJsons"].push(chunkJson);
			//send chunk to server 
			url="saveFile.php";   //server url
			var xhr=new XMLHttpRequest();
			xhr.open('POST',url,true);
			xhr.setRequestHeader("X-File-Name",chunkName);
			xhr.setRequestHeader("X-File-Size",chunk.size);
			//xhr.setRequestHeader("Content-Type","multipart/form-data");
			var formdata=new FormData(); 
			formdata.append("file",chunk);
			xhr.send(formdata);
			xhr.onload=function(){
				if(xhr.status!=200){
					alert("send chunk error");
				}
				if(i<chunkNum-1){
					i++;
					sendChunk(i);
				}
				else{
					alert("chunk send successfully")
					//写json
					var jsonString = JSON.stringify(fileJson);
					var jsonName=fileName+".json";
					uploadJson(jsonString,jsonName);
				}
			}
		}
		 )(i);
	})
}
function uploadJson(jsonString,jsonName){
	url="saveJson.php";
	var xhr=new XMLHttpRequest();
	xhr.open("POST",url,true);
	var formdata=new FormData();
	xhr.setRequestHeader("X-File-Name",jsonName);
	formdata.append("json",jsonString);
	xhr.send(formdata);
	xhr.onload=function(){
		if(xhr.status!=200){
			alert("send json error");
		}
		else{
			//alert(xhr.response);
			alert("json send successfully");
		}
	}
}
