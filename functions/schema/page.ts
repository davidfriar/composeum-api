import { Item } from "./item"

export interface Page {
  children?: Page[]
  content: Item
  path: string
  lastModified: Date
}
