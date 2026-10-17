param(
    [string]$Distro = "Ubuntu-26.04"
)

$ErrorActionPreference = "Stop"
# The repository lives in the Linux filesystem for native performance.
& wsl.exe -d $Distro -- bash -lc 'cd "$HOME/rider" && code --new-window --profile Rider .'
if ($LASTEXITCODE -ne 0) {
    throw "Could not open Rider with the VS Code Rider profile in WSL distro $Distro (exit $LASTEXITCODE)."
}
