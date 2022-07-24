import { Stack, StackProps } from "aws-cdk-lib"
import { Construct } from "constructs"
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs"
import { Bucket } from "aws-cdk-lib/aws-s3"
import { Runtime } from "aws-cdk-lib/aws-lambda"
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway"

export class ComposeumApiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const bucket = new Bucket(this, "composeum-store")

    const handler = new NodejsFunction(this, "content-api-handler", {
      handler: "main",
      entry: __dirname + "/../functions/content.ts",
      runtime: Runtime.NODEJS_16_X,
      environment: {
        BUCKET: bucket.bucketName,
      },
    })

    bucket.grantReadWrite(handler)

    const api = new LambdaRestApi(this, "composeum-api", {
      proxy: true,
      handler: handler,
    })
  }
}
