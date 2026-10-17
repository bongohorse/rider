param(
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"
# Rider is checked out in the WSL Linux filesystem. Confirm the named Rider
# profile has been imported on Windows before using --profile.
$installed = & wsl.exe --list --quiet
if ($LASTEXITCODE -ne 0) { throw "Unable to enumerate installed WSL distributions." }
$names = @($installed | ForEach-Object { ($_ -replace [char]0, '').Trim() } | Where-Object { $_ })
if ($Distro -notin $names) {
    throw "WSL distro '$Distro' not installed. Installed: $($names -join ', '). Check wsl --list --verbose or pass -Distro."
}
& wsl.exe -d $Distro -- bash -lc 'cd ~/rider && test -d .git && command -v code >/dev/null && code --new-window --profile Rider .'
if ($LASTEXITCODE -ne 0) {
    throw "Could not open ~/rider under the imported Rider VS Code profile in WSL distro $Distro (exit $LASTEXITCODE)."
}
