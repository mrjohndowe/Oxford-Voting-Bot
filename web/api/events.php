<?php
declare(strict_types=1);

header('Content-Type: application/json');

$file = dirname(__DIR__) . '/events_data.json';

if (!file_exists($file)) {
    echo json_encode([
        'source' => null,
        'syncedAt' => null,
        'endpointAutoDetected' => false,
        'events' => [],
    ]);
    exit;
}

echo file_get_contents($file);
