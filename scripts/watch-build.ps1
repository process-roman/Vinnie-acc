# Prints an EAS build's status once every 30 seconds until it finishes.
# Usage: .\scripts\watch-build.ps1 <build id>
param([Parameter(Mandatory = $true)][string]$BuildId)

while ($true) {
  $json = npx -y eas-cli@latest build:view $BuildId --json 2>$null | Out-String
  try {
    $build = $json | ConvertFrom-Json
    $status = $build.status
  } catch {
    $status = 'UNKNOWN (could not read status)'
  }
  Write-Host ("{0}  build {1}: {2}" -f (Get-Date -Format 'HH:mm:ss'), $build.appBuildVersion, $status)
  if ($status -in @('FINISHED', 'ERRORED', 'CANCELED')) { break }
  Start-Sleep -Seconds 30
}

if ($status -eq 'FINISHED') {
  Write-Host 'Build finished. The upload to App Store Connect starts on its own; follow it here:'
  Write-Host 'https://expo.dev/accounts/astro_app/projects/vinnie/submissions'
} else {
  Write-Host "Build did not finish: $status. Logs: https://expo.dev/accounts/astro_app/projects/vinnie/builds/$BuildId"
}
