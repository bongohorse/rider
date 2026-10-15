# Forward all arguments verbatim to the shared implementation.
$ErrorActionPreference = 'Stop'
& python (Join-Path $PSScriptRoot 'doctor.py') @args
exit $LASTEXITCODE
