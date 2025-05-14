"use strict";
// 骆驼刺的根系发达，意味着其根系在地下向四面八方伸展、延伸，不同的根须之间可能相互连接、交织，从而形成一个庞大而复杂的根系网络。
// 将 markdown 笔记工具取名为 Alhagi（骆驼刺），类比的是其在笔记关联方面的特点。markdown 笔记中，不同的笔记内容、知识点等可以通过各种方式（如链接、标签等）相互关联起来，就如同骆驼刺发达的根系一样，不同的笔记之间建立起丰富的联系，形成一个知识网络，方便用户在笔记中进行信息的梳理、查找和拓展，体现出其在知识管理和关联方面的高效性和灵活性。
import encode from "mdurl/encode.js";
import { decodeHTMLStrict } from "entities";
// Unicode 斜杠
var C_BACKSLASH = 92;
// 匹配 HTML 实体（如 &amp;、&#x26;、&#38; 等）。
var ENTITY = "&(?:#x[a-f0-9]{1,6}|#[0-9]{1,7}|[a-z][a-z0-9]{1,31});";
// 标签名
var TAGNAME = "[A-Za-z][A-Za-z0-9-]*";
// 属性名
var ATTRIBUTENAME = "[a-zA-Z_:][a-zA-Z0-9:._-]*";
// 未被括号括住的值 （不允许包含引号、等号、尖括号、反引号和控制字符）。
var UNQUOTEDVALUE = "[^\"'=<>`\\x00-\\x20]+";
// 单引号中能包含的值
var SINGLEQUOTEDVALUE = "'[^']*'";
// 双引号中能包含的值
var DOUBLEQUOTEDVALUE = '"[^"]*"';
// 属性值 未加引号、单引号包围、双引号包围）
var ATTRIBUTEVALUE =
    "(?:" +
    UNQUOTEDVALUE +
    "|" +
    SINGLEQUOTEDVALUE +
    "|" +
    DOUBLEQUOTEDVALUE +
    ")";
// 属性值声明
var ATTRIBUTEVALUESPEC = "(?:" + "\\s*=" + "\\s*" + ATTRIBUTEVALUE + ")";
// 属性
var ATTRIBUTE = "(?:" + "\\s+" + ATTRIBUTENAME + ATTRIBUTEVALUESPEC + "?)";
// 起始标签
var OPENTAG = "<" + TAGNAME + ATTRIBUTE + "*" + "\\s*/?>";
// 结束标签
var CLOSETAG = "</" + TAGNAME + "\\s*[>]";
// 注释
var HTMLCOMMENT = "<!-->|<!--->|<!--[\\s\\S]*?-->"
// 处理指令
var PROCESSINGINSTRUCTION = "[<][?][\\s\\S]*?[?][>]";
// 声明
var DECLARATION = "<![A-Za-z]+" + "[^>]*>";
// CDATA
var CDATA = "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>";
// HTML标签（所有可能的情况,开头标识意为为非捕获组）
var HTMLTAG =
    "(?:" +
    OPENTAG +
    "|" +
    CLOSETAG +
    "|" +
    HTMLCOMMENT +
    "|" +
    PROCESSINGINSTRUCTION +
    "|" +
    DECLARATION +
    "|" +
    CDATA +
    ")";
// 正则对象，Html标签，^表示行开头，如果该字符在捕获组内，则表示排除 
var reHtmlTag = new RegExp("^" + HTMLTAG);
// 匹配反斜杠和&
var reBackslashOrAmp = /[\\&]/;
// 可被斜杠转义的字符
var ESCAPABLE = "[!\"#$%&'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]";
// 正则对象：斜杠转义字符或者html实体
var reEntityOrEscapedChar = new RegExp("\\\\" + ESCAPABLE + "|" + ENTITY, "gi");
// xml中的特殊字符
var XMLSPECIAL = '[&<>"]';
// 正则对象：xml中的特殊字符
var reXmlSpecial = new RegExp(XMLSPECIAL, "g");


// Replace entities and backslash escapes with literal characters.
// 将斜杠转义字符或者html实体转为实际字符
var unescapeString = function(s) {
    if (reBackslashOrAmp.test(s)) {
        return s.replace(reEntityOrEscapedChar, unescapeChar);
    } else {
        return s;
    }
};
// 将斜杠转义后的字符和html实体转为实际字符
var unescapeChar = function(s) {
    if (s.charCodeAt(0) === C_BACKSLASH) {
        // 去掉斜杠
        return s.charAt(1);
    } else {
        // 处理实体 
        return decodeHTMLStrict(s);
    }
};
// 编码URI
var normalizeURI = function(uri) {
    try {
        return encode(uri);
    } catch (err) {
        return uri;
    }
};

// 转义XML中的特殊字符
var escapeXml = function(s) {
    if (reXmlSpecial.test(s)) {
        return s.replace(reXmlSpecial, replaceUnsafeChar);
    } else {
        return s;
    }
};
// 替换XML中的特殊字符
var replaceUnsafeChar = function(s) {
    switch (s) {
        case "&":
            return "&amp;";
        case "<":
            return "&lt;";
        case ">":
            return "&gt;";
        case '"':
            return "&quot;";
        default:
            return s;
    }
};
export {
    unescapeString,
    normalizeURI,
    escapeXml,
    reHtmlTag,
    OPENTAG,
    CLOSETAG,
    ENTITY,
    ESCAPABLE
};
