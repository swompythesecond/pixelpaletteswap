@echo off
cd /D "%~dp0"
git add .
set /p id="Enter Message:"
git commit -m "%id%_"
git push
exit