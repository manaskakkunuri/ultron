@echo off
cd /d "%~dp0"
node serve-local.mjs
if errorlevel 1 pause
