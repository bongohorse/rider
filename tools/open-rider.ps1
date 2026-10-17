param(
    # Empty uses the Windows default WSL distro; the Rider host registers it as "Ubuntu".
    [string]$Distro = ""
)

$ErrorActionPreference = "Stop"
# Import the Rider profile in Windows VS Code before using --profile.
if ($Distro) {
    & wsl.exe -d $Distro -- bash -lc 'cd ~/rider && code --new-window --profile Rider .'
} else {
    & wsl.exe -- bash -lc 'cd ~/rider && code --new-window --profile Rider .'
}
if ($LASTEXITCODE -ne 0) {
    $selected = if ($Distro) { $Distro } else { "default WSL distribution" }
    throw "Could not open Rider in $selected with the imported VS Code Rider profile (exit $LASTEXITCODE)."
}
