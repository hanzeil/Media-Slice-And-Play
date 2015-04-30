#Media Slice And Play
##概述
对于一个逻辑上完整的可以播放的视频，在服务器上实际存放的却是一堆视频切片，而且切片的URI不一定相同，甚至存放在不同的服务器上。在服务器上用一个Json文件描述逻辑文件的信息，包括文件的类型、大小、文件名，每个切片的URI、大小、偏移量等信息。如下图所示。
<img src="http://hanzeil.xyz/media_slice_and_play/introduction" width = "500"  alt="Introduction" align=center />
###本项目具有两个模块

* 用JS将客户端的视频文件切片，并上传切片和Json描述文件到服务器的uploads/目录。
* 在浏览器加载服务器的Json描述文件，将视频播放，目前支持MP4和WEBM两个格式的视频文件。

##切片
切片功能的实现主要由sliceFile.js完成，用FILE API切片，用XMLHttpRequest发送切片。
注意，用File对象操作文件的时候,并不会真正读整个文件，在XMLHttpRequest加载文件发送到服务端时，才会读。因此不用担心浏览器内存的问题。

*   打开文件

	```javascript
	<input type="file" id="file" name="file" />
	<script>var file = document.getElementById('file').files[0];</script>
    ```

*   切片
	```javascript
	var chunk = file.slice(startByte, startByte + chunkSize);
	```

*	异步上传切片，服务端使用HTTP POST方式接收切片并保存到服务器。
	```javascript
	var xhrSend = new XMLHttpRequest();
	xhrSend.open('POST', url, true);
	var formdata = new FormData();
	formdata.append("file", chunk);
	xhrSend.send(formdata);
	xhrSend.onload = function() {}
	```

*	最后上传Json描述文件，描述文件的key如下
	```json
	{
		"fileName": "chrome.webm",
		"fileType": "webm",
		"fileLength": 5140356,
		"chunkJsons": [{
			"chunkName": "uploads/chrome/chrome0.webm",
			"chunkOffset": 0,
			"chunkSize": 3170304
		}, {
			"chunkName": "uploads/chrome/chrome1.webm",
			"chunkOffset": 3170304,
			"chunkSize": 1970052
		}]
	}
	```
##播放
用HTML5播放媒体，需要用到的技术：

*	[Media Source Extension API](http://www.w3.org/TR/media-source/)
	Media Source Extension API允许JavaScript向`<video>`和`<audio>`标签动态构造媒体流，它定义对象允许JavaScript加载媒体分片转化为HTMLMediaElement.同时，通过一种缓冲模型也可以实现用浏览器播放无序被添加的媒体分片。在[MSE-REGISTRY](http://www.w3.org/TR/media-source/byte-stream-format-registry.html)中定义了媒体流的格式规范。
	<img src="http://www.w3.org/TR/media-source/pipeline_model.png" width = "500"  alt="Introduction" align=center />

*	[MP4Box.js](https://github.com/gpac/mp4box.js/)
	MP4Box是一个JavaScript库，可以处理MP4文件，是GPAC项目中的MP4Box的JS版本，它可以用来
	*	获取MP4文件的信息
	*	构造Media Segment,用于Media Source Extension API
	*	提取MP4文件中的样本，创建TextTracks
	*	More and More
###概念
*	MediaSource
	MediaSource对象表示HTMLMediaElement的媒体数据源。它具有一个SourceBuffer对象列表，可以用来添加媒体数据用来播放。MediaSource对象被web应用所创建，然后连接到一个HTMLMediaElement上。引用通过SourceBuffer列表中的SourceBuffer对象添加媒体数据到源中。当需播放这些媒体数据时，HTMLMediaElement从MediaSource对象中获取这些媒体数据。

*	Initialization Segment（初始化分片）
	包含所有初始化信息的一个字节序列，可以解码剩下所有的媒体分片。它包含初始化解码信息，多轨道分片的轨道ID，和相应的时间偏移量。

*	Media Segment（媒体分片）
	一段封装的、具有时间戳的一部分媒体数据，媒体分片跟最先添加的初始化分片相关联。

*	Random Access Point（随机访问点）
	指任意媒体分片的任意一个位置，当指定该位置后，媒体可以从该位置继续解码和播放，不需要依赖之前分段的任何数据。对于视频，指第i帧的位置。对于音频，大多音频帧可以被当做随机访问点。因为视频轨道倾向于具有稀疏分布的随机接入点。这些点的位置通常被认为多轨道媒体流的随机访问点。

*	SourceBuffer configuration（SourceBuffer配置）
	创建MediaSource的实例SourceBuffer对象。而一组特定的轨道分布在一个或者多个SourceBuffer对象中。
	实现必须具有至少一个MediaSource对象，并需要以下配置。
	*	一个SourceBuffer对象加载一个音频或视频轨道；
	*	两个SourceBuffer，一个加载一个音频轨道，另一个SourceBuffer加载一个视频轨道。

*	Track Description（轨道描述）
	一个字节流格式的特定的结构，包含轨道ID，编解码器的配置，和每个轨道的元配置。每个轨道的描述包括一个初始化分片，和唯一的轨道ID。如果在初始化分片时，轨道ID不唯一，用户代理必须运行append error algorithm并将decode error属性设置为true。

*	Track ID（轨道ID）
	轨道ID是一个轨道的标示符。轨道ID在轨道描述里识别媒体分片属于哪个轨道。


