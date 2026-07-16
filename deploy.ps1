# Baserow Fast Sync & Deployment Script
# Run this script whenever you modify files in the baserow_src/ repository.

$srcDir = Resolve-Path "../baserow_src"
$destDir = Get-Location
$tokenFile = "$destDir\.token"

if (-not (Test-Path $srcDir)) {
    Write-Error "Baserow source directory not found at $srcDir"
    exit 1
}

if (-not (Test-Path $tokenFile)) {
    Write-Error "Hugging Face write token not found at $tokenFile. Please create this file with your HF token."
    exit 1
}

$token = (Get-Content -Path $tokenFile -TotalCount 1).Trim()

Write-Host "Checking for modifications in baserow_src..." -ForegroundColor Cyan

# 1. Clean current customizations directory (except README.md)
if (Test-Path "$destDir\customizations") {
    Get-ChildItem -Path "$destDir\customizations" -Exclude "README.md" -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
} else {
    New-Item -ItemType Directory -Path "$destDir\customizations" -Force | Out-Null
}

# 2. Get modified/added/deleted files from baserow_src git status
Push-Location $srcDir
$gitFiles = git status --porcelain
Pop-Location

$copiedCount = 0

foreach ($line in $gitFiles) {
    if ($line -match '^\s*([MADRC\?]+)\s+(.*)$') {
        $status = $Matches[1].Trim()
        $relPath = $Matches[2].Trim()
        
        # Handle renames or quotes in paths
        if ($relPath -match '"(.*)"') { $relPath = $Matches[1] }
        
        # We only sync changes inside backend/, web-frontend/, premium/, enterprise/
        if ($relPath -match '^(backend|web-frontend|premium|enterprise)/') {
            $srcFile = Join-Path $srcDir $relPath
            $destFile = Join-Path "$destDir\customizations" $relPath
            
            if ($status -eq "D") {
                # Handle deletion
                if (Test-Path $destFile) {
                    Remove-Item -Path $destFile -Force
                    Write-Host "Removed from customizations: $relPath" -ForegroundColor Yellow
                }
            } else {
                # Handle modified or added files
                if (Test-Path $srcFile -PathType Leaf) {
                    $parentDir = Split-Path $destFile -Parent
                    if (-not (Test-Path $parentDir)) {
                        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
                    }
                    Copy-Item -Path $srcFile -Destination $destFile -Force
                    Write-Host "Synced: $relPath" -ForegroundColor Green
                    $copiedCount++
                }
            }
        }
    }
}

# Sync custom Caddyfile if it has been modified or if we need to ensure it exists
if (Test-Path "$srcDir\Caddyfile") {
    $parentDir = "$destDir\customizations\caddy"
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    Copy-Item -Path "$srcDir\Caddyfile" -Destination "$parentDir\Caddyfile" -Force
    Write-Host "Synced Caddyfile to customizations/caddy/Caddyfile" -ForegroundColor Green
    $copiedCount++
}

if ($copiedCount -eq 0) {
    Write-Host "No custom source modifications detected in baserow_src (backend, web-frontend, premium, enterprise)." -ForegroundColor Yellow
    Write-Host "If you want to force push, add your files/changes in baserow_src first."
    exit 0
}

Write-Host "Sync complete. Deploying to Hugging Face Spaces..." -ForegroundColor Cyan

# 3. Commit and push to Hugging Face
git add .
git commit -m "Auto-sync modifications from baserow_src"
git remote set-url origin "https://user:$token@huggingface.co/spaces/fycd2006/FYCD-HD-MANAGER"
git push origin main
git remote set-url origin "https://huggingface.co/spaces/fycd2006/FYCD-HD-MANAGER"

Write-Host "Deployment completed successfully. Your Space will restart with the updates in a few seconds." -ForegroundColor Green
