import { S3 } from "aws-sdk"
import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda"
import Ajv from "ajv"
import * as itemSchema from "./schema/item.json"
import { Page } from "./schema/page"
import { Item } from "./schema/item"
import { Folder, FolderItem } from "./folders"

const bucketName = process.env.BUCKET as string
const s3 = new S3()
const ajv = new Ajv()

const validateItemJson = ajv.compile(itemSchema)

export const main = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  try {
    switch (event.httpMethod) {
      case "GET":
        return await handleGet(event)
      case "PUT":
        return await handlePut(event)
      default:
        return await handleOther(event)
    }
  } catch (error) {
    return handleError(error)
  }
}

const handleError = (error: Error) => {
  return {
    statusCode: 400,
    headers: {},
    body: JSON.stringify({ name: error.name, message: error.message }, null, 2),
  }
}

const handlePut = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  const path = appendFileExtension(stripLeadingSlash(event.path))
  const json = validateItem(event.body, path)
  const result = await s3
    .putObject({ Bucket: bucketName, Key: path, Body: json })
    .promise()
  return {
    statusCode: 200,
    body: JSON.stringify(result),
  }
}

const handleOther = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 400,
    headers: {},
    body: `Unsupported method: ${event.httpMethod}`,
  }
}

const handleGet = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  const depth = getDepth(event)
  if (event.path.endsWith(".json")) {
    return handleGetPage(event.path, depth)
  } else {
    return handleGetFolder(event.path, depth)
  }
}

const getDepth = (event: APIGatewayEvent): number => {
  const param = event.queryStringParameters?.depth
  const n = param ? +param : 1
  return isNaN(n) ? 1 : n
}

const handleGetFolder = async (
  path: string,
  depth: number
): Promise<APIGatewayProxyResult> => {
  const folder = await getFolder(path, depth)
  return {
    statusCode: 200,
    headers: {},
    body: JSON.stringify(folder),
  }
}

const getFolder = async (
  path: string,
  depth: number
): Promise<Folder<string>> => {
  const cleanPath = stripLeadingSlash(appendTrailingSlash(path))
  const data = await s3
    .listObjectsV2({ Bucket: bucketName, Prefix: cleanPath })
    .promise()
  const folder = new Folder<string>(cleanPath, depth)
  const items = data.Contents?.map((x) => {
    return { path: x.Key as string, item: x.Key as string }
  })
  if (items) {
    folder.addItems(items)
  }
  return folder
}

const handleGetPage = async (
  path: string,
  depth: number
): Promise<APIGatewayProxyResult> => {
  const page = await getPage(path, depth)
  return {
    statusCode: 200,
    headers: {},
    body: JSON.stringify(page),
  }
}

const getPage = async (path: string, depth: number): Promise<Page> => {
  const pagePath = stripLeadingSlash(path)
  let paths = [pagePath]
  if (depth > 1) {
    const folderPath = stripFileExtension(pagePath)
    const folder = await getFolder(folderPath, depth - 1)
    paths = paths.concat(folder.allItems)
  }

  const promises = paths.map((path) =>
    s3.getObject({ Bucket: bucketName, Key: path }).promise()
  )
  const results = await Promise.all(promises)
  const pageFolderItems: FolderItem<Page>[] = results.map((result, index) => {
    const page: Page = {
      content: parseItem(result.Body?.toString(), paths[index]),
      path: paths[index],
      lastModified: result.LastModified!,
    }
    const folderItem: FolderItem<Page> = { path: paths[index], item: page }
    return folderItem
  })
  const pageFolder = new Folder<Page>(stripLastElement(pagePath), depth)
  pageFolder.addItems(pageFolderItems)

  const page = embedChildPages(pageFolder)![0]

  return page
}

const embedChildPages = (folder: Folder<Page>): Page[] | undefined => {
  const pages = folder.items
  pages?.forEach((page) => {
    const subfolderPath = stripFileExtension(page.path)
    const subfolder = folder.findSubfolder(subfolderPath)
    page.children = subfolder ? embedChildPages(subfolder) : undefined
  })

  return pages
}

const appendFileExtension = (s: string) => {
  return s.endsWith(".json") ? s : `${s}.json`
}

const stripLeadingSlash = (s: string) => {
  return s.startsWith("/") ? s.substring(1) : s
}

const appendTrailingSlash = (s: string) => {
  return s.endsWith("/") ? s : `${s}/`
}

const stripFileExtension = (s: string) => {
  return s.replace(/\.[^\/]*$/, "")
}

const stripLastElement = (s: string) => {
  const elements = s.split("/")
  return elements.slice(0, elements.length - 1).join("/")
}

const parseItem = (s: string | undefined | null, path: string): Item => {
  if (!s || s.length === 0) {
    let err = new Error(`Item cannot be empty. (${path})`)
    err.name = "ValidationError"
    throw err
  }
  return JSON.parse(s)
}

const validateItem = (s: string | undefined | null, path: string): string => {
  const json = parseItem(s, path)
  const valid = validateItemJson(json)
  if (!valid) {
    const errorMessages = validateItemJson.errors?.map((e) => e.message)
    let err = new Error(`${errorMessages?.join(". ")} (${path})`)
    err.name = "ValidationError"
    throw err
  }
  return s as string
}
