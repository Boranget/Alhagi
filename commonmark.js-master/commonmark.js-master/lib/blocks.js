"use strict";

import Node from "./node.js";
import { unescapeString, OPENTAG, CLOSETAG } from "./common.js";
import InlineParser from "./inlines.js";

// 缩进
var CODE_INDENT = 4;

// TAB符号
var C_TAB = 9;
// 换行符号
var C_NEWLINE = 10;
// 大于符号>
var C_GREATERTHAN = 62;
// 小于符号<
var C_LESSTHAN = 60;
// 空格符号
var C_SPACE = 32;
// 左方括号[
var C_OPEN_BRACKET = 91;

// 匹配HTML块的开头
var reHtmlBlockOpen = [
    /./, // dummy for 0
    /^<(?:script|pre|textarea|style)(?:\s|>|$)/i,
    /^<!--/,
    /^<[?]/,
    /^<![A-Za-z]/,
    /^<!\[CDATA\[/,
    /^<[/]?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[123456]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|search|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|[/]?[>]|$)/i,
    new RegExp("^(?:" + OPENTAG + "|" + CLOSETAG + ")\\s*$", "i")
];

// 匹配 HTML 块的结尾
var reHtmlBlockClose = [
    /./, // dummy for 0
    /<\/(?:script|pre|textarea|style)>/i,
    /-->/,
    /\?>/,
    />/,
    /\]\]>/
];

// 匹配分割线
var reThematicBreak = /^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$|^(?:-[ \t]*){3,}$/;

// 匹配可能表示块开始的字符
var reMaybeSpecial = /^[#`~*+_=<>0-9-]/;

// 匹配非空白字符 \v为垂直制表符，\f为换页符
var reNonSpace = /[^ \t\f\v\r\n]/;

// 匹配无需列表开头标记 
var reBulletListMarker = /^[*+-]/;

// 匹配有序列表开头标记
var reOrderedListMarker = /^(\d{1,9})([.)])/;

// 匹配 ATX 标题标记
var reATXHeadingMarker = /^#{1,6}(?:[ \t]+|$)/;

// 匹配围栏代码块
var reCodeFence = /^`{3,}(?!.*`)|^~{3,}/;

// 匹配围栏代码块的结束标记
var reClosingCodeFence = /^(?:`{3,}|~{3,})(?=[ \t]*$)/;

// 匹配 SETEXT 标题标记（被动标题）
var reSetextHeadingLine = /^(?:=+|-+)[ \t]*$/;

// 匹配行结束符
var reLineEnding = /\r\n|\n|\r/;

// Returns true if string contains only space characters.
// 纯空白字符
var isBlank = function(s) {
    return !reNonSpace.test(s);
};

// 判断是空格还是否是制表符
var isSpaceOrTab = function(c) {
    return c === C_SPACE || c === C_TAB;
};

// 传入一个字符串，返回字符串的charCodeAt(pos)
var peek = function(ln, pos) {
    if (pos < ln.length) {
        return ln.charCodeAt(pos);
    } else {
        return -1;
    }
};

// DOC PARSER

// These are methods of a Parser object, defined below.

// Returns true if block ends with a blank line.
// 判断当前块后是否跟一个空行块
var endsWithBlankLine = function(block) {
    // 如果当前非最后的块
    return block.next &&
        // 当前块的结束行号
        block.sourcepos[1][0] 
        !== 
        // 下一个块的起始行号
        block.next.sourcepos[0][0] - 1;
};

// Add a line to the block at the tip.  We assume the tip
// can accept lines -- that check should be done before calling this.
// 将当前解析的行添加到当前块中，同时将其中的tab替换为空格
var addLine = function() {
    if (this.partiallyConsumedTab) {
        this.offset += 1; // skip over tab
        // add space characters:
        var charsToTab = 4 - (this.column % 4);
        this.tip._string_content += " ".repeat(charsToTab);
    }
    this.tip._string_content += this.currentLine.slice(this.offset) + "\n";
};

// Add block of type tag as a child of the tip.  If the tip can't
// accept children, close and finalize it and try its parent,
// and so on til we find a block that can accept children.
// 向当前块添加子节点
var addChild = function(tag, offset) {
    // 判断当前块是否可以添加当前类型块
    while (!this.blocks[this.tip.type].canContain(tag)) {
        // 不能则关闭当前块，移动指针
        this.finalize(this.tip, this.lineNumber - 1);
    }
    // 记录节点在文本中的位置
    var column_number = offset + 1; // offset 0 = column 1
    // 新建节点
    var newBlock = new Node(tag, [
        // 节点位置信息
        [this.lineNumber, column_number],
        [0, 0]
    ]);
    // 子节点的文本信息
    newBlock._string_content = "";
    // 将新建节点添加到当前节点中
    this.tip.appendChild(newBlock);
    // 将子节点设为当前节点
    this.tip = newBlock;
    return newBlock;
};

// Parse a list marker and return data on the marker (type,
// start, delimiter, bullet character, padding) or null.
// 解析列表标记
var parseListMarker = function(parser, container) {
    var rest = parser.currentLine.slice(parser.nextNonspace);
    var match;
    var nextc;
    var spacesStartCol;
    var spacesStartOffset;
    var data = {
        type: null, // 列表类型
        tight: true, // 是否紧凑
        bulletChar: null, // 无序列表标记
        start: null, // 列表起始数字
        delimiter: null, // 有序列表数字后的分隔符
        padding: null,// 列表项内容前的字符数
        markerOffset: parser.indent // 列表标记的缩进
    };
    // 缩进>=4，则认为是代码块
    if (parser.indent >= 4) {
        return null;
    }

    // 判断是否为无序列表
    if ((match = rest.match(reBulletListMarker))) {
        data.type = "bullet";
        data.bulletChar = match[0][0];
    // 判断是否为有序列表
    } else if (
        (match = rest.match(reOrderedListMarker)) &&
        // 当前容器不是段落，或者首序号为1
        (container.type !== "paragraph" || match[1] == 1)
    ) {
        data.type = "ordered";
        data.start = parseInt(match[1]);
        data.delimiter = match[2];
    } else {
        return null;
    }


    // make sure we have spaces after
    // 确保列表标记后有空格或者为空行（空列表项）
    nextc = peek(parser.currentLine, parser.nextNonspace + match[0].length);
    if (!(nextc === -1 || nextc === C_TAB || nextc === C_SPACE)) {
        return null;
    }

    // if it interrupts paragraph, make sure first line isn't blank
    // 如果当前容器为段落，则由于起始数字为一而成为列表
    // 空的列表项无法结束段落
    if (
        container.type === "paragraph" &&
        !parser.currentLine
            .slice(parser.nextNonspace + match[0].length)
            .match(reNonSpace)
    ) {
        return null;
    }

    // we've got a match! advance offset and calculate padding
    // 移动到列表内容部分
    parser.advanceNextNonspace(); // to start of marker
    // 按列移动到列表标记后
    parser.advanceOffset(match[0].length, true); // to end of marker
    // 获取列表标记列
    spacesStartCol = parser.column;
    // 获取列表标记偏移量
    spacesStartOffset = parser.offset;
    // 循环处理空格，如果空格达到5个，则前四个为一个列表标记的空格与缩进代码块的空格
    do {
        parser.advanceOffset(1, true);
        nextc = peek(parser.currentLine, parser.offset);
    } while (parser.column - spacesStartCol < 5 && isSpaceOrTab(nextc));
    // 当前行是否已经结束
    var blank_item = peek(parser.currentLine, parser.offset) === -1;
    // 计算列表标记后的空格（用于与当前解析空格比较）
    var spaces_after_marker = parser.column - spacesStartCol;
    // 如果当前列表项为缩进代码块，或者标记后没有空格，或者当前为空列表项
    if (spaces_after_marker >= 5 || spaces_after_marker < 1 || blank_item) {
        // padding设为列表标记长度加一
        data.padding = match[0].length + 1;
        parser.column = spacesStartCol;
        parser.offset = spacesStartOffset;
        if (isSpaceOrTab(peek(parser.currentLine, parser.offset))) {
            parser.advanceOffset(1, true);
        }
    } else {
    // 否则设置padding为列表标记长度加空格长度
        data.padding = match[0].length + spaces_after_marker;
    }
    return data;
};

// Returns true if the two list items are of the same type,
// with the same delimiter and bullet character.  This is used
// in agglomerating list items into lists.

// 判断列表项是否可加入已有列表（同种列表）
var listsMatch = function(list_data, item_data) {
    return (
        list_data.type === item_data.type &&
        list_data.delimiter === item_data.delimiter &&
        list_data.bulletChar === item_data.bulletChar
    );
};


// Finalize and close any unmatched blocks.
// 关闭未关闭的快
var closeUnmatchedBlocks = function() {
    if (!this.allClosed) {
        // finalize any blocks not matched
        while (this.oldtip !== this.lastMatchedContainer) {
            var parent = this.oldtip._parent;
            this.finalize(this.oldtip, this.lineNumber - 1);
            this.oldtip = parent;
        }
        this.allClosed = true;
    }
};

// Remove link reference definitions from given tree.
// 移除链接引用定义
var removeLinkReferenceDefinitions = function(parser, tree) {
    var event, node;
    var walker = tree.walker();
    var emptyNodes = [];

    while ((event = walker.next())) {
        node = event.node;
        // 进入段落节点，链接引用定义不能中断段落
        if (event.entering && node.type === "paragraph") {
            var pos;
            var hasReferenceDefs = false;

            // Try parsing the beginning as link reference definitions;
            // Note that link reference definitions must be the beginning of a
            // paragraph node since link reference definitions cannot interrupt
            // paragraphs.
            while (
                peek(node._string_content, 0) === C_OPEN_BRACKET &&
                    (pos = parser.inlineParser.parseReference(
                        node._string_content,
                        parser.refmap
                    ))
            ) {
                // 移除链接引用定义的文本内容
                const removedText = node._string_content.slice(0, pos);

                node._string_content = node._string_content.slice(pos);
                hasReferenceDefs = true;

                const lines = removedText.split("\n");

                // -1 for final newline.
                node.sourcepos[0][0] += lines.length - 1;
            }
            if (hasReferenceDefs && isBlank(node._string_content)) {
                emptyNodes.push(node);
            }
        }
    }
    // 移除空段落
    for (node of emptyNodes) {
        node.unlink();
    }
};

// 'finalize' is run when the block is closed.
// 'continue' is run to check whether the block is continuing
// at a certain line and offset (e.g. whether a block quote
// contains a `>`.  It returns 0 for matched, 1 for not matched,
// and 2 for "we've dealt with this line completely, go to next."
// 不同块的处理
// continue 方法：

// 用于判断当前块是否可以继续解析下一行。
// 返回值为 0 表示匹配成功，继续解析；1 表示匹配失败，停止解析；2 表示当前行已处理完毕，直接跳到下一行。
// finalize 方法：

// 在块关闭时调用，用于执行一些收尾工作，如清理数据、设置块的最终状态等。
// 例如，code_block 的 finalize 方法会将块的内容从字符串形式转换为字面量形式，并释放字符串内容以节省内存。
// canContain 方法：

// 用于判断当前块是否可以包含特定类型的子块。
// 例如，document 块可以包含除 item 之外的所有块类型，而 list 块只能包含 item 块。
// acceptsLines 属性：

// 表示当前块是否可以接受多行文本。
// 例如，paragraph 和 code_block 可以接受多行文本，而 heading 和 thematic_break 只能接受单行文本。
var blocks = {
    // 根块
    document: {
        continue: function() {
            return 0;
        },
        finalize: function(parser, block) {
            removeLinkReferenceDefinitions(parser, block);
            return;
        },
        canContain: function(t) {
            return t !== "item";
        },
        acceptsLines: false
    },
    // 列表 
    list: {
        continue: function() {
            return 0;
        },
        finalize: function(parser, block) {
            var item = block._firstChild;
            // 紧凑列表判断
            while (item) {
                // check for non-final list item ending with blank line:
                if (item._next && endsWithBlankLine(item)) {
                    block._listData.tight = false;
                    break;
                }
                // recurse into children of list item, to see if there are
                // spaces between any of them:
                // 子列表会影响父列表的紧凑吗？
                var subitem = item._firstChild;
                while (subitem) {
                    if (
                        subitem._next &&
                        endsWithBlankLine(subitem)
                    ) {
                        block._listData.tight = false;
                        break;
                    }
                    subitem = subitem._next;
                }
                item = item._next;
            }
            block.sourcepos[1] = block._lastChild.sourcepos[1];
        },
        canContain: function(t) {
            return t === "item";
        },
        acceptsLines: false
    },
    // 引用块
    block_quote: {
        continue: function(parser) {
            var ln = parser.currentLine;
            if (
                !parser.indented &&
                peek(ln, parser.nextNonspace) === C_GREATERTHAN
            ) {
                parser.advanceNextNonspace();
                parser.advanceOffset(1, false);
                if (isSpaceOrTab(peek(ln, parser.offset))) {
                    parser.advanceOffset(1, true);
                }
            } else {
                return 1;
            }
            return 0;
        },
        finalize: function() {
            return;
        },
        canContain: function(t) {
            return t !== "item";
        },
        acceptsLines: false
    },
    // 列表项
    item: {
        continue: function(parser, container) {
            // 如果是空行
            if (parser.blank) {
                // 若为第一个子节点
                if (container._firstChild == null) {
                    // Blank line after empty list item
                    // 则可以继续？
                    return 1;
                } else {
                    parser.advanceNextNonspace();
                }
            // 不是空行则
            // 若当前缩进大于列表的缩进，则生成了子列表
            } else if (
                parser.indent >=
                container._listData.markerOffset + container._listData.padding
            ) {
                parser.advanceOffset(
                    container._listData.markerOffset +
                        container._listData.padding,
                    true
                );
            } else {
                return 1;
            }
            return 0;
        },

        finalize: function(parser, block) {
            // 如果当前列表项有子节点
            if (block._lastChild) {
                // 将列表项的结束位置设为列表项的最后一个子节点的结束位置
                block.sourcepos[1] = block._lastChild.sourcepos[1];
            // 列表项没有子节点
            } else {
                // Empty list item
                block.sourcepos[1][0] = block.sourcepos[0][0];
                block.sourcepos[1][1] =
                    block._listData.markerOffset + block._listData.padding;
            }

            return;
        },

        canContain: function(t) {
            return t !== "item";
        },
        acceptsLines: false
    },
    // 标题
    heading: {
        continue: function() {
            // a heading can never container > 1 line, so fail to match:
            return 1;
        },
        finalize: function() {
            return;
        },
        canContain: function() {
            return false;
        },
        acceptsLines: false
    },
    // 分割线
    thematic_break: {
        continue: function() {
            // a thematic break can never container > 1 line, so fail to match:
            return 1;
        },
        finalize: function() {
            return;
        },
        canContain: function() {
            return false;
        },
        acceptsLines: false
    },
    // 代码块
    code_block: {
        continue: function(parser, container) {
            var ln = parser.currentLine;
            var indent = parser.indent;
            // 围栏代码块
            if (container._isFenced) {
                // fenced
                // 判断是否匹配到了结束围栏
                var match =
                    indent <= 3 &&
                    ln.charAt(parser.nextNonspace) === container._fenceChar &&
                    ln.slice(parser.nextNonspace).match(reClosingCodeFence);
                if (match && match[0].length >= container._fenceLength) {
                    // closing fence - we're at end of line, so we can return
                    parser.lastLineLength =
                        parser.offset + indent + match[0].length;
                    parser.finalize(container, parser.lineNumber);
                    return 2;
                // 如果结束围栏的长度小于起始围栏，则不结束，跳过围栏代码块的偏移量
                } else {
                    // skip optional spaces of fence offset
                    var i = container._fenceOffset;
                    while (i > 0 && isSpaceOrTab(peek(ln, parser.offset))) {
                        parser.advanceOffset(1, true);
                        i--;
                    }
                }
            // 缩进代码块
            } else {
                // indented
                if (indent >= CODE_INDENT) {
                    parser.advanceOffset(CODE_INDENT, true);
                } else if (parser.blank) {
                    parser.advanceNextNonspace();
                } else {
                    return 1;
                }
            }
            return 0;
        },
        finalize: function(parser, block) {
            if (block._isFenced) {
                // fenced
                // first line becomes info string
                var content = block._string_content;
                var newlinePos = content.indexOf("\n");
                var firstLine = content.slice(0, newlinePos);
                var rest = content.slice(newlinePos + 1);
                // 代码块信息
                block.info = unescapeString(firstLine.trim());
                block._literal = rest;
            } else {
                // indented
                var lines = block._string_content.split("\n");
                // Note that indented code block cannot be empty, so
                // lines.length cannot be zero.
                while (/^[ \t]*$/.test(lines[lines.length - 1])) {
                    lines.pop();
                }
                block._literal = lines.join("\n") + "\n";
                block.sourcepos[1][0] =
                    block.sourcepos[0][0] + lines.length - 1;
                block.sourcepos[1][1] =
                    block.sourcepos[0][1] + lines[lines.length - 1].length - 1;
            }
            block._string_content = null; // allow GC
        },
        canContain: function() {
            return false;
        },
        acceptsLines: true
    },
    // html块
    html_block: {
        continue: function(parser, container) {
            return parser.blank &&
            // 6和7都是以空行结束的html块
                (container._htmlBlockType === 6 ||
                    container._htmlBlockType === 7)
                ? 1
                : 0;
        },
        finalize: function(parser, block) {
            block._literal = block._string_content.replace(/\n$/, '');
            block._string_content = null; // allow GC
        },
        canContain: function() {
            return false;
        },
        acceptsLines: true
    },

    // 段落
    paragraph: {

        continue: function(parser) {
            // 空行不能
            return parser.blank ? 1 : 0;
        },
        finalize: function() {
            return;
        },
        canContain: function() {
            return false;
        },
        // 可包含多行
        acceptsLines: true
    }
};

// block start functions.  Return values:
// 0 = no match
// 1 容器
// 1 = matched container, keep going
// 2 叶子
// 2 = matched leaf, no more block starts
// 判断当前行是否为一个新块的开始
var blockStarts = [
    // block quote
    // 引用快
    function(parser) {
        if (
            // 没有缩进
            !parser.indented &&
            // 第一个字符是>
            peek(parser.currentLine, parser.nextNonspace) === C_GREATERTHAN
        ) {
            // 跳过>
            parser.advanceNextNonspace(); 
            parser.advanceOffset(1, false);
            // optional following space
            // 跳过一个可选的空格
            if (isSpaceOrTab(peek(parser.currentLine, parser.offset))) {
                parser.advanceOffset(1, true);
            }
            parser.closeUnmatchedBlocks();
            parser.addChild("block_quote", parser.nextNonspace);
            return 1;
        } else {
            return 0;
        }
    },

    // ATX heading
    // 主动标题
    function(parser) {
        var match;
        if (
            !parser.indented &&
            (match = parser.currentLine
                .slice(parser.nextNonspace)
                .match(reATXHeadingMarker))
        ) {
            // 跳过空格以及#
            parser.advanceNextNonspace();
            parser.advanceOffset(match[0].length, false);
            // 关闭已有的块
            parser.closeUnmatchedBlocks();
            var container = parser.addChild("heading", parser.nextNonspace);
            container.level = match[0].trim().length; // number of #s
            // remove trailing ###s:
            // 移除末尾的#
            container._string_content = parser.currentLine
                .slice(parser.offset)
                .replace(/^[ \t]*#+[ \t]*$/, "")
                .replace(/[ \t]+#+[ \t]*$/, "");
            parser.advanceOffset(parser.currentLine.length - parser.offset);
            return 2;
        } else {
            return 0;
        }
    },

  
    // HTML block
    // HTML 块
    function(parser, container) {
        if (
            !parser.indented &&
            // 第一个字符为<
            peek(parser.currentLine, parser.nextNonspace) === C_LESSTHAN
        ) {
            // 从第一个非空白字符开始的内容 
            var s = parser.currentLine.slice(parser.nextNonspace);
            var blockType;
            // 依次匹配七种 html块
            for (blockType = 1; blockType <= 7; blockType++) {
                if (
                    // 匹配到一种html
                    reHtmlBlockOpen[blockType].test(s) &&
                    // 类型小于7（前六种）或者当前块不是段落（第七种不能结束段落）
                    (blockType < 7 || (container.type !== "paragraph" &&
                    // 
                    !(
                        // 惰性段落
                        // 例如
                        // ===
                        // This is a paragraph
                        // <div>example</div>
                        !parser.allClosed && !parser.blank && parser.tip.type === "paragraph"
                    ) // maybe lazy
                    ))
                ) {
                    // 关闭所有未匹配的块
                    parser.closeUnmatchedBlocks();
                    // We don't adjust parser.offset;
                    // spaces are part of the HTML block:
                    var b = parser.addChild("html_block", parser.offset);
                    b._htmlBlockType = blockType;
                    return 2;
                }
            }
        }

        return 0;
    },

    // Setext heading
    // 被动标题
    function(parser, container) {
        var match; 
        if (
            // 不可有缩进
            !parser.indented &&
            // 当前块是段落，上一行为段落  
            container.type === "paragraph" &&
            // 当前行匹配到被动标题下划线结构
            (match = parser.currentLine
                .slice(parser.nextNonspace)
                .match(reSetextHeadingLine))
        ) {
            // 关闭未匹配的块
            parser.closeUnmatchedBlocks();
            // resolve reference link definitiosn
            var pos;
            // 处理内容
            while (
                // 如果内容中首个符号为方括号，可能存在链接引用
                peek(container._string_content, 0) === C_OPEN_BRACKET &&
                // 解析引用
                (pos = parser.inlineParser.parseReference(
                    container._string_content,
                    parser.refmap
                ))
            ) {
                container._string_content = container._string_content.slice(
                    pos
                );
            }
            // 如果存在内容
            if (container._string_content.length > 0) {
                var heading = new Node("heading", container.sourcepos);
                heading.level = match[0][0] === "=" ? 1 : 2;
                heading._string_content = container._string_content;
                container.insertAfter(heading);
                // 移除原本判断的段落
                container.unlink();
                parser.tip = heading;
                parser.advanceOffset(
                    parser.currentLine.length - parser.offset,
                    false
                );
                return 2;
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    },

    // thematic break
    // 分割线
    function(parser) {
        if (
            !parser.indented &&
            reThematicBreak.test(parser.currentLine.slice(parser.nextNonspace))
        ) {
            parser.closeUnmatchedBlocks();
            parser.addChild("thematic_break", parser.nextNonspace);
            parser.advanceOffset(
                parser.currentLine.length - parser.offset,
                false
            );
            return 2;
        } else {
            return 0;
        }
    },

    // list item
    // 列表项
    function(parser, container) {
        var data;
        // 解析列表项
        if (
            (!parser.indented || container.type === "list") &&
            (data = parseListMarker(parser, container))
        ) {
            parser.closeUnmatchedBlocks();

            // add the list if needed
            // 新建列表
            if (
                parser.tip.type !== "list" ||
                !listsMatch(container._listData, data)
            ) {
                container = parser.addChild("list", parser.nextNonspace);
                container._listData = data;
            }
            // 添加列表项
            // add the list item
            container = parser.addChild("item", parser.nextNonspace);
            container._listData = data;
            return 1;
        } else {
            return 0;
        }
    },

    // indented code block
    // 缩进代码块
    function(parser) {
        if (
            parser.indented &&
            parser.tip.type !== "paragraph" &&
            !parser.blank
        ) {
            // indented code
            // 检查偏移量
            parser.advanceOffset(CODE_INDENT, true);
            parser.closeUnmatchedBlocks();
            parser.addChild("code_block", parser.offset);
            return 2;
        } else {
            return 0;
        }
    },

      // Fenced code block
    // 围栏代码块
    function(parser) {
        var match;
        if (
            !parser.indented &&
            (match = parser.currentLine
                .slice(parser.nextNonspace)
                .match(reCodeFence))
        ) {
            // 围栏长度
            var fenceLength = match[0].length;
            parser.closeUnmatchedBlocks();
            // 添加一个围栏代码块
            var container = parser.addChild("code_block", parser.nextNonspace);
            container._isFenced = true;
            container._fenceLength = fenceLength;
            container._fenceChar = match[0][0];
            container._fenceOffset = parser.indent;
            parser.advanceNextNonspace();
            parser.advanceOffset(fenceLength, false);
            return 2;
        } else {
            return 0;
        }
    },

];
// 跳过列，主要需要判断tab符号造成的对齐问题
var advanceOffset = function(count, columns) {
    // 当前行
    var currentLine = this.currentLine;
    var charsToTab, charsToAdvance;
    var c;
    while (count > 0 && (c = currentLine[this.offset])) {
        // 如果当前为制表符
        if (c === "\t") {
            // 计算制表符要移动的剩余宽度，制表符的效果为对其到下一个四倍数的列
            // 计算一个tab符号会跳过几列
            charsToTab = 4 - (this.column % 4);
            // 如果按列移动
            if (columns) {
                // 判断tab跳过的宽度是否大于当前要移动的宽度
                this.partiallyConsumedTab = charsToTab > count;
                // tab跳过的宽度与count，取最小值
                charsToAdvance = charsToTab > count ? count : charsToTab;
                // 更新列号
                this.column += charsToAdvance;
                // 判断字符是否要继续向前
                this.offset += this.partiallyConsumedTab ? 0 : 1;
                count -= charsToAdvance;
            } else {
            // 不按列移动，而是按字符移动，此时tab直接对齐
                this.partiallyConsumedTab = false;
                this.column += charsToTab;
                this.offset += 1;
                count -= 1;
            }
        // 非制表符则列和字符一起跳过
        } else {
            this.partiallyConsumedTab = false;
            this.offset += 1;
            this.column += 1; // assume ascii; block starts are ascii
            count -= 1;
        }
    }
};
// 跳到下一个非空格
var advanceNextNonspace = function() {
    this.offset = this.nextNonspace;
    this.column = this.nextNonspaceColumn;
    this.partiallyConsumedTab = false;
};

var findNextNonspace = function() {
    var currentLine = this.currentLine;
    var i = this.offset;
    var cols = this.column;
    var c;

    while ((c = currentLine.charAt(i)) !== "") {
        if (c === " ") {
            i++;
            cols++;
        } else if (c === "\t") {
            i++;
            cols += 4 - (cols % 4);
        } else {
            break;
        }
    }
    // 跳过所有空格和tab后，下一个字符
    this.blank =
     c === "\n" || c === "\r" || c === "";
    this.nextNonspace = i;
    this.nextNonspaceColumn = cols;
    // 判断缩进长度
    this.indent = this.nextNonspaceColumn - this.column;
    // 判断是否大于代码块缩进
    this.indented = this.indent >= CODE_INDENT;
};

// Analyze a line of text and update the document appropriately.
// We parse markdown text by calling this on each line of input,
// then finalizing the document.
// 解析单独的一行
var incorporateLine = function(ln) {
    var all_matched = true;
    var t;
    // 从文档根节点开始
    var container = this.doc;
    this.oldtip = this.tip;
    this.offset = 0;
    this.column = 0;
    this.blank = false;
    this.partiallyConsumedTab = false;
    this.lineNumber += 1;
   
    // replace NUL characters for security
    // 先把解析不了的符号换成方块问号
    if (ln.indexOf("\u0000") !== -1) {
        ln = ln.replace(/\0/g, "\uFFFD");
    }

    this.currentLine = ln;

    // For each containing block, try to parse the associated line start.
    // Bail out on failure: container will point to the last matching block.
    // Set all_matched to false if not all containers match.
    var lastChild;
    // 深度遍历
    while ((lastChild = container._lastChild) && lastChild._open) {
        container = lastChild;

        this.findNextNonspace();

        switch (this.blocks[container.type].continue(this, container)) {
            case 0: // we've matched, keep going
                break;
            case 1: // we've failed to match a block
                all_matched = false;
                break;
            case 2: // 当前行处理完毕
            //  we've hit end of line for fenced code close and can return
                return;
            default:
                throw "continue returned illegal value, must be 0, 1, or 2";
        }
        if (!all_matched) {
            container = container._parent; // back up to last matching block
            break;
        }
    }

    this.allClosed = container === this.oldtip;
    this.lastMatchedContainer = container;

    // 当前块是否为叶子块
    var matchedLeaf =
        container.type !== "paragraph" && blocks[container.type].acceptsLines;
    var starts = this.blockStarts;
    var startsLen = starts.length;
    // Unless last matched container is a code block, try new container starts,
    // adding children to the last matched container:
    // 如果不是叶子块（是容器块）
    while (!matchedLeaf) {
        this.findNextNonspace();

        // this is a little performance optimization:
        if (
            // 如果当前行没代码缩进
            !this.indented &&
            // 不是特殊字符开始
            !reMaybeSpecial.test(ln.slice(this.nextNonspace))
        ) {
            this.advanceNextNonspace();
            break;
        }

        var i = 0;
        while (i < startsLen) {
            var res = starts[i](this, container);
            if (res === 1) {
                container = this.tip;
                break;
            } else if (res === 2) {
                container = this.tip;
                matchedLeaf = true;
                break;
            } else {
                i++;
            }
        }
        // 没有匹配到任何块
        if (i === startsLen) {
            // nothing matched
            this.advanceNextNonspace();
            break;
        }
    }

    // What remains at the offset is a text line.  Add the text to the
    // appropriate container.

    // First check for a lazy paragraph continuation: 
    if (!this.allClosed && !this.blank && this.tip.type === "paragraph") {
        // lazy paragraph continuation
        this.addLine();
    } else {
        // not a lazy continuation

        // finalize any blocks not matched
        this.closeUnmatchedBlocks();

        t = container.type;

        if (this.blocks[t].acceptsLines) {
            this.addLine();
            // if HtmlBlock, check for end condition
            // 如果是HTML块，检查是否满足结束条件
            if (
                t === "html_block" &&
                container._htmlBlockType >= 1 &&
                container._htmlBlockType <= 5 &&
                reHtmlBlockClose[container._htmlBlockType].test(
                    this.currentLine.slice(this.offset)
                )
            ) {
                this.lastLineLength = ln.length;
                this.finalize(container, this.lineNumber);
            }
        } else if (this.offset < ln.length && !this.blank) {
            // create paragraph container for line
            container = this.addChild("paragraph", this.offset);
            this.advanceNextNonspace();
            this.addLine();
        }
    }
    this.lastLineLength = ln.length;
};

// Finalize a block.  Close it and do any necessary postprocessing,
// e.g. creating string_content from strings, setting the 'tight'
// or 'loose' status of a list, and parsing the beginnings
// of paragraphs for reference definitions.  Reset the tip to the
// parent of the closed block.
var finalize = function(block, lineNumber) {
    var above = block._parent;
    block._open = false;
    block.sourcepos[1] = [lineNumber, this.lastLineLength];

    this.blocks[block.type].finalize(this, block);

    this.tip = above;
};

// Walk through a block & children recursively, parsing string content
// into inline content where appropriate.
var processInlines = function(block) {
    var node, event, t;
    var walker = block.walker();
    this.inlineParser.refmap = this.refmap;
    this.inlineParser.options = this.options;
    while ((event = walker.next())) {
        node = event.node;
        t = node.type;
        if (!event.entering && (t === "paragraph" || t === "heading")) {
            this.inlineParser.parse(node);
        }
    }
};

var Document = function() {
    var doc = new Node("document", [
        [1, 1],
        [0, 0]
    ]);
    return doc;
};

// The main parsing function.  Returns a parsed document AST.
var parse = function(input) {
    this.doc = new Document();
    this.tip = this.doc;
    this.refmap = {};
    this.lineNumber = 0;
    this.lastLineLength = 0;
    this.offset = 0;
    this.column = 0;
    this.lastMatchedContainer = this.doc;
    this.currentLine = "";
    if (this.options.time) {
        console.time("preparing input");
    }
    var lines = input.split(reLineEnding);
    var len = lines.length;
    if (input.charCodeAt(input.length - 1) === C_NEWLINE) {
        // ignore last blank line created by final newline
        len -= 1;
    }
    if (this.options.time) {
        console.timeEnd("preparing input");
    }
    if (this.options.time) {
        console.time("block parsing");
    }
    for (var i = 0; i < len; i++) {
        this.incorporateLine(lines[i]);
    }
    while (this.tip) {
        this.finalize(this.tip, len);
    }
    if (this.options.time) {
        console.timeEnd("block parsing");
    }
    if (this.options.time) {
        console.time("inline parsing");
    }
    this.processInlines(this.doc);
    if (this.options.time) {
        console.timeEnd("inline parsing");
    }
    return this.doc;
};

// The Parser object.
function Parser(options) {
    return {
        doc: new Document(),
        blocks: blocks,
        blockStarts: blockStarts,
        tip: this.doc,
        oldtip: this.doc,
        currentLine: "",
        lineNumber: 0,
        offset: 0,
        column: 0,
        nextNonspace: 0,
        nextNonspaceColumn: 0,
        indent: 0,
        indented: false,
        blank: false,
        partiallyConsumedTab: false,
        allClosed: true,
        lastMatchedContainer: this.doc,
        refmap: {},
        lastLineLength: 0,
        inlineParser: new InlineParser(options),
        findNextNonspace: findNextNonspace,
        advanceOffset: advanceOffset,
        advanceNextNonspace: advanceNextNonspace,
        addLine: addLine,
        addChild: addChild,
        incorporateLine: incorporateLine,
        finalize: finalize,
        processInlines: processInlines,
        closeUnmatchedBlocks: closeUnmatchedBlocks,
        parse: parse,
        options: options || {}
    };
}

export default Parser;
