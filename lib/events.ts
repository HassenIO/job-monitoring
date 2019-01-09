export const extractS3Params = (event: any) => {
  const {
    s3: {
      bucket: { name: Bucket },
      object: { key: Key }
    }
  } = event.Records[0];
  return { Bucket, Key };
};
