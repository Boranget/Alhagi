/**
 * markdown 的块
 * 其中应该有块的类型、块的内容，块的开闭状态
 * 有的块应该还有子块，所以应该有个子块的列表
 * 至于每种块，应该各自开一个子类合适？
 */
export class Block{
    blockType;
    content;
    isOpen;
    children;
}