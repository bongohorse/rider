$ErrorActionPreference = 'Stop'
& python (Join-Path $PSScriptRoot 'project.py') build @args
exit $LASTEXITCODE
