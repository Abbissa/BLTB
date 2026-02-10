@echo off
REM Quick setup script for Letterboxd Viewer data processing (Windows)

echo.
echo 🎬 Letterboxd Data Processor - Quick Setup
echo ==========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.8 or higher.
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo ✓ Python detected

REM Check and install dependencies
echo.
echo Checking dependencies...
python -m pip install feedparser requests --quiet

if errorlevel 1 (
    echo ⚠ Warning: Some dependencies might need manual installation
    echo Run: pip install feedparser requests
) else (
    echo ✓ Dependencies installed
)

echo.
echo Available commands:
echo.
echo 1. Process a single ZIP file:
echo    python process_letterboxd.py --zip path\to\export.zip
echo.
echo 2. Process with poster fetching:
echo    python process_letterboxd.py --zip path\to\export.zip --fetch-posters
echo.
echo 3. Process multiple ZIPs from a directory:
echo    python process_letterboxd.py --batch path\to\directory --fetch-posters
echo.
echo 4. Custom output file:
echo    python process_letterboxd.py --zip path\to\export.zip --output custom.json
echo.
echo Next steps:
echo 1. Export your Letterboxd data (go to Settings ^> Data import ^& export)
echo 2. Run one of the commands above
echo 3. The data.json file will be auto-generated in web\
echo 4. Open index.html in your browser to see your data loaded!
echo.
pause
