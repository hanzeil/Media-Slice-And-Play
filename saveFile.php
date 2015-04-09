<?php 
$filename   = $_SERVER['HTTP_X_FILE_NAME'];
$filesize   = $_SERVER['HTTP_X_FILE_SIZE'];
// name must be in proper format
if (isset($_SERVER['HTTP_X_FILE_NAME'])) {
	// we store chunks in directory named after filename
	if (!file_exists("uploads/")){
		mkdir("uploads/");
	}
	$target = "uploads/" . $filename;

	move_uploaded_file($_FILES["file"]["tmp_name"], $target);
	echo $filesize;
	/*
		// alternative way
		$putdata = fopen("php://input", "r");
		$fp = fopen($target, "w");
		while ($data = fread($putdata, 1024))
		fwrite($fp, $data);
		fclose($fp);
		fclose($putdata);

	$input = fopen("php://input", "r");
	file_put_contents($target, $input);
	*/
}
else{
    throw new Exception('Name required');
}


