import * as path from 'path';
import * as fs from 'fs';
import * as AdmZip from 'adm-zip';
import { S3 } from 'aws-sdk';
import { extractS3Params } from '../lib/events';
import { success, failure } from '../lib/response';

const s3Client = new S3();

export const run: any = async (event: any) => {
  const s3Object = extractS3Params(event);

  try {
    // Get remote S3 document (pli)
    const s3Pli: S3.GetObjectOutput = await s3Client
      .getObject(s3Object)
      .promise();

    // Save document locally for unzip
    const tmpZipFile = path.join(process.env.PWD, 'tmp', s3Object.Key);
    fs.writeFileSync(tmpZipFile, s3Pli.Body);

    // Upload to S3 the document inside the zip
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
    );
  } catch (error) {
    return failure(error);
  }

  return success({
    message: 'Hey, TS is awesome',
    input: event
  });
};
