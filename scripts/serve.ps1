# IBDP Review 本地服务器
# 用途：在本机看全功能版网站（课本 PDF 跳转按钮直达指定页）。
# 公网 Pages 版访问不到本机 PDF，只有数据可视化。
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host ""
Write-Host "  IBDP Review 本地站:  http://localhost:8788/docs/" -ForegroundColor Green
Write-Host "  (Ctrl+C 停止)" -ForegroundColor DarkGray
Write-Host ""
python -m http.server 8788
