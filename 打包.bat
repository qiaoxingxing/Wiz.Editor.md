@rem 作用：
@rem 用法：
@rem 其他：
@rem 2018/12/26 周三 14:27:01.92
@echo off&SetLocal EnableDelayEdexpansion&cd /d "%~dp0"

set bindizip="C:\Program Files\Bandizip\Bandizip.exe"

rem 打包的白名单, 如果新增文件需要修改这里;
set compress_file=CHANGE.md Editor.md index.html logo.png md_editor.js md_editor_core.js md_editor_global.js md_editor_inject.js plugin.ini README.md to-markdown

set plugin_file=Wiz.Editor.md.wizplugin

del /f %plugin_file%

%bindizip% a -fmt:zip %plugin_file% %compress_file%



pause
