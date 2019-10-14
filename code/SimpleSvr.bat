@echo off
setlocal 

REM set "PATH=%path%;%cd%\..\..\..\PortoServer\instantclient_12_1;"

..\node --inspect=7000 "%~dp0\SimpleSvr.js" 

endlocal
