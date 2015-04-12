<?php 
$filename   = $_SERVER['HTTP_X_FILE_NAME'];
$filesize   = $_SERVER['HTTP_X_FILE_SIZE'];
$dir="uploads/" . $_SERVER['HTTP_X_DIR_NAME'] . '/';
//error
  switch( $_FILES['file']['error'] ) {
            case UPLOAD_ERR_OK:
                $message = false;;
                break;
            case UPLOAD_ERR_INI_SIZE:
            case UPLOAD_ERR_FORM_SIZE:
                $message .= ' - file is too large. ';
                break;
            case UPLOAD_ERR_PARTIAL:
                $message .= ' - file upload was not completed.';
                break;
            case UPLOAD_ERR_NO_FILE:
                $message .= ' - zero-length file uploaded.';
                break;
            default:
                $message .= ' - internal error #'.$_FILES['newfile']['error'];
                break;
        }
// name must be in proper format
if (!$message) {
	// we store chunks in directory named after filename
	if (!file_exists("uploads/")){
		mkdir("uploads/");
	}
	if(!file_exists($dir)){
		mkdir($dir);
	}
	$target = $dir . $filename;
	if(!move_uploaded_file($_FILES["file"]["tmp_name"], $target)){
        $message = 'Error uploading file - could not save upload (this will probably be a permissions problem in '.$dest.')';
    } 
    else{
        $message = 'File uploaded okay.';
    }
}
echo $message;

