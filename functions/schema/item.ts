export type ComponentTypeName = string
export type ItemId = string
export type Property = string | number | boolean | object | Array<unknown>
export type Slot = Array<Item>

export interface Properties {
  [key: string]: Property
}

export interface Slots {
  [key: string]: Slot
}

export type Item = {
  itemId: ItemId
  componentType: ComponentTypeName
  properties: Properties
  slots?: Slots
}
