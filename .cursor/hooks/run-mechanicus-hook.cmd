@echo off
REM Prefer hooks.json calling: python -u .cursor/hooks/speak_last_sentence_mechanicus.py
REM (avoids cmd chaining that can drop stdin on Windows). This launcher is for manual runs.
setlocal
cd /d "%~dp0..\.."
where py >nul 2>&1
if %ERRORLEVEL% equ 0 (
  py -3 -u "%~dp0speak_last_sentence_mechanicus.py"
  exit /b %ERRORLEVEL%
)
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
  python -u "%~dp0speak_last_sentence_mechanicus.py"
  exit /b %ERRORLEVEL%
)
echo [mechanicus-hook] neither py nor python on PATH >&2
exit /b 9009
