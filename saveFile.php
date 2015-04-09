<?php 
$filename   = $_SERVER['HTTP_X_FILE_NAME'];
$filesize   = $_SERVER['HTTP_X_FILE_SIZE'];
$dir="uploads/" . $_SERVER['HTTP_X_DIR_NAME'] . '/';
// name must be in proper format
if (isset($_SERVER['HTTP_X_FILE_NAME'])) {
	// we store chunks in directory named after filename
	if (!file_exists("uploads/")){
		mkdir("uploads/");
	}
	if(!file_exists($dir)){
		mkdir($dir);
	}
	$target = $dir . $filename;
	move_uploaded_file($_FILES["file"]["tmp_name"], $target);
}
else{
    throw new Exception('Name required');
}


