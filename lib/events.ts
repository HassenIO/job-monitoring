export const extractS3Params = (event: any): IS3Object => {
  const {
    s3: {
      bucket: { name: Bucket },
      object: { key: Key }
    }
  } = event.Records[0]
  return { Bucket, Key }
}

export interface IS3Object {
  Bucket: string
  Key: string
}
