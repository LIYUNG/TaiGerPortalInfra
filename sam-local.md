This markdown file provides example commands for working with AWS SAM locally:

Builds the serverless application defined in your SAM template, preparing it for local invocation or deployment.

```
sam build
```

Invokes a specific Lambda function locally using a provided event payload. In this example, the `cronJobFunction` is invoked with a JSON event specifying a `jobType` of "test".

```
echo '{"jobType": "test"}' | sam local invoke cronJobFunction --event -
```
