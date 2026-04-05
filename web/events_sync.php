<?php
declare(strict_types=1);

header('Content-Type: application/json');

$expectedKey = 'CHANGE_THIS_SECRET';
$providedKey = $_SERVER['HTTP_X_OXFORD_API_KEY'] ?? '';

if ($expectedKey !== '' && $providedKey !== $expectedKey) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
    exit;
}

$payload = [
    'source' => $data['source'] ?? 'unknown',
    'syncedAt' => $data['syncedAt'] ?? gmdate('c'),
    'endpointAutoDetected' => (bool)($data['endpointAutoDetected'] ?? false),
    'events' => array_values(is_array($data['events'] ?? null) ? $data['events'] : []),
];

$file = __DIR__ . '/events_data.json';
file_put_contents($file, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

echo json_encode([
    'ok' => true,
    'saved' => count($payload['events']),
    'file' => basename($file),
]);
