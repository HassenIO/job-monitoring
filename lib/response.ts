export const success = (body: any) => ({
  statusCode: 200,
  body: JSON.stringify(body)
});

export const failure = (err: Error) => {
  console.log(`>> Failure returned: ${err}`);
  return { statusCode: 500, body: err };
};
