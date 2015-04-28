//entry function
function readySlice(){
	//get the filename of the URL
	var file=document.getElementById('file').files[0];
	if(!file){
		Log.e("File","No file seleted");
		alert("No file seleted");
		return false;
	}
	var chunkSize=1024*document.getElementById('chunkSize').value;
	chunkSize=chunkSize<file.size?chunkSize:file.size;
	var fileName=file.name;
	var fileType=fileName.substr(fileName.lastIndexOf('.')+1);
	var fileName=fileName.substring(0,fileName.lastIndexOf('.'));
	//judge the type of the media file
	if(fileType=="webm" || fileType=="mp4"){
		sliceAndSend(file,fileName,fileType,chunkSize);
	}
	else{
		Log.e("File","File type is not supported");
		alert("File type is not supported");
	}
}
//slice Webm file and send chunk and create json array
function sliceAndSend(file,fileName,fileType,chunkSize){
	var chunkNum=Math.ceil(file.size / chunkSize);
	//json
	var fileJson={};
	fileJson["fileName"]=fileName+"."+fileType; 
	fileJson["fileType"]=fileType;
	fileJson["fileLength"]=file.size;
	fileJson["chunkJsons"]=[];

	//send chunk
	var i=0;
	(function sendChunk(i){
		var startByte=chunkSize*i;
		var chunk=file.slice(startByte,startByte+chunkSize);
		chunkSize=chunk.size;
		var chunkName=fileName+i+"."+fileType;
		//write json
		var chunkJson={};
		chunkJson["chunkName"]="uploads/"+fileName+"/"+chunkName;
		chunkJson["chunkOffset"]=startByte;
		chunkJson["chunkSize"]=chunkSize;
		fileJson["chunkJsons"].push(chunkJson);
		//send chunk to server 
		url="saveFile.php";   //server url
		var xhrSend=new XMLHttpRequest();
		xhrSend.open('POST',url,true);
		xhrSend.setRequestHeader("X-File-Name",chunkName);
		xhrSend.setRequestHeader("X-File-Size",chunk.size);
		xhrSend.setRequestHeader("X-Dir-Name",fileName);
		//xhr.setRequestHeader("Content-Type","multipart/form-data");
		var formdata=new FormData(); 
		formdata.append("file",chunk);
		xhrSend.send(formdata);
		xhrSend.onload=function(){
			if(xhrSend.status!=200){
				alert("Send chunk"+i+"error");
				Log.e("Send chunk"+i+"error");
			}
			if(i<chunkNum-1){
				i++;
				sendChunk(i);
			}
			else{
				//upload json
				Log.i("Upload","Send chunks Successfully");
				var jsonString = JSON.stringify(fileJson);
				var jsonName=fileName+".json";
				uploadJson(jsonString,jsonName);
			}
		}
	}
	)(i);
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
			alert("Send json-file error");
			Log.e("Upload","Send json-file error")
			return false;
		}
		else{
			//alert(xhr.response);
			Log.e("Upload","Send json-files Successfully");
			alert("Send json-files Successfully");
		}
	}
}

