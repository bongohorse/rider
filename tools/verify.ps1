$ErrorActionPreference = 'Stop'
& python (Join-Path $PSScriptRoot 'project.py') verify @args
exit $LASTEXITCODE
