@echo off
chcp 65001 >nul
title ViewView - High Performance Image Explorer
cd /d "%~dp0"

echo.
echo  ======================================================
echo    🖼️  ViewView - Image Explorer ^& Viewer 실행 중...
echo  ======================================================
echo.

npm run dev
