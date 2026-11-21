<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$docker=file_get_contents($root.'/Dockerfile');
if(!is_string($docker))throw new RuntimeException('Missing Dockerfile');
foreach(['FROM php:8.3-apache','APP_MODE=demo','APP_WRITE_ENABLED=0','COPY src/','COPY public/','EXPOSE 10000'] as $token){
    if(!str_contains($docker,$token))throw new RuntimeException('Unsafe or incomplete Dockerfile: '.$token);
}
foreach(preg_split('/\r?\n/',$docker) as $line){
    if(!str_starts_with($line,'COPY '))continue;
    if(!preg_match('~^COPY (src/|public/) /var/www/html/(src/|public/)$~',$line))
        throw new RuntimeException('Build tries to copy extra files: '.$line);
}
$cmd=array_values(array_filter(preg_split('/\r?\n/',$docker),static fn($line)=>str_starts_with($line,'CMD ')));
if(count($cmd)!==1||!is_array(json_decode(substr($cmd[0],4),true))){
    throw new RuntimeException('Invalid Dockerfile CMD JSON');
}
if(!str_contains($docker,'DocumentRoot /var/www/html/public'))throw new RuntimeException('Document root must be public');
if(!is_file($root.'/public/health.php')||!is_file($root.'/public/robots.txt'))
    throw new RuntimeException('Missing unauthenticated health check or crawler exclusion');
$health=file_get_contents($root.'/public/health.php');
if(!str_contains($health,'http_response_code(204)'))throw new RuntimeException('Health should return only HTTP 204');
if(str_contains($docker,'GOOGLE_SERVICE_ACCOUNT_FILE='))throw new RuntimeException('Private credential path embedded in image');
echo "Safe Render demo Docker config checked\n";
