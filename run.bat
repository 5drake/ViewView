@echo off
chcp 65001 >nul
title ViewView
cd /d "%~dp0"

echo.
echo  ======================================================
echo    🖼️  ViewView - Image Explorer ^& Viewer 실행 중...
echo  ======================================================
echo.

npm run dev
