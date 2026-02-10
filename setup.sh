#!/bin/bash
# Quick setup script for Letterboxd Viewer data processing

echo "🎬 Letterboxd Data Processor - Quick Setup"
echo "=========================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✓ Python 3 detected"

# Check if required packages are installed
echo ""
echo "Checking dependencies..."
pip3 install feedparser requests --quiet

if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed"
else
    echo "⚠ Warning: Some dependencies might need manual installation"
    echo "Run: pip install feedparser requests"
fi

echo ""
echo "Available commands:"
echo ""
echo "1. Process a single ZIP file:"
echo "   python3 process_letterboxd.py --zip path/to/export.zip"
echo ""
echo "2. Process with poster fetching:"
echo "   python3 process_letterboxd.py --zip path/to/export.zip --fetch-posters"
echo ""
echo "3. Process multiple ZIPs from a directory:"
echo "   python3 process_letterboxd.py --batch path/to/directory --fetch-posters"
echo ""
echo "4. Custom output file:"
echo "   python3 process_letterboxd.py --zip path/to/export.zip --output custom.json"
echo ""
echo "Next steps:"
echo "1. Export your Letterboxd data (go to Settings > Data import & export)"
echo "2. Run one of the commands above"
echo "3. The data.json file will be auto-generated in web/"
echo "4. Open index.html in your browser to see your data loaded!"
echo ""
