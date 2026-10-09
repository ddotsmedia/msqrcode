@echo off
REM Milestones Coffee - Quick VPS Deployment Fix
REM Double-click this file to deploy corrected Dockerfiles and rebuild

cd /d "%~dp0"

echo.
echo ====================================================
echo Milestones Coffee - VPS Deployment Fix
echo ====================================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Running PowerShell deployment script...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "DEPLOY_TO_VPS.ps1"
) else (
    echo PowerShell not found. Using bash...
    bash DEPLOY_FIX_VPS.sh
)

echo.
echo Deployment completed. Press any key to close...
pause >nul
