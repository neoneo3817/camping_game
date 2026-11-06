$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$base = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

Write-Host 'slowcamp 로컬 실행 서버가 켜졌어요.' -ForegroundColor Green
Write-Host "브라우저 주소: http://127.0.0.1:$port/"
Write-Host '종료하려면 이 창에서 Ctrl+C를 누르세요.'
Start-Process "http://127.0.0.1:$port/"

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
            $requestLine = $reader.ReadLine()
            if (-not $requestLine) { continue }
            while ($null -ne ($header = $reader.ReadLine()) -and $header.Length -gt 0) { }
            $parts = $requestLine.Split(' ')
            if ($parts.Length -lt 2) { continue }

            $relative = [System.Uri]::UnescapeDataString(($parts[1] -split '\?', 2)[0]).TrimStart('/')
            if ($relative -eq 'api/camping-gear-catalog') {
                $gearRoot = Join-Path $root 'camping_gear'
                $paths = @(Get-ChildItem -LiteralPath $gearRoot -Recurse -File -Filter '*.glb' | ForEach-Object { $_.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/') })
                $json = ConvertTo-Json -InputObject $paths -Compress
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $head = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($head); $stream.Write($headerBytes, 0, $headerBytes.Length); $stream.Write($bytes, 0, $bytes.Length); continue
            }
            if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
            $target = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
            if (-not $target.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
                $status = '403 Forbidden'; $bytes = [System.Text.Encoding]::UTF8.GetBytes('Forbidden'); $type = 'text/plain; charset=utf-8'
                $head = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($head); $stream.Write($headerBytes, 0, $headerBytes.Length); $stream.Write($bytes, 0, $bytes.Length); continue
            }
            if (Test-Path -LiteralPath $target -PathType Container) { $target = Join-Path $target 'index.html' }
            if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
                $status = '404 Not Found'; $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found'); $type = 'text/plain; charset=utf-8'
                $head = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($head); $stream.Write($headerBytes, 0, $headerBytes.Length); $stream.Write($bytes, 0, $bytes.Length); continue
            }

            $extension = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
            $type = switch ($extension) {
                '.html' { 'text/html; charset=utf-8' }
                '.js' { 'text/javascript; charset=utf-8' }
                '.json' { 'application/json; charset=utf-8' }
                '.webmanifest' { 'application/manifest+json; charset=utf-8' }
                '.glb' { 'model/gltf-binary' }
                '.gltf' { 'model/gltf+json' }
                '.css' { 'text/css; charset=utf-8' }
                '.svg' { 'image/svg+xml' }
                '.png' { 'image/png' }
                '.jpg' { 'image/jpeg' }
                '.jpeg' { 'image/jpeg' }
                '.gif' { 'image/gif' }
                '.mp4' { 'video/mp4' }
                default { 'application/octet-stream' }
            }
            $fileInfo = [System.IO.FileInfo]::new($target)
            $head = "HTTP/1.1 200 OK`r`nContent-Type: $type`r`nContent-Length: $($fileInfo.Length)`r`nConnection: close`r`nCache-Control: no-cache`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $input = [System.IO.File]::OpenRead($target)
            try { $input.CopyTo($stream) } finally { $input.Dispose() }
        } catch {
            Write-Host "요청 처리 오류: $($_.Exception.Message)" -ForegroundColor Yellow
        } finally {
            if ($reader) { $reader.Dispose() }
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
