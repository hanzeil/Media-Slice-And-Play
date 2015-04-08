<?php
$fileName =$_SERVER['HTTP_X_FILE_NAME'];
$jsonString=$_POST['json'];
$target="uploads/" . $fileName;
file_put_contents($target,$jsonString);
?>
