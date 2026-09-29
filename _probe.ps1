$ErrorActionPreference = 'SilentlyContinue'
$lines = Get-Content '.env.local'
$u = (($lines -match 'VITE_SUPABASE_URL=') -replace '^VITE_SUPABASE_URL=', '').Trim()
$k = (($lines -match 'VITE_SUPABASE_ANON_KEY=') -replace '^VITE_SUPABASE_ANON_KEY=', '').Trim()
$h = @{ apikey = $k; Authorization = "Bearer $k" }
$out = New-Object System.Collections.Generic.List[string]

$out.Add("PROJECT: $u")

function Probe([string]$label, [string]$uri, [string]$method = 'GET', $headers = $null) {
  $hh = if ($headers) { $headers } else { $h }
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-WebRequest -Uri $uri -Headers $hh -Method $method -UseBasicParsing -TimeoutSec 30
    $sw.Stop()
    return ("{0,-30} HTTP {1,-4} {2,5} ms" -f $label, $r.StatusCode, [math]::Round($sw.Elapsed.TotalMilliseconds))
  } catch {
    $sw.Stop()
    $code = $_.Exception.Response.StatusCode.value__
    return ("{0,-30} HTTP {1,-4} {2,5} ms" -f $label, $code, [math]::Round($sw.Elapsed.TotalMilliseconds))
  }
}

1..3 | ForEach-Object { $out.Add((Probe "ping #$_" "$u/rest/v1/items?select=id&limit=1")) }

$out.Add('')
$out.Add((Probe "view v_inventory" "$u/rest/v1/v_inventory?select=id&limit=1"))
$out.Add((Probe "table stock_movements" "$u/rest/v1/stock_movements?select=id&limit=1"))
$out.Add((Probe "table profiles" "$u/rest/v1/profiles?select=id&limit=1"))
$out.Add((Probe "col goods_receipts.voided_at" "$u/rest/v1/goods_receipts?select=voided_at&limit=1"))
$out.Add((Probe "view v_order_fulfillment" "$u/rest/v1/v_order_fulfillment?select=id&limit=1"))
$out.Add((Probe "view v_supplier_discrepancies" "$u/rest/v1/v_supplier_discrepancies?select=order_id&limit=1"))
$out.Add((Probe "rpc stock_api_version" "$u/rest/v1/rpc/stock_api_version" 'POST' ($h + @{ 'Content-Type' = 'application/json' })))

$out.Add('')
$t1 = Measure-Command { Invoke-WebRequest -Uri "$u/rest/v1/items?select=id&limit=200" -Headers $h -UseBasicParsing -TimeoutSec 30 | Out-Null }
$t2 = Measure-Command { Invoke-WebRequest -Uri "$u/rest/v1/items?select=id&limit=1000" -Headers $h -UseBasicParsing -TimeoutSec 30 | Out-Null }
$t3 = Measure-Command { Invoke-WebRequest -Uri "$u/rest/v1/v_inventory?select=id&limit=1000" -Headers $h -UseBasicParsing -TimeoutSec 30 | Out-Null }
$out.Add("page 200 rows  : {0} ms" -f [math]::Round($t1.TotalMilliseconds))
$out.Add("page 1000 rows : {0} ms" -f [math]::Round($t2.TotalMilliseconds))
$out.Add("view page 1000 : {0} ms" -f [math]::Round($t3.TotalMilliseconds))

$out | Set-Content -Path '_probe.txt' -Encoding UTF8
