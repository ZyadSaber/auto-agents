# ═══════════════════════════════════════════════════════════════
#  WSL2 Resource Optimizer - AI Customer Service
# ═══════════════════════════════════════════════════════════════
# This script configures WSL2 to use your server's full hardware
# potential (RAM & CPU).

$wslConfigPath = "$env:USERPROFILE\.wslconfig"

# 1. Detect Hardware
$totalRam = (Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize
$totalCores = (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors

# Calculate recommended usage (90% of RAM, leave 10% for Windows)
$targetRamKB = [Math]::Floor($totalRam * 0.9)
$targetRamGB = [Math]::Floor($targetRamKB / 1024 / 1024)

Write-Host "--- Hardware Detected ---" -ForegroundColor Cyan
Write-Host "Total RAM: $([Math]::Floor($totalRam / 1024 / 1024)) GB"
Write-Host "Total Cores: $totalCores"
Write-Host ""

Write-Host "--- Optimizing for Server ---" -ForegroundColor Yellow
Write-Host "Setting WSL Memory to: ${targetRamGB}GB"
Write-Host "Setting WSL Processors to: $totalCores"

# 2. Prepare Config Content
$configContent = @"
[wsl2]
memory=${targetRamGB}GB
processors=$totalCores
guiApplications=false
nestedVirtualization=true
"@

# 3. Write to File
try {
    if (Test-Path $wslConfigPath) {
        $backupPath = "$wslConfigPath.bak"
        Copy-Item $wslConfigPath $backupPath -Force
        Write-Host "Backup of existing .wslconfig created at $backupPath" -ForegroundColor Gray
    }
    
    Set-Content -Path $wslConfigPath -Value $configContent -Encoding UTF8
    Write-Host "SUCCESS: $wslConfigPath has been updated." -ForegroundColor Green
    Write-Host ""
    Write-Host "!!! IMPORTANT !!!" -ForegroundColor Red
    Write-Host "You MUST restart WSL for these changes to take effect."
    Write-Host "Run the following command in an Admin PowerShell:"
    Write-Host "wsl --shutdown" -ForegroundColor White
}
catch {
    Write-Host "ERROR: Could not write to $wslConfigPath. Please run as Administrator." -ForegroundColor Red
}

pause
