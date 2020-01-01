var modified = false;
var objApp = window.external;
var wizEditor;
var docTitle = "";
/**
   * //qxx
   * @param {输入字符串} source 
   * @param {是否是增加级别: true提升级别, false:降低级别} isAddLevel 
   */
var changeHeaderLevelForString = function (source, isAddLevel) {
    var lines = source.split("\n");
    var num = 0;
    var newLines = []

    var parseLine = function (line, isAddLevel) {
        if (isAddLevel) {
            return line.replace("# ", "## "); //note: replace只会替换一次
        } else {
            return line.replace("## ", "# ");
        }
    }

    //note: for...in 被废弃了, 用for...of
    for (var line of lines) {
        var arr = line.match(/^#+ /g); //#号开头,空格结尾

        if (arr) {
            if (arr[0] === "# " && !isAddLevel) {
                //最高级别是1级; 
                console.info("最高级别是1级; ")
                return null;
            }
            line = parseLine(line, isAddLevel);
        }
        newLines.push(line);
    }
    var newSource = newLines.join("\n");
    return newSource;
}

function changeHeaderLevel(cm, isAddLevel) {
    var cursor = cm.getCursor();

    if (!cm.somethingSelected()) {
        //如果没有选择, 就选中当前行;
        cm.setSelection({ line: cursor.line, ch: 0 }, { line: cursor.line + 1, ch: 0 });
    }
    var selection = cm.getSelection();

    var newSource = changeHeaderLevelForString(selection, isAddLevel);
    if (newSource != null) {
        cm.replaceSelection(newSource, "around"); //around表示选中新选区
    }
}
//qxx 自定义函数
function showMsg(cm, text) {
    //qxx 复制自vim的showConfirm
    if (cm.openNotification) {
        cm.openNotification('<span style="color: red">' + text + '</span>',
            { bottom: true, duration: 3000 });
    } else {
        alert(text);
    }
}
/**
 * 返回空格的数目
 * @param {cm} cm 
 * @param {string} line 
 */
function getIndentSpaceCount(cm, line) {
    if (typeof cm !== "object") {
        throw "parameter error";
    }
    if (!line) {
        return 0;
    }
    let match = line.match(/(^\s*)/);
    if (match) {
        let indentUnit = cm.getOption("indentUnit");
        let space = new Array(indentUnit + 1).join(" ");
        //把制表符替换成空格;
        let allSpace = match[1].replace(/\t/g, space);
        return allSpace.length;
    }
    return 0;
}

function convertTab2Space(cm, content) {
    if (!content) {
        return "";
    }
    let indentUnit = cm.getOption("indentUnit");
    let space = new Array(indentUnit + 1).join(" ");
    //把制表符替换成空格;
    let newContent = content.replace(/\t/g, space);
    return newContent;
}


//list的帮助方法
let listHelper = {
    /**
     * 只有空格和-, 没有内容;
     * @param {*} line 
     */
    isEmptyListItem: function (line) {
        return line && /^\s*-\s*$/.test(line);
    },
    /**
     * 是list 
     */
    isListItem: function (line) {
        return line && /^\s*-\s+/.test(line);
    },
    /**
     * 获取列表的内容,返回数组,包含两个元素, 列表的前半部分和内容, 如:["  - ","内容"]
     * @param {string} line
     */
    getListContentArray: function (line) {
        let match = line.match(/^(\s*-\s*)(.*)/)
        if (match) {
            return [match[1], match[2]];
        }
        return null;
    },
    /**
     * 粘贴时判断剪贴板里的内容是list
     * @param {多行字符串} content 
     */
    isContentList: function (content) {
        //目前的逻辑: 首行是list就是list;
        content = content || "";
        return listHelper.isListItem(content.trim());
    },
}

$(function () {
    var objDatabase = null;
    var objDocument = null;
    var objCommon = getObjCommon();
    var plainPasteMode = false;             // 纯文本粘贴模式
    var filesDirName = "index_files/";      // 本地文件目录名，不可更改
    var filesFullPath = getLocalFilesPath();
    var pluginFullPath = getPluginPath();
    var optionSettings = getOptionSettings();
    var code = loadDocument();

    //分清是不是快捷键保存，解决为知4.5版本自动保存问题
    var wizVerisonGreaterThan45 = null;
    var wantSaveKey = false;
    var wantSaveTime = null;
    try {
        wizVerisonGreaterThan45 = objApp.Window.CurrentDocumentBrowserObject != null;
    }
    catch (err) {
    }

    setEmojiFilePath();

    ////////////////////////////////////////////////
    // 配置编辑器功能
    wizEditor = editormd("test-editormd", {
        smartList: true,  //开启智能列表, 显示删除线图标
        showTrailingSpace: false, //qxx: 不高亮显示行位空格(红色波浪线)
        theme: optionSettings.EditToolbarTheme,        // 工具栏区域主题样式，见editormd.themes定义，夜间模式dark
        editorTheme: optionSettings.EditEditorTheme,         // 编辑器区域主题样式，见editormd.editorThemes定义，夜间模式pastel-on-dark
        previewTheme: optionSettings.EditPreviewTheme,        // 预览区区域主题样式，见editormd.previewThemes定义，夜间模式dark
        value: code,
        path: pluginFullPath + "Editor.md/lib/",
        htmlDecode: "style,script,iframe",  // 开启HTML标签解析，为了安全性，默认不开启
        codeFold: true,              // 代码折叠，默认关闭
        tex: true,              // 开启科学公式TeX语言支持，默认关闭
        flowChart: true,              // 开启流程图支持，默认关闭
        sequenceDiagram: true,              // 开启时序/序列图支持，默认关闭
        toc: true,              // [TOC]自动生成目录，默认开启
        tocm: false,             // [TOCM]自动生成下拉菜单的目录，默认关闭
        tocTitle: "",                // 下拉菜单的目录的标题
        tocDropdown: false,             // [TOC]自动生成下拉菜单的目录，默认关闭
        emoji: optionSettings.EmojiSupport == "1" ? true : false,              // Emoji表情，默认关闭
        taskList: true,              // Task lists，默认关闭
        disabledKeyMaps: [
            "F9", "F10", "F11"               // 禁用切换全屏状态，因为为知已经支持
        ],
        keymapMode: optionSettings.KeymapMode,              // 键盘映射模式
        toolbarIcons: function () {
            return getEditToolbarButton(optionSettings.EditToolbarButton);
        },
        toolbarIconsClass: {
            saveIcon: "fa-floppy-o",  // 指定一个FontAawsome的图标类
            captureIcon: "fa-scissors",
            plainPasteIcon: "fa-clipboard",
            optionsIcon: "fa-gear",
            outlineIcon: "fa-list",
            counterIcon: "fa-th-large",
            smartListIcon: "smart-list-off",  //smartList=true时显示的图标, 和watch保持一致; 
            unSmartListIcon: "smart-list",
        },
        toolbarHandlers: {
            saveIcon: function () {
                saveDocument();
            },
            captureIcon: function () {
                captureScreenImage();
            },
            plainPasteIcon: function () {
                plainPasteMode = !plainPasteMode;
                showPlainPasteMode();
            },
            optionsIcon: function () {
                this.executePlugin("optionsDialog", "options-dialog/options-dialog");
            },
            outlineIcon: function () {
                this.executePlugin("outlineDialog", "outline-dialog/outline-dialog");
            },
            counterIcon: function () {
                this.executePlugin("counterDialog", "counter-dialog/counter-dialog");
            },
            smartListIcon: function () {
                // 变量值smartList=true, 表示开启, 图标应当显示删除线; 
                let smartList = !wizEditor.settings.smartList;
                wizEditor.settings.smartList = smartList;
                console.debug("current smartList", smartList);
                let settings = this.settings;

                let nowIcon;
                let otherIcon;
                if (smartList) {
                    nowIcon = "unSmartListIcon";
                    otherIcon = "smartListIcon";
                } else {
                    nowIcon = "smartListIcon";
                    otherIcon = "unSmartListIcon";
                }
                let nowIconClass = settings.toolbarIconsClass[nowIcon];
                let otherIconClass = settings.toolbarIconsClass[otherIcon];
                let icon = this.toolbar.find("." + nowIconClass);
                icon.parent().attr("title", settings.lang.toolbar[otherIcon]);
                icon.removeClass(nowIconClass).addClass(otherIconClass);
            },
        },
        lang: {
            description: "为知笔记Markdown编辑器，基于 Editor.md 构建。",
            toolbar: {
                saveIcon: "保存 (Ctrl+S)",
                captureIcon: "截取屏幕",
                plainPasteIcon: "纯文本粘贴模式",
                optionsIcon: "选项",
                outlineIcon: "内容目录",
                counterIcon: "文章信息",
                smartListIcon: "关闭智能列表",
                unSmartListIcon: "开启智能列表",
            }
        },
        onload: function () {
            var keyMap = {
                "Ctrl-F9": function (cm) {
                    $.proxy(wizEditor.toolbarHandlers["watch"], wizEditor)();
                },
                "Ctrl-F10": function (cm) {
                    $.proxy(wizEditor.toolbarHandlers["preview"], wizEditor)();
                },
                "F1": function (cm) {
                    wizEditor.cm.execCommand("defaultTab");
                },
                "Ctrl-Alt-F": function (cm) {
                    wizEditor.cm.execCommand("find");
                },
                "Ctrl": function (cm) {
                    // 可能按了保存快捷键，记录
                    wantSaveKey = true;
                    wantSaveTime = new Date();
                },
                "Ctrl-U": function (cm) {
                    //从list-ul复制过来修改; 
                    //切换当前行的list的状态; 
                    var cursor = cm.getCursor();
                    var selection = cm.getSelection();
                    if (!selection) {
                        let line = cm.getLine(cursor.line);
                        cm.getDoc().setSelection({ line: cursor.line, ch: 0 }, { line: cursor.line, ch: line.length });

                        if (!listHelper.isListItem(line)) {
                            cm.replaceSelection("- " + line);
                        } else {
                            line = line.replace("- ", "");
                            cm.getDoc().replaceSelection(line);
                        }
                    } else {
                        var selectionText = selection.split("\n");

                        for (var i = 0, len = selectionText.length; i < len; i++) {
                            selectionText[i] = (selectionText[i] === "") ? "" : "- " + selectionText[i];
                        }
                        cm.replaceSelection(selectionText.join("\n"));
                    }
                },
                "Shift-Ctrl-.": function (cm) {
                    var isAddLevel = true;
                    changeHeaderLevel.call(this, cm, isAddLevel);
                },
                "Shift-Ctrl-,": function (cm) {
                    var isAddLevel = false;
                    changeHeaderLevel.call(this, cm, isAddLevel);
                },
                "Ctrl-Alt-T": function (cm) {
                    //调用自定义的工具栏的按钮
                    //参考上面的Ctrl-F9, 注意wizEditor.settings.toolbarHandlers;
                    $.proxy(wizEditor.settings.toolbarHandlers["outlineIcon"], wizEditor)();
                },
                "Ctrl-D": function (cm) {
                    console.debug("Ctrl-D");
                    $.proxy(wizEditor.settings.toolbarHandlers["smartListIcon"], wizEditor)();
                },
                "Shift-Tab": "indentLess",
                "Tab": function (cm) {
                    cm.execCommand("indentMore");
                },
                "Backspace": function (cm) {
                    // console.debug("Backspace");
                    // cursor = cm.getCursor();
                    // cm.getDoc().markText({ line: cursor.line, ch: 0 }, { line: cursor.line, ch: cursor.ch }, {
                    //     className: "qxx-red",
                    //     atomic: true,
                    //     selectRight: true,
                    //     selectLeft: false,
                    // })
                    cm.execCommand("delCharBefore");
                },
                "Enter": function (cm) {
                    let smartList = wizEditor.settings.smartList;
                    if (!smartList) {
                        //没有开启smartlist
                        cm.execCommand("newlineAndIndent");
                        return;
                    }
                    //以下是开启了smartList
                    let cursor = cm.getCursor();
                    let currentLine = cm.getLine(cursor.line);
                    if (!listHelper.isListItem(currentLine)) {
                        cm.execCommand("newlineAndIndent");
                        return;
                    }
                    //以下表示当前行是listitem
                    //回车需要处理的集中情况: 
                    //1. 下一行增加同级listitem
                    //2. 下一行增加下级listitem
                    //3. 本行减少缩进
                    //4. 本行是"^- "时, 删除"- "
                    let nextLine = cm.getLine(cursor.line + 1);
                    let currentIndentLevel = getIndentSpaceCount(cm, currentLine);
                    let nextIndentLevel = 0;  //nextLine可能不是listItem, 默认为0
                    if (listHelper.isListItem(nextLine)) {
                        nextIndentLevel = getIndentSpaceCount(cm, nextLine);
                    }
                    if (currentLine === "- ") {
                        //情况4
                        cm.setSelection({ line: cursor.line, ch: 0 }, { line: cursor.line, ch: currentLine.length});
                        cm.replaceSelection("")
                    } else if (listHelper.isEmptyListItem(currentLine) &&
                        currentIndentLevel > nextIndentLevel) {
                        //当前主题时emptyList的时候, 且缩进量大于下一行
                        //情况3:
                        cm.execCommand("indentLess");
                    } else {
                        //情况1
                        cm.execCommand("newlineAndIndent");
                        //情况2: 当后面缩进量大于本行, 增加缩进, 相当于直接进入子级主题
                        if (nextIndentLevel > currentIndentLevel) {
                            cm.execCommand("indentMore");
                        }
                        //添加列表符号
                        cm.replaceSelection("- ");

                    }
                    //让前面部分作为整体; 待定
                    // cursor = cm.getCursor();
                    // cm.getDoc().markText({ line: cursor.line, ch: 0 }, { line: cursor.line, ch: cursor.ch - 1 }, {
                    //     className: "qxx-red",
                    //     atomic: true
                    // })

                    // showConfirm(cm,currentLine)
                    // console.debug("test", `[${currentIndentLevel}]`);
                },
                "Ctrl-Enter": function (cm) {
                    let cursor = cm.getCursor();
                    let currentLine = cm.getLine(cursor.line);
                    if (!listHelper.isListItem(currentLine)) {
                        return;
                    }
                    let array = listHelper.getListContentArray(currentLine);
                    if (!array || array.length < 2 || !array[1]) {
                        return;
                    }
                    let prefix = array[0];
                    let content = array[1].trim();
                    //如果内容已经有删除线了, 去除删除线; 
                    if (content.startsWith("~~") && content.endsWith("~~")) {
                        content = content.substring(2, content.length - 2);
                    } else {
                        content = `~~${content}~~`;
                    }
                    let newLine = prefix + content;
                    cm.getDoc().replaceRange(newLine, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: currentLine.length })
                },
                "Ctrl-E": function (cm) {
                    //用于测试效果
                    console.debug("test Ctrl-E");
                    cm.execCommand("deleteLine");

                }

            };
            this.addKeyMap(keyMap);
            showPlainPasteMode();
            //qxx
            // $.proxy(wizEditor.toolbarHandlers["watch"], wizEditor)();

            //qxx 默认打开目录树
            $.proxy(wizEditor.settings.toolbarHandlers["outlineIcon"], wizEditor)();
            this.cm.on("beforeSelectionChange", function (cm, obj) {
                // obj: {ranges, origin, update})
                // console.debug("beforeSelectionChange", JSON.stringify(obj));
                const qxxSticky = "qxxSticky";
                let range = obj.ranges[0];
                let anchor = range.anchor;
                let head = range.head;
                // console.debug("json", JSON.stringify(anchor), JSON.stringify(head));
                if (anchor.sticky == qxxSticky) {
                    return;
                }
                if (head.ch == 0) {
                    //处理多选一行的情况; 
                    //同时为零的情况: 粘贴之后选中; 
                    return;
                }
                let anchorLine = cm.getLine(anchor.line);
                if (!listHelper.isListItem(anchorLine)) {
                    return;
                }
                if (head.line == anchor.line) {
                    return;
                } else if (head.line < anchor.line) {
                    //向上复制时
                    console.debug("beforeSelectionChange up");
                    anchor.ch = cm.getLine(anchor.line).length + 1;
                    //qxx 这种方式有问题, 会往下一直复制, 原因不明; 
                    // anchor.sticky = qxxSticky;  //导致head无效;
                    // anchor.ch = 0;
                    // anchor.line = anchor.line + 1;
                    head.ch = 0;
                } else {
                    //向下复制时
                    //选择到head所在行的最后一个字符
                    //不能选择到head下一行的第0个字符
                    console.debug("beforeSelectionChange down");
                    anchor.ch = 0;
                    // head.ch = cm.getLine(head.line).length;
                    head.ch = 0;
                    //选择它的下级
                    let anchorLine = cm.getLine(anchor.line);
                    let anchorLineSpace = getIndentSpaceCount(cm, anchorLine);
                    let nextLineNo = head.line + 1;
                    while (true) {
                        let nextLine = cm.getLine(nextLineNo);
                        let nextLineSpace = getIndentSpaceCount(cm, nextLine);
                        if (nextLineSpace > anchorLineSpace) {
                            nextLineNo += 1;
                        } else {
                            head.line = nextLineNo;
                            break;
                        }
                    }
                }
                obj.update([{
                    anchor: anchor,
                    head: head
                }])
            })

            this.cm.on("paste", function (cm, e) {
                console.debug("on paste 2");
                var clipboardData = e.clipboardData || window.clipboardData;
                if (!clipboardData) {
                    return;
                }
                if ($.inArray("text/plain", clipboardData.types) == -1) {
                    return;
                }
                let contentclipboard = clipboardData.getData("text/plain");
                contentclipboard = convertTab2Space(cm, contentclipboard);
                //判断内容是list;
                let isContentList = listHelper.isContentList(contentclipboard);
                if (!isContentList) {
                    return;
                }
                let contentArray = contentclipboard.split("\n").filter(n => !!n.trim());
                //如果当前行是空listItem
                let cursor = cm.getCursor();
                let line = cm.getLine(cursor.line);
                let newContent = "";
                if (listHelper.isEmptyListItem(line)) {
                    let targetIndentLevel = getIndentSpaceCount(cm, line);
                    //根据剪贴板的第一行判断缩进量;
                    let nowIndentLevel = getIndentSpaceCount(cm, contentArray[0]);
                    let diff = targetIndentLevel - nowIndentLevel;
                    if (diff >= 0) {
                        //增加缩进: 行首添加空格; 
                        let space = new Array(diff + 1).join(" ");
                        contentArray = contentArray.map(n => space + n);
                    } else {
                        //tab在上面已经被转为space
                        diff = -1 * diff;
                        contentArray = contentArray.map(n => {
                            let spaceCount = getIndentSpaceCount(cm, n);
                            let count = Math.min(diff, spaceCount);
                            let line = n.substring(count);
                            return line;
                        });

                    }
                    newContent = contentArray.join("\n");
                    newContent = newContent.trimRight() + "\n";
                    cm.execCommand("deleteLine");
                    cm.replaceSelection(newContent, "around");  //替换内容并选中
                    e.preventDefault();
                } else {
                    //todo 
                }

            })

            // 监听文本变化事件
            this.cm.on("change", function (_cm, changeObj) {
                modified = true;
            });

            // 监听粘贴事件
            this.cm.on("paste", function (_cm, e) {
                console.debug("on paste");
                var clipboardData = e.clipboardData || window.clipboardData;
                if (clipboardData) {
                    if (clipboardData.types == "Files") {
                        clipboardToImage();
                    } else if ($.inArray("text/html", clipboardData.types) != -1) {
                        if (!plainPasteMode && clipboardHTMLToMd(clipboardData.getData("text/html"))) {
                            e.preventDefault();
                        }
                    } else {
                        //类型为"text/plain"，快捷键Ctrl+Shift+V
                    }
                }
            });

            // 绑定Ctrl-S快捷键和Vim的w命令保存
            CodeMirror.commands.save = saveDocument;

            var isWebPage = false;
            if (isWebPage) {
                $.get('Editor.md/examples/test.md', function (md) {
                    wizEditor.setMarkdown(md);
                    wizEditor.save();
                });
            }
        },
        onimageUploadButton: function () {
            var filename = objCommon.SelectWindowsFile(true, "Image Files(*.png;*.jpg;*.gif;*.bmp)|*.png;*.jpg;*.gif;*.bmp|");
            return getSavedLocalImage(filename);
        },
        onloadLocalFile: function (filename, fun) {
            fun(objCommon.LoadTextFromFile(filename));
        },
        onloadLocalJsonFile: function (filename, fun) {
            fun($.parseJSON(objCommon.LoadTextFromFile(filename)));
        },
        onsaveOptions: function (optionsValue) {
            setOptionSettings(optionsValue);
        },
        ongetOptions: function () {
            return optionSettings;
        },
        ongetObjDocument: function () {
            return objDocument;
        },
        ongetObjCommon: function () {
            return objCommon;
        },
        onclickHyperlink: function (hrefValue) {
            return openOtherDocument(hrefValue) && openHrefInBrowser(hrefValue);
        }
    });

    ////////////////////////////////////////////////
    // 获得配置值
    function getConfigValue(key, defaultValue) {
        var value = null;
        if (objCommon == null) {
            value = localStorage.getItem(key);
        }
        else {
            value = objCommon.GetValueFromIni(pluginFullPath + "plugin.ini", "PluginConfig", key);
        }
        if (value == null || value == "") {
            value = defaultValue;
        }
        return value;
    };

    ////////////////////////////////////////////////
    // 设置配置值
    function setConfigValue(key, value) {
        if (objCommon == null) {
            localStorage.setItem(key, value);
        }
        else {
            objCommon.SetValueToIni(pluginFullPath + "plugin.ini", "PluginConfig", key, value);
        }
    };

    ////////////////////////////////////////////////
    // 获得选项配置值
    function getOptionSettings() {
        var optionsValue = {
            // MarkdownStyle : getConfigValue("MarkdownStyle", "WizDefault"),
            // ReadTheme : getConfigValue("ReadTheme", "default"),
            EditToolbarButton: getConfigValue("EditToolbarButton", "default"),
            EditToolbarTheme: getConfigValue("EditToolbarTheme", "default"),
            EditEditorTheme: getConfigValue("EditEditorTheme", "default"),
            EditPreviewTheme: getConfigValue("EditPreviewTheme", "default"),
            EmojiSupport: getConfigValue("EmojiSupport", "1"),
            HrefInBrowser: getConfigValue("HrefInBrowser", "0"),
            KeymapMode: getConfigValue("KeymapMode", "default"),
        };
        return optionsValue;
    };

    ////////////////////////////////////////////////
    // 设置选项配置值
    function setOptionSettings(optionsValue) {
        if (optionSettings.EditToolbarButton != optionsValue.EditToolbarButton) {
            setConfigValue("EditToolbarButton", optionsValue.EditToolbarButton);
            var doc = wizEditor.getValue();
            wizEditor.config("toolbarIcons", getEditToolbarButton(optionsValue.EditToolbarButton));
            wizEditor.setValue(doc);
        }
        if (optionSettings.EditToolbarTheme != optionsValue.EditToolbarTheme) {
            setConfigValue("EditToolbarTheme", optionsValue.EditToolbarTheme);
            wizEditor.setTheme(optionsValue.EditToolbarTheme);
        }
        if (optionSettings.EditEditorTheme != optionsValue.EditEditorTheme) {
            setConfigValue("EditEditorTheme", optionsValue.EditEditorTheme);
            wizEditor.setEditorTheme(optionsValue.EditEditorTheme);
        }
        if (optionSettings.EditPreviewTheme != optionsValue.EditPreviewTheme) {
            setConfigValue("EditPreviewTheme", optionsValue.EditPreviewTheme);
            wizEditor.setPreviewTheme(optionsValue.EditPreviewTheme);
        }

        var showMsg = false;
        // if (optionSettings.MarkdownStyle != optionsValue.MarkdownStyle) {
        //     setConfigValue("MarkdownStyle", optionsValue.MarkdownStyle);
        //     showMsg = true;
        //     setHookRead(optionsValue.MarkdownStyle == "Editor_md");
        // }
        // if (optionSettings.ReadTheme != optionsValue.ReadTheme) {
        //     setConfigValue("ReadTheme", optionsValue.ReadTheme);
        // }
        if (optionSettings.EmojiSupport != optionsValue.EmojiSupport) {
            setConfigValue("EmojiSupport", optionsValue.EmojiSupport);
            var doc = wizEditor.getValue();
            wizEditor.config("emoji", optionsValue.EmojiSupport == "1" ? true : false);
            wizEditor.setValue(doc);
        }
        if (optionSettings.KeymapMode != optionsValue.KeymapMode) {
            setConfigValue("KeymapMode", optionsValue.KeymapMode);
            wizEditor.setKeymapMode(optionsValue.KeymapMode);
        }
        if (optionSettings.HrefInBrowser != optionsValue.HrefInBrowser) {
            setConfigValue("HrefInBrowser", optionsValue.HrefInBrowser);
        }

        optionSettings = optionsValue;
        if (objCommon != null && showMsg) {
            objApp.Window.ShowMessage("设置新选项后，您应该重新运行{p}。", "{p}", 0x00000040);
        }
    };

    ////////////////////////////////////////////////
    // 设置拦截原本的Markdown渲染
    function setHookRead(isHook) {
        var appPath = objApp.AppPath;
        var hookPath = appPath + "WizTools/htmleditor/utils.js";
        if (!objCommon.PathFileExists(hookPath)) {
            return;
        };
        var hookText = objCommon.LoadTextFromFile(hookPath);
        if (!hookText) {
            return;
        }
        if (hookText.indexOf("WizIsMarkdownByTitle") == -1) {
            return;
        }
        var findText = "function WizIsMarkdown(doc) {";
        var findIndex = hookText.indexOf(findText);
        if (findIndex == -1) {
            return;
        }

        // 备份
        var bakPath = hookPath + ".bak";
        if (!objCommon.PathFileExists(bakPath)) {
            objCommon.SaveTextToFile(bakPath, hookText, "utf-8-bom");
        };

        var saveText = null;
        var addText = wizVerisonGreaterThan45 ? "return false;" : "return WizIsMarkdownByTitle(doc);";
        var addIndex = findIndex + findText.length;
        var alreadyText = hookText.substring(addIndex, addIndex + addText.length);
        if (alreadyText == addText) {
            if (!isHook) {
                saveText = hookText.substring(0, addIndex) + hookText.substring(addIndex + addText.length);
            }
        }
        else {
            if (isHook) {
                saveText = hookText.substring(0, addIndex) + addText + hookText.substring(addIndex);
            }
        }

        if (saveText != null) {
            objCommon.SaveTextToFile(hookPath, saveText, "utf-8-bom");
            objApp.Window.ShowMessage("Markdown渲染模式已被修改，如出现问题可用\n" + bakPath + "\n文件进行还原。", "{p}", 0x00000040);
        }
    };

    ////////////////////////////////////////////////
    // 获得工具栏按钮
    function getEditToolbarButton(style) {
        if (style == "lite") {
            return [
                "saveIcon", "|",
                "bold", "italic", "|",
                "link", "quote", "code", "image", "|",
                "list-ol", "list-ul", "h1", "hr", "|",
                "undo", "redo", "||",
                "outlineIcon", "counterIcon", "optionsIcon", "help", "info"
            ];
        } else {
            return [
                "saveIcon", "|",
                "undo", "redo", "|",
                "bold", "del", "italic", "quote", "ucwords", "uppercase", "lowercase", "|",
                "h1", "h2", "h3", "|",
                "list-ul", "list-ol", "hr", "|",
                "plainPasteIcon", "link", "reference-link", "image", "captureIcon", "code", "preformatted-text", "code-block", "table", "datetime", "emoji", "html-entities", "pagebreak", "|",
                "goto-line", "watch", "preview", "search", "smartListIcon", "||",
                "outlineIcon", "counterIcon", "optionsIcon", "help", "info"
            ];
        };
    };

    ////////////////////////////////////////////////
    // 获得为知常用操作对象
    function getObjCommon() {
        if (objCommon == null) {
            try {
                objCommon = objApp.CreateWizObject("WizKMControls.WizCommonUI");
            }
            catch (err) {
            }
        }
        return objCommon;
    };

    ////////////////////////////////////////////////
    // 获得插件路径
    function getPluginPath() {
        var pluginPath = "";
        try {
            pluginPath = objApp.GetPluginPathByScriptFileName("md_editor.js");
        }
        catch (err) {
        }
        return pluginPath;
    };

    ////////////////////////////////////////////////
    // 截取屏幕
    captureScreenImage = function () {
        var filename = objCommon.CaptureScreen(0);
        if (objCommon.PathFileExists(filename)) {
            wizEditor.insertValue("![](" + getSavedLocalImage(filename) + ")");
        };
    };

    ////////////////////////////////////////////////
    // 剪贴板图片
    clipboardToImage = function () {
        var filename = objCommon.ClipboardToImage(objApp.Window.HWND, "");
        if (objCommon.PathFileExists(filename)) {
            wizEditor.insertValue("![](" + getSavedLocalImage(filename) + ")");
        }
    };

    ////////////////////////////////////////////////
    // 剪贴板解析HTML转换到Markdown
    clipboardHTMLToMd = function (htmlText) {
        if (htmlText != "") {
            var referencelinkRegEx = /reference-link/;
            wizEditor.insertValue(toMarkdown(htmlText, {
                gfm: true,
                converters: [
                    {
                        filter: 'div',
                        replacement: function (content) {
                            return content + '\n';
                        }
                    },
                    {
                        filter: 'span',
                        replacement: function (content) {
                            return content;
                        }
                    },
                    {
                        filter: function (node) {
                            return (node.nodeName === 'A' && referencelinkRegEx.test(node.className));
                        },
                        replacement: function (content) {
                            return "";
                        }
                    }]
            })
            );
            return true;
        }
        return false;
    };

    ////////////////////////////////////////////////
    // 显示纯文本粘贴模式
    showPlainPasteMode = function () {
        if (plainPasteMode) {
            $(".fa-clipboard").addClass("menu-selected");
        } else {
            $(".fa-clipboard").removeClass("menu-selected");
        };
    };

    ////////////////////////////////////////////////
    // 保存文档
    saveDocument = function () {
        if (objDocument) {
            var doc = wizEditor.getValue();
            var arrResult = dealImgDoc(doc);
            if (arrResult[0] != doc) {
                var cursor = wizEditor.getCursor();
                wizEditor.setMarkdown(arrResult[0]);
                wizEditor.setCursor(cursor);
                doc = arrResult[0];
            };

            doc = $('<div/>').text(doc).html();
            doc = doc.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');   // 替换制表符
            doc = doc.replace(/\n|\r|(\r\n)|(\u0085)|(\u2028)|(\u2029)/g, "<br/>").replace(/ /g, '\u00a0');
            doc += arrResult[1];
            doc = "<!DOCTYPE html><html><head><style id=\"wiz_custom_css\"></style></head><body>" + doc + "</body></html>";
            objDocument.UpdateDocument3(doc, 0);
            modified = false;
        }
    };

    ////////////////////////////////////////////////
    // Ctrl+S保存调用
    OnPluginSaveMDEditor = function () {
        if (wizVerisonGreaterThan45) {
            if (modified && wantSaveKey && wantSaveTime) {
                wantSaveKey = false;
                var closeTime = new Date();
                var spanTime = closeTime.getTime() - wantSaveTime.getTime();
                if (spanTime < 800) { // 间隔太短表示快捷键保存的
                    saveDocument();
                }
            }
        }
        else {
            saveDocument();
        }
    };

    ////////////////////////////////////////////////
    // 关闭标签前的事件
    OnBeforeCloseTabMDEditor = function () {
    };

    ////////////////////////////////////////////////
    // 处理带图片内容
    function dealImgDoc(doc) {
        var arrImgTags = "";

        function dealImg(imgSrc) {
            var result = saveImageToLocal(imgSrc);
            arrImgTags += result[1];
            return result[0];
        }

        var imgReg = /(!\[[^\[]*?\]\()(.+?)(\s+['"][\s\S]*?['"])?(\))/g;
        doc = doc.replace(imgReg, function (whole, a, b, c, d) {
            if (c) {
                return a + dealImg(b) + c + d;
            } else {
                return a + dealImg(b) + d;
            }
        });

        var imgStrDiv = "";
        if (arrImgTags != "") {
            imgStrDiv = "<ed_tag name=\"markdownimage\" style=\"display:none;\">" + arrImgTags + "</ed_tag>";
        };
        return [doc, imgStrDiv];
    }

    ////////////////////////////////////////////////
    // 保存图片到本地临时目录
    // 返回新图片路径名和图片HTML标签内容
    function saveImageToLocal(filename) {
        filename = filename.replace(/\\/g, '/');
        var imgName = filename.substring(filename.lastIndexOf('/') + 1);
        var filenameNew = filename;
        var tagImg = "";

        var imgFullPath = "";
        if (filename.indexOf(filesDirName) == 0) {
            imgFullPath = filesFullPath + imgName;
        }
        else {
            imgFullPath = filename;
            if (imgFullPath.indexOf("file:///") == 0) {
                imgFullPath = imgFullPath.substring(8);
            }
        }

        if (imgFullPath != "") {
            if (objCommon.PathFileExists(imgFullPath)) {

                // 转换可能包含中文名的名称，转换成Unicode
                var imgNameNew = escape(imgName).replace(/%/g, '_');

                // 如果超过50个字符，则简短
                var extPos = imgNameNew.lastIndexOf('.');
                if (extPos == -1) {
                    extPos = imgNameNew.length;
                }
                var imgNameWithoutExt = imgNameNew.substring(0, extPos);
                var imgExt = imgNameNew.substring(extPos);
                if (imgNameNew.length > 50) {
                    imgNameWithoutExt = imgNameWithoutExt.substring(0, 35 - imgExt.length);
                    imgNameNew = imgNameWithoutExt + imgExt;
                }

                // 路径不同，则进行拷贝
                var imgCopyToFullPath = filesFullPath + imgNameNew;
                if (imgFullPath != imgCopyToFullPath) {

                    // 目标文件已经存在
                    if (objCommon.PathFileExists(imgCopyToFullPath)) {
                        var date = new Date();
                        imgNameNew = imgNameWithoutExt + date.getTime() + imgExt;
                        if (imgNameNew.length > 50) {
                            imgNameWithoutExt = imgNameWithoutExt.substring(0, 35 - imgExt.length);
                            imgNameNew = imgNameWithoutExt + date.getTime() + imgExt;
                        }
                        imgCopyToFullPath = filesFullPath + imgNameNew;
                    }

                    objCommon.CopyFile(imgFullPath, imgCopyToFullPath);
                }

                filenameNew = filesDirName + imgNameNew;
                tagImg = "<img src=\"" + imgCopyToFullPath + "\">";
            }
        }

        return [filenameNew, tagImg];
    }

    ////////////////////////////////////////////////
    // 获得保存到本地的图片
    function getSavedLocalImage(filename) {
        return saveImageToLocal(filename)[0];
    }

    ////////////////////////////////////////////////
    // 设置表情文件的地址
    function setEmojiFilePath() {
        editormd.emoji.path = pluginFullPath + "Editor.md/emoji/emojis/";
        editormd.twemoji.path = pluginFullPath + "Editor.md/emoji/twemoji/36x36/";
    }

    ////////////////////////////////////////////////
    // 加载文档
    function loadDocument() {
        var guid = getQueryString("guid", location.href);
        var kbGUID = getQueryString("kbguid", location.href);

        if (kbGUID == "" || kbGUID == null) {
            objDatabase = objApp.Database;
        }
        else {
            objDatabase = objApp.GetGroupDatabase(kbGUID);
        }

        var code = "";
        try {
            objDocument = objDatabase.DocumentFromGUID(guid);
            docTitle = objDocument.Title;
            document.title = "编辑 " + objDocument.Title.replace(new RegExp(".md", "gi"), "");

            var content = objDocument.GetHtml();
            var tempBody = document.body.innerHTML;
            document.body.innerHTML = content;

            var imgs = document.body.getElementsByTagName('img');
            if (imgs.length) {
                for (var i = imgs.length - 1; i >= 0; i--) {
                    var pi = imgs[i];
                    if (pi && pi.parentNode.getAttribute("name") != "markdownimage") {
                        var imgmd = document.createTextNode("![](" + pi.getAttribute("src") + ")");
                        $(pi).replaceWith(imgmd);
                    }
                }
            }

            var links = document.body.getElementsByTagName('a');
            if (links.length) {
                for (var i = links.length - 1; i >= 0; i--) {
                    var pi = links[i];
                    if (pi && pi.getAttribute("href").indexOf("wiz://open_") != -1) {
                        var linkmd = document.createTextNode("[" + pi.textContent + "](" + pi.getAttribute("href") + ")");
                        $(pi).replaceWith(linkmd);
                    }
                }
            }

            content = document.body.innerText;
            document.body.innerHTML = tempBody;
            code = content;

            /*code = objDocument.GetText(0);*/
            code = code.replace(/\u00a0/g, ' ');

            // 如果用原生编辑器保存过图片，会被替换成错的图片路径
            var imgErrorPath = guid + "_128_files/";
            code = code.replace(new RegExp(imgErrorPath, "g"), filesDirName);
        }
        catch (err) {
        }

        return code;
    };

    ////////////////////////////////////////////////
    // 得到本地文件路径
    function getLocalFilesPath() {
        var htmlName = document.location.href;
        var htmlPath = htmlName.substring(0, htmlName.lastIndexOf('/') + 1);
        var htmlWinPath = htmlPath.substring(8);
        return decodeURI(htmlWinPath + filesDirName);
    }

    ////////////////////////////////////////////////
    // 解析参数
    function getQueryString(name, hrefValue) {
        if (hrefValue.indexOf("?") == -1 || hrefValue.indexOf(name + '=') == -1) {
            return '';
        }
        var queryString = hrefValue.substring(hrefValue.indexOf("?") + 1);

        var parameters = queryString.split("&");

        var pos, paraName, paraValue;
        for (var i = 0; i < parameters.length; i++) {
            pos = parameters[i].indexOf('=');
            if (pos == -1) { continue; }

            paraName = parameters[i].substring(0, pos);
            paraValue = parameters[i].substring(pos + 1);

            if (paraName == name) {
                return unescape(paraValue.replace(/\+/g, " "));
            }
        }
        return '';
    };

    ////////////////////////////////////////////////
    // 打开新文档
    function openOtherDocument(hrefValue) {
        var guid = getQueryString("guid", hrefValue);
        if (guid == "") {
            return true;
        }

        var kbGUID = getQueryString("kbguid", hrefValue);
        var newDatabase = null

        if (kbGUID == "" || kbGUID == null) {
            newDatabase = objApp.Database;
        }
        else {
            newDatabase = objApp.GetGroupDatabase(kbGUID);
        }
        var isAttachment = hrefValue.indexOf("wiz://open_attachment") != -1;

        try {
            if (isAttachment) {
                var newAttachment = newDatabase.AttachmentFromGUID(guid);
                objCommon.RunExe("explorer", newAttachment.FileName, false);
            }
            else {
                var newDocument = newDatabase.DocumentFromGUID(guid);
                objApp.Window.ViewDocument(newDocument, true);
            }
            return false;
        }
        catch (err) {
        }

        return true;
    };

    ////////////////////////////////////////////////
    // 用默认浏览器打开链接
    function openHrefInBrowser(hrefValue) {
        if (optionSettings.HrefInBrowser == "1") {
            try {
                objCommon.RunExe("explorer", '\"' + hrefValue + '\"', false);
                return false;
            }
            catch (err) {
            }
        }

        return true;
    };
});

////////////////////////////////////////////////
// 预防页面被跳转丢失编辑
window.onbeforeunload = function () {
    if (modified) {
        modified = false;
        if (6 == objApp.Window.ShowMessage("是否将更改保存到 " + docTitle + " ？", "{p}", 0x04 + 0x20)) {
            saveDocument();
        }
    }
};

////////////////////////////////////////////////
// 为知回调
// 关闭标签时会调用来判断是否需要保存
function OnPluginQueryModified() {
    var modifiedTemp = modified;
    modified = false; // 防止再次调用window.onbeforeunload
    return modifiedTemp;
};

////////////////////////////////////////////////
// 为知回调
// 可响应Ctrl+S保存事件
function OnPluginSave() {
    OnPluginSaveMDEditor();
    return true;
};

////////////////////////////////////////////////
// 关闭标签前的事件
function onBeforeCloseTab_MDEditor() {
    OnBeforeCloseTabMDEditor();
}