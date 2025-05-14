"use strict";

// derived from https://github.com/mathiasbynens/String.fromCodePoint
/*! http://mths.be/fromcodepoint v0.2.1 by @mathias */
// unicode点
var _fromCodePoint;

export default function fromCodePoint(_) {
    return _fromCodePoint(_);
}
// 检测浏览器是否有该方法（该方法用于将Unicode码点转为字符）
if (String.fromCodePoint) { 
    // 若有则调用该方法
    _fromCodePoint = function(_) {
        try {
            // 尝试直接调用该方法
            return String.fromCodePoint(_);
        } catch (e) {
            // 若报错为范围错误
            if (e instanceof RangeError) {
                // 返回替代字符（菱形问号）
                return String.fromCharCode(0xfffd);
            }
            // 其他异常则直接抛出
            throw e;
        }
    };
    // 如果浏览器没有该方法则实现一个
} else {
    var stringFromCharCode = String.fromCharCode;
    var floor = Math.floor;
    _fromCodePoint = function() {
        var MAX_SIZE = 0x4000;
        var codeUnits = [];
        var highSurrogate;
        var lowSurrogate;
        var index = -1;
        var length = arguments.length;
        // 如果参数为空，则返回空串
        if (!length) {
            return "";
        }
        var result = "";
        while (++index < length) {
            var codePoint = Number(arguments[index]);
            // 判断是否为合法的Unicode码点
            if (
                !isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity` 是否为有限的数值
                codePoint < 0 || // 码点不会小于0
                codePoint > 0x10ffff || // 码点也不会过大
                floor(codePoint) !== codePoint // not an integer
            ) {
                // 不合法就返回替代字符
                return String.fromCharCode(0xfffd);
            }
            // 如果为基础平面码点
            if (codePoint <= 0xffff) {
                // BMP code point
                codeUnits.push(codePoint);
            } else {
                // Astral code point; split in surrogate halves
                // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                codePoint -= 0x10000;
                highSurrogate = (codePoint >> 10) + 0xd800;
                lowSurrogate = (codePoint % 0x400) + 0xdc00;
                codeUnits.push(highSurrogate, lowSurrogate);
            }
            if (index + 1 === length || codeUnits.length > MAX_SIZE) {
                result += stringFromCharCode.apply(null, codeUnits);
                codeUnits.length = 0;
            }
        }
        return result;
    };
}
