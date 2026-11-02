@echo off
rem Windows entry point of the `clideck` command (see the `clideck` shell script).
node --import "%~dp0..\..\..\node_modules\tsx\dist\esm\index.mjs" "%~dp0..\src\cli\main.ts" %*
