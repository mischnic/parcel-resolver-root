// @flow

/*::

import type {
  Resolver as ResolverType,
  FileCreateInvalidation,
  FilePath,
} from "@parcel/types";

*/

const path = require("path");
const { Resolver } = require("@parcel/plugin");
const { default: NodeResolver } = require("@parcel/node-resolver-core");
const { loadConfig, validateSchema } = require("@parcel/utils");
const { encodeJSONKeyComponent } = require("@parcel/diagnostic");

// Throw user friendly errors on special webpack loader syntax
// ex. `imports-loader?$=jquery!./example.js`
const WEBPACK_IMPORT_REGEX = /\S+-loader\S*!\S+/g;

module.exports = (new Resolver({
  async resolve({ dependency, options, filePath }) {
    if (WEBPACK_IMPORT_REGEX.test(dependency.moduleSpecifier)) {
      throw new Error(
        `The import path: ${dependency.moduleSpecifier} is using webpack specific loader import syntax, which isn't supported by Parcel.`
      );
    }

    // -------------------- MODIFIED --------------------
    let invalidateOnFileCreate = [],
      invalidateOnFileChange = [];
    if (dependency.resolveFrom) {
      let result = await load(options, dependency.resolveFrom, options.inputFS);
      let { rewrites } = result;
      ({ invalidateOnFileCreate, invalidateOnFileChange } = result);

      if (rewrites) {
        for (let [k, v] of rewrites) {
          if (filePath.startsWith(k)) {
            filePath = path.relative(
              path.dirname(dependency.resolveFrom),
              path.join(v, filePath.slice(k.length))
            );
            if (!filePath.startsWith(".")) {
              filePath = "./" + filePath;
            }
            break;
          }
        }
      }
    }
    // -------------------- MODIFIED --------------------

    let mainFields = ["source", "browser"];

    // If scope hoisting is enabled, we can get smaller builds using esmodule input, so choose `module` over `main`.
    // Otherwise, we'd be wasting time transforming esmodules to commonjs, so choose `main` over `module`.
    if (dependency.env.shouldScopeHoist) {
      mainFields.push("module", "main");
    } else {
      mainFields.push("main", "module");
    }

    const resolver = new NodeResolver({
      fs: options.inputFS,
      projectRoot: options.projectRoot,
      extensions: ["ts", "tsx", "js", "jsx", "json", "css", "styl", "vue"],
      mainFields,
    });

    let result = await resolver.resolve({
      filename: filePath,
      isURL: dependency.isURL,
      parent: dependency.resolveFrom,
      env: dependency.env,
    });
    // -------------------- MODIFIED --------------------
    if (result && result.diagnostics == null) {
      // the resolution didn't fail
      result.invalidateOnFileCreate.push(...invalidateOnFileCreate);
      result.invalidateOnFileChange.push(...invalidateOnFileChange);
    }
    // -------------------- MODIFIED --------------------
    return result;
  },
}) /*: ResolverType */);

const NAME = "@mischnic/parcel-resolver-root";
const CONFIG_SCHEMA = {
  type: "object",
  properties: {
    "/": {
      type: "string",
    },
    "~": {
      type: "string",
    },
  },
  additionalProperties: false,
};

async function load(
  options,
  resolveFrom,
  inputFS
) /*: Promise<{|
  rewrites: ?Map<string, string>,
  invalidateOnFileCreate: Array<FileCreateInvalidation>,
  invalidateOnFileChange: Array<FilePath>,
|}> */ {
  let invalidateOnFileCreate = [],
    invalidateOnFileChange = [];
  let result = await loadConfig(inputFS, resolveFrom, ["package.json"]);
  let config = result && result.config[NAME];

  if (result) {
    invalidateOnFileChange.push(result.files[0].filePath);
  } else {
    invalidateOnFileCreate.push({
      aboveFilePath: resolveFrom,
      fileName: "package.json",
    });
  }

  if (!config) {
    result = await loadConfig(
      inputFS,
      path.join(options.projectRoot, "index"),
      ["package.json"]
    );
    config = result && result.config[NAME];
    if (!config) {
      if (result) {
        invalidateOnFileChange.push(result.files[0].filePath);
      } else {
        invalidateOnFileCreate.push({
          aboveFilePath: path.join(options.projectRoot, "index"),
          fileName: "package.json",
        });
      }
      return {
        rewrites: null,
        invalidateOnFileChange,
        invalidateOnFileCreate,
      };
    }
  }

  validateSchema.diagnostic(
    CONFIG_SCHEMA,
    {
      data: config,
      source: await inputFS.readFile(result.files[0].filePath, "utf8"),
      filePath: result.files[0].filePath,
      prependKey: `/${encodeJSONKeyComponent(NAME)}`,
    },
    NAME,
    "Invalid config for " + NAME
  );

  // $FlowFixMe[incompatible-type]
  let entries /*: Array<[string, string]> */ = Object.entries(config);

  return {
    rewrites: new Map(
      entries.map(([k, v]) => [
        k,
        path.resolve(path.dirname(result.files[0].filePath), v),
      ])
    ),
    invalidateOnFileChange,
    invalidateOnFileCreate,
  };
}
