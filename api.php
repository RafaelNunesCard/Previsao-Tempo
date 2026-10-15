<?php
/**
 * api.php — Proxy PHP para APIs públicas de clima.
 *
 * O frontend NÃO fala diretamente com as APIs externas: ele chama este
 * script, que faz a requisição HTTP (server-side), recebe o JSON, valida e
 * devolve os dados já prontos para o navegador.
 *
 * Ações disponíveis (parâmetro "action"):
 *   - geocode : busca cidades por nome        -> Open-Meteo Geocoding API
 *   - weather : previsão + histórico          -> Open-Meteo Forecast API
 *   - reverse : descobre o nome de um ponto   -> Nominatim (OpenStreetMap)
 *   - snow    : clima atual de várias cidades -> Open-Meteo Forecast API
 *
 * Uso: index.php / api.php?action=weather&lat=-23.55&lon=-46.63
 */

declare(strict_types=1);

const GEO_URL      = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT   = 'PrevisaoTempo-PHP/1.0 (projeto academico)';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

/**
 * Faz um GET em uma URL externa e devolve o corpo (string).
 * Usa file_get_contents com stream_context (curl não é obrigatório).
 */
function httpGet(string $url): string
{
    // Preferência: cURL (mais comum em hospedagens).
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_USERAGENT      => USER_AGENT,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($body === false) {
            fail('Não foi possível contatar a API externa. ' . $err, 502);
        }

        return $body;
    }

    // Alternativa: file_get_contents (requer allow_url_fopen e, para https, openssl).
    $context = stream_context_create([
        'http' => [
            'method'        => 'GET',
            'header'        => "User-Agent: " . USER_AGENT . "\r\nAccept: application/json\r\n",
            'timeout'       => 15,
            'ignore_errors' => true,
        ],
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ]);

    $body = @file_get_contents($url, false, $context);

    if ($body === false) {
        fail(
            'Não foi possível contatar a API externa. Verifique se as extensões curl ou openssl '
            . 'estão habilitadas no php.ini e se allow_url_fopen está ativo.',
            502
        );
    }

    return $body;
}

/** Envia uma resposta JSON e encerra o script. */
function respond(string $json): never
{
    echo $json;
    exit;
}

/** Encerra o script com um erro em JSON. */
function fail(string $message, int $status = 400): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Lê e valida um parâmetro numérico obrigatório. */
function requireFloat(string $name): float
{
    if (!isset($_GET[$name]) || !is_numeric($_GET[$name])) {
        fail("Parâmetro \"$name\" é obrigatório e deve ser numérico.");
    }
    return (float) $_GET[$name];
}

/** Valida e codifica o corpo JSON recebido da API externa. */
function decodeOrFail(string $body, string $source): string
{
    $data = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        fail("Resposta inválida da API $source.", 502);
    }
    return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

$action = $_GET['action'] ?? '';

switch ($action) {
    // ---------------------------------------------------------------
    // Busca de cidades pelo nome (autocomplete + botão "Consultar").
    // ---------------------------------------------------------------
    case 'geocode':
        $query = trim((string) ($_GET['q'] ?? ''));
        if ($query === '') {
            fail('Informe o nome de uma cidade.');
        }

        $url = GEO_URL . '?' . http_build_query([
            'name'     => $query,
            'count'    => 8,
            'language' => 'pt',
            'format'   => 'json',
        ]);

        respond(decodeOrFail(httpGet($url), 'de geocoding'));

    // ---------------------------------------------------------------
    // Previsão do tempo + histórico para um ponto (lat/lon).
    // ---------------------------------------------------------------
    case 'weather':
        $lat = requireFloat('latitude');
        $lon = requireFloat('longitude');

        $url = FORECAST_URL . '?' . http_build_query([
            'latitude'      => number_format($lat, 4, '.', ''),
            'longitude'     => number_format($lon, 4, '.', ''),
            'current'       => 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
            'hourly'        => 'temperature_2m',
            'past_days'     => 2,
            'forecast_days' => 5,
            'timezone'      => 'auto',
        ]);

        respond(decodeOrFail(httpGet($url), 'de clima'));

    // ---------------------------------------------------------------
    // Geocodificação reversa (descobre o nome do local clicado no mapa).
    // ---------------------------------------------------------------
    case 'reverse':
        $lat = requireFloat('latitude');
        $lon = requireFloat('longitude');

        $url = NOMINATIM_URL . '?' . http_build_query([
            'format' => 'jsonv2',
            'zoom'   => 10,
            'lat'    => $lat,
            'lon'    => $lon,
        ]);

        respond(decodeOrFail(httpGet($url), 'de geocodificação reversa'));

    // ---------------------------------------------------------------
    // Clima atual de várias cidades de uma vez (mapa "onde está nevando").
    // Recebe listas separadas por vírgula em lat/lon.
    // ---------------------------------------------------------------
    case 'snow':
        $latRaw = trim((string) ($_GET['latitude'] ?? ''));
        $lonRaw = trim((string) ($_GET['longitude'] ?? ''));
        if ($latRaw === '' || $lonRaw === '') {
            fail('Informe as coordenadas (latitude/longitude).');
        }

        $lats = explode(',', $latRaw);
        $lons = explode(',', $lonRaw);
        if (count($lats) !== count($lons)) {
            fail('Quantidade de latitudes e longitudes deve ser igual.');
        }
        foreach ([...$lats, ...$lons] as $value) {
            if (!is_numeric(trim($value))) {
                fail('Todas as coordenadas devem ser numéricas.');
            }
        }

        $url = FORECAST_URL . '?' . http_build_query([
            'latitude'  => implode(',', array_map('trim', $lats)),
            'longitude' => implode(',', array_map('trim', $lons)),
            'current'   => 'temperature_2m,weather_code,snowfall',
            'timezone'  => 'auto',
        ]);

        respond(decodeOrFail(httpGet($url), 'de clima'));

    default:
        fail('Ação desconhecida. Use action=geocode|weather|reverse|snow.');
}
