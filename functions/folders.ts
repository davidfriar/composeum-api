type PathElement = string
type Path = PathElement[]

const DELIM = "/"

const parsePath = (s: string) => {
  return s.split(DELIM).filter((e) => e.length > 0)
}

export interface FolderItem<ItemType> {
  path: string
  item: ItemType
}

export class Folder<ItemType> {
  path: string
  folders: Folder<ItemType>[] | undefined
  items: ItemType[] | undefined
  #maxDepth: number

  constructor(path: string, maxDepth: number = 1) {
    this.path = path
    this.#maxDepth = maxDepth
  }

  addItems(items: FolderItem<ItemType>[]) {
    items.forEach((item) => this.addItem(item))
  }

  addItem(item: FolderItem<ItemType>) {
    if (!item.path.startsWith(this.path)) {
      throw Error("Cannot add an item to a folder if the prefix does not match")
    }
    const itemPath = parsePath(item.path)
    const folderPath = parsePath(this.path)
    const depth = itemPath.length - folderPath.length
    if (depth <= 0) {
      throw Error(
        "Cannot add an item to a folder unless the path is longer than the prefix"
      )
    }
    if (depth == 1) {
      if (!this.items) {
        this.items = []
      }
      this.items.push(item.item)
    } else {
      this.addToSubFolder(itemPath.slice(0, folderPath.length + 1), item)
    }
  }

  get allItems() {
    let results: Array<ItemType> = []
    if (this.items) {
      this.items.forEach((item) => results.push(item))
    }
    if (this.folders) {
      this.folders.forEach(
        (folder) => (results = results.concat(folder.allItems))
      )
    }
    return results
  }

  private addToSubFolder(path: Path, item: FolderItem<ItemType>) {
    const folder = this.getOrCreateSubFolder(path)
    if (this.#maxDepth > 1) {
      folder.addItem(item)
    }
  }

  findSubfolder(path: string): Folder<ItemType> | undefined {
    return this.folders?.find((folder) => {
      return folder.path === path
    })
  }

  private getOrCreateSubFolder(path: Path): Folder<ItemType> {
    const pathString = path.join(DELIM)
    if (!this.folders) {
      this.folders = []
    }
    let subFolder = this.findSubfolder(pathString)
    if (!subFolder) {
      subFolder = new Folder(pathString, this.#maxDepth - 1)
      this.folders.push(subFolder)
    }
    return subFolder
  }
}
