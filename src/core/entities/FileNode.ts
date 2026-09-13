export interface FileNodeProps {
  path: string
  name: string
  isDirectory: boolean
  children?: FileNodeProps[]
  isExpanded?: boolean
  size?: number
  lastModified?: number
}

export class FileNode {
  public path: string
  public name: string
  public isDirectory: boolean
  public children: FileNode[]
  public isExpanded: boolean
  public size?: number
  public lastModified?: number

  constructor(props: FileNodeProps) {
    this.path = props.path
    this.name = props.name
    this.isDirectory = props.isDirectory
    this.children = (props.children || []).map(c => new FileNode(c))
    this.isExpanded = props.isExpanded || false
    this.size = props.size
    this.lastModified = props.lastModified
  }

  static createFile(path: string, name: string, size?: number): FileNode {
    return new FileNode({
      path,
      name,
      isDirectory: false,
      size,
    })
  }

  static createDirectory(path: string, name: string, children: FileNodeProps[] = []): FileNode {
    return new FileNode({
      path,
      name,
      isDirectory: true,
      children,
    })
  }

  toggleExpanded(): void {
    if (this.isDirectory) {
      this.isExpanded = !this.isExpanded
    }
  }

  addChild(child: FileNode): void {
    if (this.isDirectory) {
      this.children.push(child)
    }
  }

  removeChild(childPath: string): void {
    if (this.isDirectory) {
      this.children = this.children.filter(child => child.path !== childPath)
    }
  }

  findChild(name: string): FileNode | undefined {
    return this.children.find(child => child.name === name)
  }

  findByPath(path: string): FileNode | undefined {
    if (this.path === path) {
      return this
    }

    for (const child of this.children) {
      const found = child.findByPath(path)
      if (found) {
        return found
      }
    }

    return undefined
  }

  flatten(): FileNode[] {
    const result: FileNode[] = [this]
    for (const child of this.children) {
      result.push(...child.flatten())
    }
    return result
  }

  toProps(): FileNodeProps {
    return {
      path: this.path,
      name: this.name,
      isDirectory: this.isDirectory,
      children: this.children.map(child => child.toProps()),
      isExpanded: this.isExpanded,
      size: this.size,
      lastModified: this.lastModified,
    }
  }
}
