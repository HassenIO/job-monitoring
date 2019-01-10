import * as path from 'path'
import * as fs from 'fs'
import * as AdmZip from 'adm-zip'
import { S3, SQS } from 'aws-sdk'
import { extractS3Params, IS3Object } from '../lib/events'
import { success, failure } from '../lib/response'

const s3Client = new S3()
const sqsClient = new SQS()

export const run: any = async (event: any) => {
  const s3Object: IS3Object = extractS3Params(event)

  try {
    const tmpZipFile = await getAndSaveLocallyS3Document(s3Object)
    await unzipAndUploadToS3(tmpZipFile, s3Object)
    const [sqsMessage, sqsSendResponse] = await pushJobToSQS(s3Object)
    return success({
      message:
        'Processing new upload finished and ready to be processed by OCR module',
      event,
      s3OriginalObject: s3Object,
      sqsMessage,
      sqsSendResponse
    })
  } catch (error) {
    return failure(error)
  }
}

const getAndSaveLocallyS3Document = async (
  s3Object: IS3Object
): Promise<string> => {
  try {
    const s3Pli: S3.GetObjectOutput = await s3Client
      .getObject(s3Object)
      .promise()

    const tmpZipFile = path.join(process.env.PWD, 'tmp', s3Object.Key)
    fs.writeFileSync(tmpZipFile, s3Pli.Body)
    return tmpZipFile
  } catch (error) {
    throw error
  }
}

const unzipAndUploadToS3 = async (
  tmpZipFile: string,
  s3Object: IS3Object
): Promise<void> => {
  try {
    await Promise.all(
      new AdmZip(tmpZipFile)
        .getEntries()
        .filter(entry => !(entry.isDirectory || entry.name.startsWith('.')))
        .map(entry => uploadEntryToS3(s3Object, entry).promise())
    )
  } catch (error) {
    throw error
  }
}

const uploadEntryToS3 = (s3Object: IS3Object, entry: AdmZip.IZipEntry) =>
  s3Client.putObject({
    Bucket: s3Object.Bucket,
    Key: `processing/${s3Object.Key}/${entry.name}`,
    Body: entry.getData()
  })

const pushJobToSQS = async (
  s3Object: IS3Object
): Promise<[any, SQS.SendMessageResult]> => {
  const queueURL: string = `https://sqs.${
    process.env.AWS_REGION
  }.amazonaws.com/${process.env.AWS_ACCOUNT_ID}/${process.env.AWS_QUEUE_NAME}`
  const sqsMessage = { folder: s3Object.Key }

  try {
    const sqsSendResponse = await sqsClient
      .sendMessage({
        QueueUrl: queueURL,
        MessageBody: JSON.stringify(sqsMessage)
      })
      .promise()
    return [sqsMessage, sqsSendResponse]
  } catch (error) {
    throw error
  }
}
