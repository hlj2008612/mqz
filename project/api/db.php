<?php
// 修改为你的实际数据库信息
$host = 'sql310.infinityfree.com';
$db   = 'if0_42214661_zmq';
$user = 'if0_42214661';
$pass = 'zmq2008823hlj';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    die('数据库连接失败: ' . $e->getMessage());
}
?>