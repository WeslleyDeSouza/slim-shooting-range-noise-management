# @ui-slim/apiClient (api-client)

Angular client generated from the API's Swagger spec with `ng-openapi-gen`.

```bash
# 1. run the API with API_SWAGGER_ENABLED=1 and save the spec to
#    config/api-gateway-swagger-spec.json (http://localhost:3333/api/docs-json)
# 2. regenerate the client
npm run ng-swagger
```

`src/core/` is the generated output and git-ignored; only the barrel
`src/index.ts` is committed. Import via `@ui-slim/apiClient`.
