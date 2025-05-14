"use strict";

import Node from "./node.js";
import * as common from "./common.js";
import fromCodePoint from "./from-code-point.js";
import { decodeHTMLStrict } from "entities";

var normalizeURI = common.normalizeURI;
var unescapeString = common.unescapeString;

// Constants for character codes:
// 换行符
var C_NEWLINE = 10;
// 星号
var C_ASTERISK = 42;
// 下划线
var C_UNDERSCORE = 95;
// 反引号（code块）
var C_BACKTICK = 96;
// 开括号[
var C_OPEN_BRACKET = 91;
// 关闭括号]
var C_CLOSE_BRACKET = 93;
// <
var C_LESSTHAN = 60;
// !
var C_BANG = 33;
// \
var C_BACKSLASH = 92;
// &
var C_AMPERSAND = 38;
// 开括号(
var C_OPEN_PAREN = 40;
// 右括号)
var C_CLOSE_PAREN = 41;
// 冒号:
var C_COLON = 58;
// 单引号
var C_SINGLEQUOTE = 39;
// 双引号
var C_DOUBLEQUOTE = 34;

// Some regexps used in inline parser:
// 可被转义的字符
var ESCAPABLE = common.ESCAPABLE;
// 匹配一个反斜杠后面跟一个可被转义的字符
var ESCAPED_CHAR = "\\\\" + ESCAPABLE;
// HTML实体
var ENTITY = common.ENTITY;
// HTML实体正则表达式
var reHtmlTag = common.reHtmlTag;
// 匹配所有符号
var rePunctuation = new RegExp(
    /^[!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~\p{P}\p{S}]/u
);
// 匹配被双引号、单引号、圆括号包围的链接标题
var reLinkTitle = new RegExp(
    '^(?:"(' +
        ESCAPED_CHAR +
        "|\\\\[^\\\\]" +
        '|[^\\\\"\\x00])*"' +
        "|" +
        "'(" +
        ESCAPED_CHAR +
        "|\\\\[^\\\\]" +
        "|[^\\\\'\\x00])*'" +
        "|" +
        "\\((" +
        ESCAPED_CHAR +
        "|\\\\[^\\\\]" +
        "|[^\\\\()\\x00])*\\))"
);
// 匹配带有尖括号的链接定义
var reLinkDestinationBraces = /^(?:<(?:[^<>\n\\\x00]|\\.)*>)/;
// 匹配以可转义字符开头
var reEscapable = new RegExp("^" + ESCAPABLE);
// 匹配HMLL实体开头
var reEntityHere = new RegExp("^" + ENTITY, "i");
// 匹配一个或者多个反引号
var reTicks = /`+/;
// 匹配一个或者多个反引号开头
var reTicksHere = /^`+/;
// 匹配省略号（为什么要修改）（…）
var reEllipses = /\.\.\./g;
// 匹配一个或者多个连字符（-—）
var reDash = /--+/g;
// 匹配邮件类型的自动链接
var reEmailAutolink =
    /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;
// 匹配自动链接，忽略大小写
var reAutolink = /^<[A-Za-z][A-Za-z0-9.+-]{1,31}:[^<>\x00-\x20]*>/i;
// 多个空格开头跟一个换行再跟多个空格
var reSpnl = /^ *(?:\n *)?/;
// 空白字符
var reWhitespaceChar = /^[ \t\n\x0b\x0c\x0d]/;
// unicode空白字符
var reUnicodeWhitespaceChar = /^\s/;
// 行末空格
var reFinalSpace = / *$/;
// 行首空格
var reInitialSpace = /^ */;
// 空行或者只包含空格的行
var reSpaceAtEndOfLine = /^ *(?:\n|$)/;
// 匹配链接标签以 [ 开头、以 ] 结尾
// [^\\\[\]]:
// 匹配任何不是反斜杠 \、左方括号 [ 或右方括号 ] 的字符。
// \\.:
// 匹配反斜杠 \ 后跟任意字符（. 在这里是一个特殊字符，匹配除换行符之外的任何字符）。
// 这种字面量声明的正则表达式不需要对js进行转义
var reLinkLabel = /^\[(?:[^\\\[\]] \\.){0,1000}\]/s;
// 匹配普通字符：匹配不包含换行符 \n、反引号 `、方括号 []、反斜杠 \、感叹号 !、特殊字符 &、*、_、'、" 的字符串。
// Matches a string of non-special characters.
var reMain = /^[^\n`\[\]\\!<&*_'"]+/m;

// 构造纯文本类型的node
var text = function (s) {
    var node = new Node("text");
    node._literal = s;
    return node;
};

// normalize a reference in reference link (remove []s, trim,
// collapse internal space, unicode case fold.
// See commonmark/commonmark.js#168.
// 规范引用，去掉首位方括号与空格
var normalizeReference = function (string) {
    return string
        .slice(1, string.length - 1)
        .trim()
        .replace(/[ \t\r\n]+/g, " ")
        .toLowerCase()
        .toUpperCase();
};

// INLINE PARSER

// These are methods of an InlineParser object, defined below.
// An InlineParser keeps track of a subject (a string to be
// parsed) and a position in that subject.

// If re matches at current position in the subject, advance
// position in subject and return the match; otherwise return null.
// 使用正则逐个解析元素，如果匹配上了，则pos向后移动
var match = function (re) {
    var m = re.exec(this.subject.slice(this.pos));
    if (m === null) {
        return null;
    } else {
        this.pos += m.index + m[0].length;
        return m[0];
    }
};

// Returns the code for the character at the current subject position, or -1
// there are no more characters.
// This function must be non-BMP aware because the Unicode category of its result is used.
// 如果当前位置不到subject的长度
//
// ，则获取当前字符的代码点，
// pos 为当前读取的位置
var peek = function () {
    if (this.pos < this.subject.length) {
        return this.subject.codePointAt(this.pos);
    } else {
        return -1;
    }
};

// Parse zero or more space characters, including at most one newline
// 判断是否为空行
var spnl = function () {
    this.match(reSpnl);
    return true;
};

// All of the parsers below try to match something at the current position
// in the subject.  If they succeed in matching anything, they
// return the inline matched, advancing the subject.

// Attempt to parse backticks, adding either a backtick code span or a
// literal sequence of backticks.
// 解析反引号的代码段
var parseBackticks = function (block) {
    // 判断当前位置是否为反引号开头
    var ticks = this.match(reTicksHere);
    if (ticks === null) {
        return false;
    }
    // 记录当前位置（开头反引号后面的部分）
    var afterOpenTicks = this.pos;
    var matched;
    var node;
    var contents;
    // 循环匹配，寻找结束反引号
    while ((matched = this.match(reTicks)) !== null) {
        // 如果找到与开头匹配的反引号
        if (matched === ticks) {
            // 构造code节点
            node = new Node("code");
            // 设置content
            contents = this.subject
                .slice(afterOpenTicks, this.pos - ticks.length)
                // 换行替换为空格
                .replace(/\n/gm, " ");
            // 如果内容不为空且首尾部都有空格，则去掉首尾的一个空格
            if (
                contents.length > 0 &&
                contents.match(/[^ ]/) !== null &&
                contents[0] == " " &&
                contents[contents.length - 1] == " "
            ) {
                node._literal = contents.slice(1, contents.length - 1);
                // 否则content即为literal
            } else {
                node._literal = contents;
            }
            // 给block添加子节点
            block.appendChild(node);
            return true;
        }
    }
    // If we got here, we didn't match a closing backtick sequence.
    // 如果没有找到对应的反引号则回退
    this.pos = afterOpenTicks;
    // 则将反引号作为普通text节点加入子节点
    block.appendChild(text(ticks));
    return true;
};

// Parse a backslash-escaped special character, adding either the escaped
// character, a hard line break (if the backslash is followed by a newline),
// or a literal backslash to the block's children.  Assumes current character
// is a backslash.
// 解析反斜杠转义字符或者硬换行
var parseBackslash = function (block) {
    var subj = this.subject;
    var node;
    // 查看下一个字符（跳过反斜杠本身）
    this.pos += 1;
    // 如果下一个字符为换行
    if (this.peek() === C_NEWLINE) {
        this.pos += 1;
        node = new Node("linebreak");
        // 则添加硬换行节点
        block.appendChild(node);
        // 如果下一个字符为可被转义字符
    } else if (reEscapable.test(subj.charAt(this.pos))) {
        // 则添加text节点
        block.appendChild(text(subj.charAt(this.pos)));
        this.pos += 1;
        // 否则直接添加斜杠为text节点
    } else {
        block.appendChild(text("\\"));
    }
    return true;
};

// Attempt to parse an autolink (URL or email in pointy brackets).
// 解析自动链接
var parseAutolink = function (block) {
    var m;
    var dest;
    var node;
    // 如果匹配上邮箱类型的自动链接
    if ((m = this.match(reEmailAutolink))) {
        dest = m.slice(1, m.length - 1);
        node = new Node("link");
        // 添加mailto
        node._destination = normalizeURI("mailto:" + dest);
        node._title = "";
        // 给链接加text内容
        node.appendChild(text(dest));
        block.appendChild(node);
        return true;
        // 如果是其他类型
    } else if ((m = this.match(reAutolink))) {
        dest = m.slice(1, m.length - 1);
        node = new Node("link");
        node._destination = normalizeURI(dest);
        node._title = "";
        node.appendChild(text(dest));
        block.appendChild(node);
        return true;
    } else {
        return false;
    }
};

// Attempt to parse a raw HTML tag.
// 解析html标签
var parseHtmlTag = function (block) {
    var m = this.match(reHtmlTag);
    if (m === null) {
        return false;
    } else {
        var node = new Node("html_inline");
        node._literal = m;
        block.appendChild(node);
        return true;
    }
};

// Scan a sequence of characters with code cc, and return information about
// the number of delimiters and whether they are positioned such that
// they can open and/or close emphasis or strong emphasis.  A utility
// function for strong/emph parsing.
// 判断是否为强调或者强烈强调
// scanDelims 方法的作用是扫描 Markdown 中的强调符号（如 _ 或 *），
// 并判断这些符号是否可以作为强调或强调的开始或结束。它返回一个对象，包含以下信息：
// 符号的数量 (numdelims)。
// 是否可以作为强调的开始 (can_open)。
// 是否可以作为强调的结束 (can_close)。

var scanDelims = function (cc) {
    var numdelims = 0;
    var char_before, char_after, cc_after;
    var startpos = this.pos;
    var left_flanking, right_flanking, can_open, can_close;
    var after_is_whitespace,
        after_is_punctuation,  
        before_is_whitespace,
        before_is_punctuation;

    if (cc === C_SINGLEQUOTE || cc === C_DOUBLEQUOTE) {
        numdelims++;
        this.pos++;
    } else {
        while (this.peek() === cc) {
            numdelims++;
            this.pos++;
        }
    }

    if (numdelims === 0) {
        return null;
    }

    char_before = previousChar(this.subject, startpos);

    cc_after = this.peek();
    if (cc_after === -1) {
        char_after = "\n";
    } else {
        char_after = fromCodePoint(cc_after);
    }

    after_is_whitespace = reUnicodeWhitespaceChar.test(char_after);
    after_is_punctuation = rePunctuation.test(char_after);
    before_is_whitespace = reUnicodeWhitespaceChar.test(char_before);
    before_is_punctuation = rePunctuation.test(char_before);

    left_flanking =
        !after_is_whitespace &&
        (!after_is_punctuation ||
            before_is_whitespace ||
            before_is_punctuation);
    right_flanking =
        !before_is_whitespace &&
        (!before_is_punctuation || after_is_whitespace || after_is_punctuation);
    if (cc === C_UNDERSCORE) {
        can_open = left_flanking && (!right_flanking || before_is_punctuation);
        can_close = right_flanking && (!left_flanking || after_is_punctuation);
    } else if (cc === C_SINGLEQUOTE || cc === C_DOUBLEQUOTE) {
        can_open = left_flanking && !right_flanking;
        can_close = right_flanking;
    } else {
        can_open = left_flanking;
        can_close = right_flanking;
    }
    this.pos = startpos;
    return { numdelims: numdelims, can_open: can_open, can_close: can_close };
    // 获取前一个字符
    function previousChar(str, pos) {
        if (pos === 0) {
            return "\n";
        }
        var previous_cc = str.charCodeAt(pos - 1);
        // not low surrogate (BMP)
        if ((previous_cc & 0xfc00) !== 0xdc00) {
            return str.charAt(pos - 1);
        }
        // returns NaN if out of range
        var two_previous_cc = str.charCodeAt(pos - 2);
        // NaN & 0xfc00 = 0
        // checks if 2 previous char is high surrogate
        if ((two_previous_cc & 0xfc00) !== 0xd800) {
            return previous_char;
        }
        return str.slice(pos - 2, pos);
    }
};

// cc: 当前要处理的字符代码（例如 _ 或 * 的 Unicode 代码）。
// block: 当前正在构建的 AST 节点，表示 Markdown 文档的一部分。
// Handle a delimiter marker for emphasis or a quote.

var handleDelim = function (cc, block) {
    // 扫描是否为强调符号
    var res = this.scanDelims(cc);
    if (!res) {
        return false;
    }
    // 获取符号数量
    var numdelims = res.numdelims;
    var startpos = this.pos;
    var contents;
    // 跳到强调内容部分
    this.pos += numdelims;
    // 不清楚这里的cc为什么会是引号（这里是为了将引号处理为unicode引号使其更美观）
    // 如果为单引号
    if (cc === C_SINGLEQUOTE) {
        contents = "\u2019";
    // 如果为双引号
    } else if (cc === C_DOUBLEQUOTE) {
        contents = "\u201C";
    } else {
        contents = this.subject.slice(startpos, this.pos);
    }
    var node = text(contents);
    block.appendChild(node);

    // Add entry to stack for this opener
    if (
        (res.can_open || res.can_close) &&
        (this.options.smart || (cc !== C_SINGLEQUOTE && cc !== C_DOUBLEQUOTE))
    ) {
        this.delimiters = {
            cc: cc,
            numdelims: numdelims,
            origdelims: numdelims,
            node: node,
            previous: this.delimiters,
            next: null,
            can_open: res.
            can_open,
            can_close: res.can_close,
        };
        if (this.delimiters.previous !== null) {
            this.delimiters.previous.next = this.delimiters;
        }
    }

    return true;
};

// 移除分隔符并将前后元素连接
var removeDelimiter = function (delim) {
    if (delim.previous !== null) {
        delim.previous.next = delim.next;
    }
    if (delim.next === null) {
        // top of stack
        this.delimiters = delim.previous;
    } else {
        delim.next.previous = delim.previous;
    }
};
// 移除给定范围中间的分隔符
var removeDelimitersBetween = function (bottom, top) {
    if (bottom.next !== top) {
        bottom.next = top;
        top.previous = bottom;
    }
};

var processEmphasis = function (stack_bottom) {
    var opener, closer, old_closer;
    var opener_inl, closer_inl;
    var tempstack;
    var use_delims;
    var tmp, next;
    var opener_found;
    var openers_bottom = [];
    var openers_bottom_index;
    var odd_match = false;

    for (var i = 0; i < 14; i++) {
        openers_bottom[i] = stack_bottom;
    }
    // find first closer above stack_bottom:
    closer = this.delimiters;

    while (closer !== null && closer.previous !== stack_bottom) {
        closer = closer.previous;
    }
    // move forward, looking for closers, and handling each
    while (closer !== null) {
        var closercc = closer.cc;
        if (!closer.can_close) {
            closer = closer.next;
        } else {
            // found emphasis closer. now look back for first matching opener:
            opener = closer.previous;
            opener_found = false;
            // 这里不知道为什么要单双引号，理论上不需要
            switch (closercc) {
                case C_SINGLEQUOTE:
                    openers_bottom_index = 0;
                    break;
                case C_DOUBLEQUOTE:
                    openers_bottom_index = 1;
                    break;
                case C_UNDERSCORE:
                    openers_bottom_index =
                        2 + (closer.can_open ? 3 : 0) + (closer.origdelims % 3);
                    break;
                case C_ASTERISK:
                    openers_bottom_index =
                        8 + (closer.can_open ? 3 : 0) + (closer.origdelims % 3);
                    break;
            }
            while (
                opener !== null &&
                opener !== stack_bottom &&
                opener !== openers_bottom[openers_bottom_index]
            ) {
                odd_match =
                    (closer.can_open || opener.can_close) &&
                    closer.origdelims % 3 !== 0 &&
                    (opener.origdelims + closer.origdelims) % 3 === 0;
                if (opener.cc === closer.cc && opener.can_open && !odd_match) {
                    opener_found = true;
                    break;
                }
                opener = opener.previous;
            }
            old_closer = closer;

            if (closercc === C_ASTERISK || closercc === C_UNDERSCORE) {
                if (!opener_found) {
                    closer = closer.next;
                } else {
                    // calculate actual number of delimiters used from closer
                    use_delims =
                        closer.numdelims >= 2 && opener.numdelims >= 2 ? 2 : 1;

                    opener_inl = opener.node;
                    closer_inl = closer.node;

                    // remove used delimiters from stack elts and inlines
                    opener.numdelims -= use_delims;
                    closer.numdelims -= use_delims;
                    opener_inl._literal = opener_inl._literal.slice(
                        0,
                        opener_inl._literal.length - use_delims
                    );
                    closer_inl._literal = closer_inl._literal.slice(
                        0,
                        closer_inl._literal.length - use_delims
                    );

                    // build contents for new emph element
                    var emph = new Node(use_delims === 1 ? "emph" : "strong");

                    tmp = opener_inl._next;
                    while (tmp && tmp !== closer_inl) {
                        next = tmp._next;
                        tmp.unlink();
                        emph.appendChild(tmp);
                        tmp = next;
                    }

                    opener_inl.insertAfter(emph);

                    // remove elts between opener and closer in delimiters stack
                    removeDelimitersBetween(opener, closer);

                    // if opener has 0 delims, remove it and the inline
                    if (opener.numdelims === 0) {
                        opener_inl.unlink();
                        this.removeDelimiter(opener);
                    }

                    if (closer.numdelims === 0) {
                        closer_inl.unlink();
                        tempstack = closer.next;
                        this.removeDelimiter(closer);
                        closer = tempstack;
                    }
                }
            } else if (closercc === C_SINGLEQUOTE) {
                closer.node._literal = "\u2019";
                if (opener_found) {
                    opener.node._literal = "\u2018";
                }
                closer = closer.next;
            } else if (closercc === C_DOUBLEQUOTE) {
                closer.node._literal = "\u201D";
                if (opener_found) {
                    opener.node.literal = "\u201C";
                }
                closer = closer.next;
            }
            if (!opener_found) {
                // Set lower bound for future searches for openers:
                openers_bottom[openers_bottom_index] = old_closer.previous;
                if (!old_closer.can_open) {
                    // We can remove a closer that can't be an opener,
                    // once we've seen there's no matching opener:
                    this.removeDelimiter(old_closer);
                }
            }
        }
    }

    // remove all delimiters
    while (this.delimiters !== null && this.delimiters !== stack_bottom) {
        this.removeDelimiter(this.delimiters);
    }
};

// Attempt to parse link title (sans quotes), returning the string
// or null if no match.
// 匹配链接标题
var parseLinkTitle = function () {
    var title = this.match(reLinkTitle);
    if (title === null) {
        return null;
    } else {
        // chop off quotes from title and unescape:
        return unescapeString(title.slice(1, -1));
    }
};

// Attempt to parse link destination, returning the string or
// null if no match.
// 匹配链接目标
var parseLinkDestination = function () {
    var res = this.match(reLinkDestinationBraces);
    if (res === null) {
        if (this.peek() === C_LESSTHAN) {
            return null;
        }
        // TODO handrolled parser; res should be null or the string
        var savepos = this.pos;
        var openparens = 0;
        var c;
        while ((c = this.peek()) !== -1) {
            if (
                c === C_BACKSLASH &&
                reEscapable.test(this.subject.charAt(this.pos + 1))
            ) {
                this.pos += 1;
                if (this.peek() !== -1) {
                    this.pos += 1;
                }
            } else if (c === C_OPEN_PAREN) {
                this.pos += 1;
                openparens += 1;
            } else if (c === C_CLOSE_PAREN) {
                if (openparens < 1) {
                    break;
                } else {
                    this.pos += 1;
                    openparens -= 1;
                }
            } else if (reWhitespaceChar.exec(fromCodePoint(c)) !== null) {
                break;
            } else {
                this.pos += 1;
            }
        }
        if (this.pos === savepos && c !== C_CLOSE_PAREN) {
            return null;
        }
        if (openparens !== 0) {
            return null;
        }
        res = this.subject.slice(savepos, this.pos);
        return normalizeURI(unescapeString(res));
    } else {
        // chop off surrounding <..>:
        return normalizeURI(unescapeString(res.slice(1, -1)));
    }
};

// Attempt to parse a link label, returning number of characters parsed.
// 匹配链接标签
var parseLinkLabel = function () {
    var m = this.match(reLinkLabel);
    if (m === null || m.length > 1001) {
        return 0;
    } else {
        return m.length;
    }
};

// Add open bracket to delimiter stack and add a text node to block's children.
// 添加左方括号文本节点
var parseOpenBracket = function (block) {
    var startpos = this.pos;
    this.pos += 1;

    var node = text("[");
    block.appendChild(node);

    // Add entry to stack for this opener
    this.addBracket(node, startpos, false);
    return true;
};

// IF next character is [, and ! delimiter to delimiter stack and
// add a text node to block's children.  Otherwise just add a text node.
// 判断叹号后是否跟左方括号并进行对应的处理
var parseBang = function (block) {
    var startpos = this.pos;
    this.pos += 1;
    if (this.peek() === C_OPEN_BRACKET) {
        this.pos += 1;

        var node = text("![");
        block.appendChild(node);

        // Add entry to stack for this opener
        this.addBracket(node, startpos + 1, true);
    } else {
        block.appendChild(text("!"));
    }
    return true;
};

// Try to match close bracket against an opening in the delimiter
// stack.  Add either a link or image, or a plain [ character,
// to block's children.  If there is a matching delimiter,
// remove it from the delimiter stack.
// 处理结束方括号，这应该是处理link or imgae
var parseCloseBracket = function (block) {
    var startpos;
    var is_image;
    var dest;
    var title;
    var matched = false;
    var reflabel;
    var opener;

    this.pos += 1;
    startpos = this.pos;

    // get last [ or ![
    opener = this.brackets;

    if (opener === null) {
        // no matched opener, just return a literal
        block.appendChild(text("]"));
        return true;
    }

    if (!opener.active) {
        // no matched opener, just return a literal
        block.appendChild(text("]"));
        // take opener off brackets stack
        this.removeBracket();
        return true;
    }

    // If we got here, open is a potential opener
    is_image = opener.image;

    // Check to see if we have a link/image

    var savepos = this.pos;

    // Inline link?
    if (this.peek() === C_OPEN_PAREN) {
        this.pos++;
        if (
            this.spnl() &&
            (dest = this.parseLinkDestination()) !== null &&
            this.spnl() &&
            // make sure there's a space before the title:
            ((reWhitespaceChar.test(this.subject.charAt(this.pos - 1)) &&
                (title = this.parseLinkTitle())) ||
                true) &&
            this.spnl() &&
            this.peek() === C_CLOSE_PAREN
        ) {
            this.pos += 1;
            matched = true;
        } else {
            this.pos = savepos;
        }
    }

    if (!matched) {
        // Next, see if there's a link label
        var beforelabel = this.pos;
        var n = this.parseLinkLabel();
        if (n > 2) {
            reflabel = this.subject.slice(beforelabel, beforelabel + n);
        } else if (!opener.bracketAfter) {
            // Empty or missing second label means to use the first label as the reference.
            // The reference must not contain a bracket. If we know there's a bracket, we don't even bother checking it.
            reflabel = this.subject.slice(opener.index, startpos);
        }
        if (n === 0) {
            // If shortcut reference link, rewind before spaces we skipped.
            this.pos = savepos;
        }

        if (reflabel) {
            // lookup rawlabel in refmap
            var link = this.refmap[normalizeReference(reflabel)];
            if (link) {
                dest = link.destination;
                title = link.title;
                matched = true;
            }
        }
    }

    if (matched) {
        var node = new Node(is_image ? "image" : "link");
        node._destination = dest;
        node._title = title || "";

        var tmp, next;
        tmp = opener.node._next;
        while (tmp) {
            next = tmp._next;
            tmp.unlink();
            node.appendChild(tmp);
            tmp = next;
        }
        block.appendChild(node);
        this.processEmphasis(opener.previousDelimiter);
        this.removeBracket();
        opener.node.unlink();

        // We remove this bracket and processEmphasis will remove later delimiters.
        // Now, for a link, we also deactivate earlier link openers.
        // (no links in links)
        if (!is_image) {
            opener = this.brackets;
            while (opener !== null) {
                if (!opener.image) {
                    opener.active = false; // deactivate this opener
                }
                opener = opener.previous;
            }
        }

        return true;
    } else {
        // no match

        this.removeBracket(); // remove this opener from stack
        this.pos = startpos;
        block.appendChild(text("]"));
        return true;
    }
};

var addBracket = function (node, index, image) {
    if (this.brackets !== null) {
        this.brackets.bracketAfter = true;
    }
    this.brackets = {
        node: node,
        previous: this.brackets,
        previousDelimiter: this.delimiters,
        index: index,
        image: image,
        active: true,
    };
};

var removeBracket = function () {
    this.brackets = this.brackets.previous;
};

// 解析HTML实体
// Attempt to parse an entity.
var parseEntity = function (block) {
    var m;
    if ((m = this.match(reEntityHere))) {
        block.appendChild(text(decodeHTMLStrict(m)));
        return true;
    } else {
        return false;
    }
};

// Parse a run of ordinary characters, or a single character with
// a special meaning in markdown, as a plain string.
// 处理string

var parseString = function (block) {
    var m;
    if ((m = this.match(reMain))) {
        // 替换字符，将一些字符变得美观
        if (this.options.smart) {
            block.appendChild(
                text(
                    m
                        .replace(reEllipses, "\u2026")
                        .replace(reDash, function (chars) {
                            var enCount = 0;
                            var emCount = 0;
                            if (chars.length % 3 === 0) {
                                // If divisible by 3, use all em dashes
                                emCount = chars.length / 3;
                            } else if (chars.length % 2 === 0) {
                                // If divisible by 2, use all en dashes
                                enCount = chars.length / 2;
                            } else if (chars.length % 3 === 2) {
                                // If 2 extra dashes, use en dash for last 2; em dashes for rest
                                enCount = 1;
                                emCount = (chars.length - 2) / 3;
                            } else {
                                // Use en dashes for last 4 hyphens; em dashes for rest
                                enCount = 2;
                                emCount = (chars.length - 4) / 3;
                            }
                            return (
                                "\u2014".repeat(emCount) +
                                "\u2013".repeat(enCount)
                            );
                        })
                )
            );
        } else {
            block.appendChild(text(m));
        }
        return true;
    } else {
        return false;
    }
};

// Parse a newline.  If it was preceded by two spaces, return a hard line break; otherwise a soft line break.
// 处理换行

var parseNewline = function (block) {
    this.pos += 1; // assume we're at a \n
    // check previous node for trailing spaces
    var lastc = block._lastChild;
    if (
        lastc &&
        lastc.type === "text" &&
        lastc._literal[lastc._literal.length - 1] === " "
    ) {
        var hardbreak = lastc._literal[lastc._literal.length - 2] === " ";
        lastc._literal = lastc._literal.replace(reFinalSpace, "");
        block.appendChild(new Node(hardbreak ? "linebreak" : "softbreak"));
    } else {
        block.appendChild(new Node("softbreak"));
    }
    this.match(reInitialSpace); // gobble leading spaces in next line
    return true;
};

// Attempt to parse a link reference, modifying refmap.
// 解析链接引用，并存到map中
var parseReference = function (s, refmap) {
    this.subject = s;
    this.pos = 0;
    var rawlabel;
    var dest;
    var title;
    var matchChars;
    var startpos = this.pos;

    // label:
    matchChars = this.parseLinkLabel();
    if (matchChars === 0) {
        return 0;
    } else {
        rawlabel = this.subject.slice(0, matchChars);
    }

    // colon:
    if (this.peek() === C_COLON) {
        this.pos++;
    } else {
        this.pos = startpos;
        return 0;
    }

    //  link url
    this.spnl();

    dest = this.parseLinkDestination();
    if (dest === null) {
        this.pos = startpos;
        return 0;
    }

    var beforetitle = this.pos;
    this.spnl();
    if (this.pos !== beforetitle) {
        title = this.parseLinkTitle();
    }
    if (title === null) {
        // rewind before spaces
        this.pos = beforetitle;
    }

    // make sure we're at line end:
    var atLineEnd = true;
    if (this.match(reSpaceAtEndOfLine) === null) {
        if (title === null) {
            atLineEnd = false;
        } else {
            // the potential title we found is not at the line end,
            // but it could still be a legal link reference if we
            // discard the title
            title = null;
            // rewind before spaces
            this.pos = beforetitle;
            // and instead check if the link URL is at the line end
            atLineEnd = this.match(reSpaceAtEndOfLine) !== null;
        }
    }

    if (!atLineEnd) {
        this.pos = startpos;
        return 0;
    }

    var normlabel = normalizeReference(rawlabel);
    if (normlabel === "") {
        // label must contain non-whitespace characters
        this.pos = startpos;
        return 0;
    }

    if (!refmap[normlabel]) {
        refmap[normlabel] = {
            destination: dest,
            title: title === null ? "" : title,
        };
    }
    return this.pos - startpos;
};

// Parse the next inline element in subject, advancing subject position.
// On success, add the result to block's children and return true.
// On failure, return false.
var parseInline = function (block) {
    var res = false;
    var c = this.peek();
    if (c === -1) {
        return false;
    }
    switch (c) {
        case C_NEWLINE:
            res = this.parseNewline(block);
            break;
        case C_BACKSLASH:
            res = this.parseBackslash(block);
            break;
        case C_BACKTICK:
            res = this.parseBackticks(block);
            break;
        case C_ASTERISK:
        case C_UNDERSCORE:
            res = this.handleDelim(c, block);
            break;
        case C_SINGLEQUOTE:
        case C_DOUBLEQUOTE:
            res = this.options.smart && this.handleDelim(c, block);
            break;
        case C_OPEN_BRACKET:
            res = this.parseOpenBracket(block);
            break;
        case C_BANG:
            res = this.parseBang(block);
            break;
        case C_CLOSE_BRACKET:
            res = this.parseCloseBracket(block);
            break;
        case C_LESSTHAN:
            res = this.parseAutolink(block) || this.parseHtmlTag(block);
            break;
        case C_AMPERSAND:
            res = this.parseEntity(block);
            break;
        default:
            res = this.parseString(block);
            break;
    }
    if (!res) {
        this.pos += 1;
        block.appendChild(text(fromCodePoint(c)));
    }

    return true;
};

// Parse string content in block into inline children,
// using refmap to resolve references.
var parseInlines = function (block) {
    // String.protoype.trim() removes non-ASCII whitespaces, vertical tab, form feed and so on.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim#return_value
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#white_space
    // Removes only ASCII tab and space.
    this.subject = trim(block._string_content);
    this.pos = 0;
    this.delimiters = null;
    this.brackets = null;
    while (this.parseInline(block)) {}
    block._string_content = null; // allow raw string to be garbage collected
    this.processEmphasis(null);

    function trim(str) {
        var start = 0;
        for (; start < str.length; start++) {
            if (!isSpace(str.charCodeAt(start))) {
                break;
            }
        }
        var end = str.length - 1;
        for (; end >= start; end--) {
            if (!isSpace(str.charCodeAt(end))) {
                break;
            }
        }
        return str.slice(start, end + 1);

        function isSpace(c) {
            // U+0020 = space, U+0009 = tab, U+000A = LF, U+000D = CR
            return c === 0x20 || c === 9 || c === 0xa || c === 0xd;
        }
    }
};

// The InlineParser object.
function InlineParser(options) {
    return {
        subject: "",
        delimiters: null, // used by handleDelim method
        brackets: null,
        pos: 0,
        refmap: {},
        match: match,
        peek: peek,
        spnl: spnl,
        parseBackticks: parseBackticks,
        parseBackslash: parseBackslash,
        parseAutolink: parseAutolink,
        parseHtmlTag: parseHtmlTag,
        scanDelims: scanDelims,
        handleDelim: handleDelim,
        parseLinkTitle: parseLinkTitle,
        parseLinkDestination: parseLinkDestination,
        parseLinkLabel: parseLinkLabel,
        parseOpenBracket: parseOpenBracket,
        parseBang: parseBang,
        parseCloseBracket: parseCloseBracket,
        addBracket: addBracket,
        removeBracket: removeBracket,
        parseEntity: parseEntity,
        parseString: parseString,
        parseNewline: parseNewline,
        parseReference: parseReference,
        parseInline: parseInline,
        processEmphasis: processEmphasis,
        removeDelimiter: removeDelimiter,
        options: options || {},
        parse: parseInlines,
    };
}

export default InlineParser;
