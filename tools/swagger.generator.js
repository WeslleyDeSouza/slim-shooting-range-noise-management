/* This generates Models and API for Angular based on swagger */
const path = require('path');

const { NgOpenApiGen } = require('ng-openapi-gen');
const $RefParser = require('json-schema-ref-parser');

const options = {
  input: path.resolve('./config/api-gateway-swagger-spec.json'),
  output: path.resolve('./libs/app/generated/src/core'),
  ignoreUnusedModels: false,
  services: true,
};

// load the openapi-spec and resolve all $refs
(async () => {
  const RefParser = new $RefParser();
  const openApi = await RefParser.bundle(options.input, {
    dereference: { circular: false },
  });

  const ngOpenGen = new NgOpenApiGen(openApi, options);
  ngOpenGen.generate();
})();
