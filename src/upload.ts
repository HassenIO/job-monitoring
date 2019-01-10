import * as path from 'path'
import * as fs from 'fs'
import * as AdmZip from 'adm-zip'
import { S3, SQS } from 'aws-sdk'
import { extractS3Params } from '../lib/events'
import { success, failure } from '../lib/response'

const s3Client = new S3()
const sqsClient = new SQS()

const queueURL: string = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${
  process.env.AWS_ACCOUNT_ID
}/${process.env.AWS_QUEUE_NAME}`

export const run: any = async (event: any) => {
  const s3Object = extractS3Params(event)
  let sqsMessage, sqsSendResponse: SQS.SendMessageResult

  try {
    // Get remote S3 document (pli)
    const s3Pli: S3.GetObjectOutput = await s3Client
      .getObject(s3Object)
      .promise()

    // Save document locally for unzip
    const tmpZipFile = path.join(process.env.PWD, 'tmp', s3Object.Key)
    fs.writeFileSync(tmpZipFile, s3Pli.Body)

    // Upload to S3 the documents inside the zip
    await Promise.all(
      new AdmZip(tmpZipFile)
        .getEntries()
        .filter(entry => !entry.isDirectory)
        .map(entry =>
          s3Client
            .putObject({
              Bucket: s3Object.Bucket,
              Key: `processing/${s3Object.Key}/${entry.name}`,
              Body: entry.getData()
            })
            .promise()
        )
    )

    // Push new job in the SQS queue for processing
    sqsMessage = { folder: s3Object.Key }
    sqsSendResponse = await sqsClient
      .sendMessage({
        QueueUrl: queueURL,
        MessageBody: JSON.stringify(sqsMessage)
      })
      .promise()
  } catch (error) {
    return failure(error)
  }

  return success({
    message:
      'Processing new upload finished and ready to be processed by OCR module',
    event,
    s3OriginalObject: s3Object,
    sqsMessage,
    sqsSendResponse
  })
}
