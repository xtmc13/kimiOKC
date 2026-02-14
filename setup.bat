@echo off
chcp 65001 >nul 2>&1
title XTMC量化交易系统 - 一键部署

echo.
echo ╔══════════════════════════════════════════╗
echo ║    XTMC量化交易系统 - Windows一键部署    ║
echo ╚══════════════════════════════════════════╝
echo.

:: 检测Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [XTMC] Node.js: %NODE_VER%

:: 检测npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到npm
    pause
    exit /b 1
)

echo.
echo  1) 构建生产版本
echo  2) 启动开发服务器
echo  3) Docker部署
echo  4) 退出
echo.

set /p choice="请选择 [1-4]: "

if "%choice%"=="1" goto build
if "%choice%"=="2" goto dev
if "%choice%"=="3" goto docker
if "%choice%"=="4" exit /b 0
goto end

:build
echo.
echo [XTMC] 安装依赖...
call npm ci --no-audit 2>nul || call npm install
echo [XTMC] 构建中...
call npm run build
echo.
echo [XTMC] 构建完成! dist/ 目录已生成
echo [XTMC] 预览: npm run preview
pause
goto end

:dev
echo.
echo [XTMC] 安装依赖...
call npm ci --no-audit 2>nul || call npm install
echo [XTMC] 启动开发服务器...
call npm run dev
goto end

:docker
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker未安装，请先安装Docker Desktop
    pause
    goto end
)
echo [XTMC] Docker构建和部署...
docker compose up -d --build
echo [XTMC] 部署完成! 访问: http://localhost:3000
pause
goto end

:end
