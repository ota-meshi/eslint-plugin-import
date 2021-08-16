/**
 * tests that require fully booting up ESLint
 */
import path from 'path';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { CLIEngine, ESLint as ESLintClass } from 'eslint';
import eslintPkg from 'eslint/package.json';
import semver from 'semver';
import * as importPlugin from '../../src/index';

use(chaiAsPromised);

const ESLint = ESLintClass || class {
  constructor(options) {
    options = Object.assign({},options);
    const overrideConfig = options.overrideConfig;
    delete options.overrideConfig;
    const overrideConfigFile = options.overrideConfigFile;
    delete options.overrideConfigFile;
    const pluginsMap = options.plugins;
    delete options.plugins;
    this.engine = new CLIEngine(Object.assign(options, overrideConfig, overrideConfigFile ? { configFile:overrideConfigFile }: {}));

    for (const [name, plugin] of Object.entries(pluginsMap || {})) {
      this.engine.addPlugin(name, plugin);
    }
  }
  lintFiles(params) {
    const result = this.engine.executeOnFiles(params);
    return Promise.resolve(result.results);
  }
};

describe('CLI regression tests', function () {
  describe('issue #210', function () {
    let eslint;
    before(function () {
      eslint = new ESLint({
        useEslintrc: false,
        overrideConfigFile: './tests/files/issue210.config.js',
        rulePaths: ['./src/rules'],
        overrideConfig: {
          rules: {
            'named': 2,
          },
        },
        plugins: { 'eslint-plugin-import': importPlugin },
      });
    });
    it("doesn't throw an error on gratuitous, erroneous self-reference", function () {
      return expect(eslint.lintFiles(['./tests/files/issue210.js'])).not.to.rejected;
    });
  });

  describe('issue #1645', function () {
    let eslint;
    beforeEach(function () {
      if (semver.satisfies(eslintPkg.version, '< 6')) {
        this.skip();
      } else {
        eslint = new ESLint({
          useEslintrc: false,
          overrideConfigFile: './tests/files/just-json-files/.eslintrc.json',
          rulePaths: ['./src/rules'],
          ignore: false,
          plugins: { 'eslint-plugin-import': importPlugin },
        });
      }
    });

    it('throws an error on invalid JSON', () => {
      const invalidJSON = './tests/files/just-json-files/invalid.json';
      return eslint.lintFiles([invalidJSON]).then(results => {
        expect(results).to.eql(
          [
            {
              filePath: path.resolve(invalidJSON),
              messages: [
                {
                  column: 2,
                  endColumn: 3,
                  endLine: 1,
                  line: 1,
                  message: 'Expected a JSON object, array or literal.',
                  nodeType: results[0].messages[0].nodeType, // we don't care about this one
                  ruleId: 'json/*',
                  severity: 2,
                  source: results[0].messages[0].source, // NewLine-characters might differ depending on git-settings
                },
              ],
              errorCount: 1,
              ...(semver.satisfies(eslintPkg.version, '>= 7.32 || ^8.0.0-0') && {
                fatalErrorCount: 0,
              }),
              warningCount: 0,
              fixableErrorCount: 0,
              fixableWarningCount: 0,
              source: results[0].source, // NewLine-characters might differ depending on git-settings
              ...(semver.satisfies(eslintPkg.version, '>= 7.0.0') && {
                usedDeprecatedRules: results[0].usedDeprecatedRules, // we don't care about this one
              }),
            },
          ],
        );
      });
    });
  });
});
