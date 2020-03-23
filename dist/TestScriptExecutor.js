"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const childProcess = require("child_process");
const util_1 = require("util");
const fs_1 = require("fs");
const chalk_1 = require("chalk");
const figures_1 = require("figures");
const fse = require("node-fs-extra");
const ConfigMaker_1 = require("./ConfigMaker");
/**
 * Executes test scripts generated by Concordia using CodeceptJS.
 */
class TestScriptExecutor {
    constructor(_defaultConfig) {
        this._defaultConfig = _defaultConfig;
    }
    /**
     * Executes the script according to the options given.
     *
     * @param options Execution options
     */
    execute(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const iconInfo = chalk_1.default.blueBright(figures_1.info);
            const iconWarning = chalk_1.default.yellow(figures_1.warning);
            const textColor = chalk_1.default.cyanBright;
            const textCommand = chalk_1.default.cyan;
            const highlight = chalk_1.default.yellowBright;
            // Creates the source code dir if it does not exist
            if (!!options.sourceCodeDir) {
                fse.mkdirs(options.sourceCodeDir);
            }
            // Creates the execution result/output dir if it does not exist
            if (!!options.executionResultDir) {
                fse.mkdirs(options.executionResultDir);
            }
            const executionPath = process.cwd();
            // codecept.json -------------------------------------------------------
            yield this.assureConfigurationFile(executionPath);
            // Run CodeceptJS -------------------------------------------------------
            let filter = '';
            if (options && options.filter) {
                filter = options.filter.scenarioName || options.filter.featureName || '';
            }
            const command = filter
                ? `npx codeceptjs run --grep ${filter} --reporter mocha-multi --colors || echo .`
                : 'npx codeceptjs run --reporter mocha-multi --colors || echo .';
            this.write(iconInfo, textColor('Running tests...'));
            this.write(' ', textCommand(command));
            const code = yield this.runCommand(command);
            // Output file ----------------------------------------------------------
            const OUTPUT_FILE_NAME = 'output.json';
            const outputFilePath = path.join(options.executionResultDir || '.', OUTPUT_FILE_NAME);
            this.write(iconInfo, textColor('Retrieving output file'), highlight(outputFilePath) + textColor('...'));
            return outputFilePath;
        });
    }
    fileExists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const accessFile = util_1.promisify(fs_1.access);
                yield accessFile(path, fs_1.constants.F_OK);
                return true;
            }
            catch (e) {
                return false;
            }
        });
    }
    assureConfigurationFile(executionPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const iconInfo = chalk_1.default.blueBright(figures_1.info);
            const iconError = chalk_1.default.redBright(figures_1.cross);
            const textColor = chalk_1.default.cyanBright;
            const highlight = chalk_1.default.yellowBright;
            const writeF = util_1.promisify(fs_1.writeFile);
            const codeceptJSConfigFile = path.join(executionPath, 'codecept.json');
            const configFileExists = yield this.fileExists(codeceptJSConfigFile);
            // It's only possible to run CodeceptJS if there is a config file
            if (!configFileExists) {
                try {
                    yield writeF(codeceptJSConfigFile, JSON.stringify(this._defaultConfig, undefined, "\t"));
                    this.write(iconInfo, textColor('Generated configuration file'), highlight(codeceptJSConfigFile));
                    this.write(figures_1.arrowRight, textColor('If this file does not work for you, delete it and then run:'));
                    this.write(textColor('  codeceptjs init'));
                }
                catch (e) {
                    this.write(iconError, textColor('Could not generate'), highlight(codeceptJSConfigFile) + '.', textColor('Please run the following command:'));
                    this.write(textColor('  codeceptjs init'));
                    return false;
                }
            }
            else {
                // Let's check needed dependencies
                let config = {};
                try {
                    const readF = util_1.promisify(fs_1.readFile);
                    const content = yield readF(codeceptJSConfigFile);
                    config = JSON.parse(content.toString());
                    this.write(iconInfo, textColor('Read'), highlight(codeceptJSConfigFile));
                }
                catch (e) {
                    this.write(iconError, textColor('Could not read'), highlight(codeceptJSConfigFile));
                    return false;
                }
                const cfgMaker = new ConfigMaker_1.ConfigMaker();
                let needsToWriteConfig = !cfgMaker.hasHelpersProperty(config);
                if (!cfgMaker.hasCmdHelper(config)) {
                    cfgMaker.setCmdHelper(config);
                    needsToWriteConfig = true;
                }
                if (!cfgMaker.hasDbHelper(config)) {
                    cfgMaker.setDbHelper(config);
                    needsToWriteConfig = true;
                }
                if (needsToWriteConfig) {
                    try {
                        yield writeF(codeceptJSConfigFile, JSON.stringify(config));
                        this.write(iconInfo, textColor('Updated configuration file'), highlight(codeceptJSConfigFile));
                    }
                    catch (e) {
                        this.write(iconError, textColor('Error updating configuration file'), highlight(codeceptJSConfigFile) + '. Please check if it has DbHelper and CmdHelper configured.');
                        return false;
                    }
                }
            }
            return true;
        });
    }
    // private escapeJson( json: string ): string {
    //     return JSON.stringify( { _: json} ).slice( 6, -2 );
    // }
    runCommand(command) {
        return __awaiter(this, void 0, void 0, function* () {
            let options = {
                // stdio: 'inherit', // <<< not working on windows!
                shell: true
            };
            // Splits the command into pieces to pass to the process;
            //  mapping function simply removes quotes from each piece
            let cmds = command.match(/[^"\s]+|"(?:\\"|[^"])+"/g)
                .map(expr => {
                return expr.charAt(0) === '"' && expr.charAt(expr.length - 1) === '"' ? expr.slice(1, -1) : expr;
            });
            const runCMD = cmds[0];
            cmds.shift();
            return new Promise((resolve, reject) => {
                const child = childProcess.spawn(runCMD, cmds, options);
                child.stdout.on('data', (chunk) => {
                    console.log(chunk.toString());
                });
                child.stderr.on('data', (chunk) => {
                    console.warn(chunk.toString());
                });
                child.on('exit', (code) => {
                    resolve(code);
                });
            });
        });
    }
    write(...args) {
        console.log(...args);
    }
}
exports.TestScriptExecutor = TestScriptExecutor;
