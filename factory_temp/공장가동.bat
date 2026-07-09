@echo off
chcp 65001 >nul
title 쇼핑 쇼츠 공장 발전기 - 이 창을 닫으면 서버가 꺼집니다
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [문제 발견] Node.js가 이 컴퓨터에 설치되어 있지 않습니다.
  echo.
  echo 해결: nodejs.org 에서 LTS 버전을 설치한 뒤,
  echo       컴퓨터를 재시작하고 이 파일을 다시 더블클릭하세요.
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo 처음 실행이라 부품을 설치합니다. 1~2분 정도 걸립니다...
  echo.
  call npm install
  echo.
)

echo ============================================
echo   서버를 켭니다. 잠시 후 브라우저가 자동으로 열립니다.
echo   이 검은 창은 공장의 발전기입니다.
echo   작업하는 동안 절대 닫지 마세요!
echo ============================================
echo.

start /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
node server.js

echo.
echo [서버가 종료되었습니다]
echo 위에 빨간색이나 오류 문구가 보이면, 이 화면을 캡처해서 보내주세요.
pause
