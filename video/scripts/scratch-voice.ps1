# Scratch narration for timing only (never shipped): one WAV per line of src/vo.json,
# spoken by Windows text-to-speech.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/scratch-voice.ps1 [-Voice "Microsoft Zira Desktop"] [-Rate 0]
# Writes public/audio/scratch/vo-0N.wav and vo-0N.phrases.json ({ durationMs, phrases: [{ text, startMs, endMs }] }).
# Each phrase is synthesized on its own and joined, so its start and end are exact; scripts/captions.mjs
# spreads the words of a phrase across it (or uses whisper.cpp word timings when installed).
# The founder's takes (public/audio/vo-0N.mp3) replace these automatically when they exist.
param(
  [string]$Voice = "",
  [int]$Rate = 0
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $PSScriptRoot
$vo = Get-Content -Raw -Encoding UTF8 (Join-Path $root "src/vo.json") | ConvertFrom-Json
$outDir = Join-Path $root "public/audio/scratch"
New-Item -ItemType Directory -Force $outDir | Out-Null

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$names = $synth.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { $_.VoiceInfo.Name }
if ($Voice -eq "") {
  $Voice = ($names | Where-Object { $_ -match "David|Mark|Guy|Zira" } | Select-Object -First 1)
  if (-not $Voice) { $Voice = $names | Select-Object -First 1 }
}
$synth.SelectVoice($Voice)
$synth.Rate = $Rate
Write-Host "scratch voice: $Voice, rate $Rate"

$rateHz = 48000
$bytesPerMs = $rateHz * 2 / 1000.0
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo($rateHz, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

function Get-Pcm([string]$text) {
  $ms = New-Object System.IO.MemoryStream
  $synth.SetOutputToAudioStream($ms, $fmt)
  $synth.Speak($text)
  $synth.SetOutputToNull()
  return , $ms.ToArray()
}

function Trim-Silence([byte[]]$pcm) {
  # drop leading and trailing samples quieter than about -46 dBFS
  $n = [int]($pcm.Length / 2)
  $thr = 160
  $a = 0
  while ($a -lt $n -and [math]::Abs([BitConverter]::ToInt16($pcm, $a * 2)) -lt $thr) { $a++ }
  $b = $n - 1
  while ($b -gt $a -and [math]::Abs([BitConverter]::ToInt16($pcm, $b * 2)) -lt $thr) { $b-- }
  if ($b -le $a) { return , [byte[]]@() }
  $len = ($b - $a + 1) * 2
  $out = New-Object byte[] $len
  [Array]::Copy($pcm, $a * 2, $out, 0, $len)
  return , $out
}

function Silence([int]$ms) { return , (New-Object byte[] ([int]$ms * 96)) } # 48 kHz, 16-bit mono

foreach ($line in $vo.lines) {
  $wav = Join-Path $outDir ($line.id + ".wav")
  $json = Join-Path $outDir ($line.id + ".phrases.json")
  # phrases end at , . : ; and keep their punctuation
  $phrases = @([regex]::Matches($line.text, "[^,.:;]+[,.:;]?") | ForEach-Object { $_.Value.Trim() } | Where-Object { $_ -ne "" })
  $body = New-Object System.IO.MemoryStream
  $cursor = 0.0
  $meta = @()
  $lead = Silence 300
  $body.Write($lead, 0, $lead.Length); $cursor += 300
  for ($i = 0; $i -lt $phrases.Count; $i++) {
    $p = $phrases[$i]
    $pcm = Trim-Silence (Get-Pcm $p)
    $start = $cursor
    $body.Write($pcm, 0, $pcm.Length)
    $cursor += $pcm.Length / $bytesPerMs
    $meta += [ordered]@{ text = $p; startMs = [math]::Round($start); endMs = [math]::Round($cursor) }
    if ($i -lt $phrases.Count - 1) {
      # a breath after a comma, a beat after a full stop or colon
      $gap = if ($p -match "[.:;]$") { 420 } else { 170 }
      $g = Silence $gap
      $body.Write($g, 0, $g.Length); $cursor += $gap
    }
  }
  $tail = Silence 300
  $body.Write($tail, 0, $tail.Length); $cursor += 300

  $data = $body.ToArray()
  $fs = [System.IO.File]::Create($wav)
  $bw = New-Object System.IO.BinaryWriter($fs)
  $bw.Write([Text.Encoding]::ASCII.GetBytes("RIFF")); $bw.Write([int](36 + $data.Length)); $bw.Write([Text.Encoding]::ASCII.GetBytes("WAVE"))
  $bw.Write([Text.Encoding]::ASCII.GetBytes("fmt ")); $bw.Write([int]16); $bw.Write([int16]1); $bw.Write([int16]1)
  $bw.Write([int]$rateHz); $bw.Write([int]($rateHz * 2)); $bw.Write([int16]2); $bw.Write([int16]16)
  $bw.Write([Text.Encoding]::ASCII.GetBytes("data")); $bw.Write([int]$data.Length); $bw.Write($data)
  $bw.Close(); $fs.Close()

  $dur = [math]::Round($data.Length / $bytesPerMs)
  $obj = [ordered]@{ id = $line.id; text = $line.text; voice = $Voice; rate = $Rate; durationMs = $dur; phrases = $meta }
  $obj | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 $json
  Write-Host ("{0}: {1:N2} s, {2} phrases" -f $line.id, ($dur / 1000.0), $phrases.Count)
}
$synth.Dispose()
Get-ChildItem $outDir -Filter "*.words.json" | Remove-Item -ErrorAction SilentlyContinue
