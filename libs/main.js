"use strict";

const fs = require('fs-extra');

const https = require('https');

const stream = require('stream');

const path = require('path');

const hyperquest = require('hyperquest');

const commander = require('commander');

const chalk = require('chalk');

const execSync = require('child_process').execSync;

const spawn = require('cross-spawn');

const envinfo = require('envinfo');

const os = require('os');

const unpack = require('tar-pack').unpack;

const semver = require('semver');

const packageJson = require('../package.json');

const commandMap = {
  config: {
    alias: 'cfg',
    description: 'for config tmplate of project/cli',
    usages: ['create-react-cs config set <k> <v>', 'create-react-cs config get <k>', 'create-react-cs config remove <k>']
  }
};
let projectName;
let projectConfig;
let template;

const init = () => {
  var _projectConfig;

  // 获取项目配置
  projectConfig = getInitConfig();
  template = (_projectConfig = projectConfig) === null || _projectConfig === void 0 ? void 0 : _projectConfig.defaultType;
  /**
   * 初始化命令 记录 packageName
   */

  const program = new commander.Command(packageJson.name).version(packageJson.version, '-v, --version').arguments('[project-directory]').usage(`${chalk.green('<project-directory>')} [options]`).option('--verbose', 'print additional logs').option('--scripts-version <alternative-package>', 'use a non-standard version of react-cs').option('--template [type]', 'choose an type of template', setProjectTemplate).option('--info', 'print environment debug info').action((name, options, command) => {
    if (Object.keys(options).length) {
      Object.assign(program, options);
    } else {
      projectName = name;
    }
  });
  /**cs
   * 设置命令
   */

  for (let [key, val] of Object.entries(commandMap)) {
    program.command(key).alias(val.alias).description(val.description).usage(`${chalk.green(val.usages)} [options]`).action(() => {// console.log(opt);
    });
  } // program.allowUnknownOption();


  program.on('--help', () => {
    console.log(`    Only ${chalk.green('<project-directory>')} is required.`);
    console.log();
    console.log(`    A custom ${chalk.cyan('--scripts-version')} can be one of:`);
    console.log(`      - a specific npm version: ${chalk.green('0.8.2')}`);
    console.log(`      - a specific npm tag: ${chalk.green('@next')}`);
  }).parse(process.argv);

  if (program.info) {
    // 监测当前用户的安装环境
    console.log(chalk.bold('\nEnvironment Info:'));
    console.log(`\n  current version of ${packageJson.name}: ${packageJson.version}`);
    console.log(`  running from ${__dirname}`);
    return envinfo.run({
      System: ['OS', 'CPU'],
      Binaries: ['Node', 'npm', 'Yarn'],
      Browsers: ['Chrome', 'Edge', 'Internet Explorer', 'Firefox', 'Safari'],
      npmGlobalPackages: ['create-react-cs']
    }, {
      duplicates: true,
      showNotFound: true
    }).then(console.log);
  }

  if (typeof projectName === 'undefined') {
    console.error('Please specify the project directory:');
    console.log(`  ${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`);
    console.log();
    console.log('For example:');
    console.log(`  ${chalk.cyan(program.name())} ${chalk.green('my-react-app')}`);
    console.log();
    console.log(`Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`);
    process.exit(1);
  }

  createApp(projectName, program.verbose, program.scriptsVersion, template);
};
/**
 * @description: 创建工程
 * @param {*} name
 * @param {*} verbose
 * @param {*} version
 * @param {*} template
 * @return {*}
 */


function createApp(name, verbose, version, template) {
  const unsupportedNodeVersion = !semver.satisfies( // node version
  semver.coerce(process.version), '>=14');

  if (unsupportedNodeVersion) {
    console.log();
    console.log(chalk.yellow(`You are using Node ${process.version} so the project will be bootstrapped with an old unsupported version of tools.\n\n` + `Please update to Node 14 or higher for a better, fully supported experience.\n`)); // exit

    process.exit(1);
  }

  const root = path.resolve(name);
  const appName = path.basename(root); // console.log(root, appName);

  fs.ensureDirSync(name);

  if (!isSafeToCreateProjectIn(root, appName)) {
    process.exit(1);
  }

  console.log();
  console.log(`Creating a new React app in ${chalk.green(root)}.`);
  console.log();
  const originalDirectory = process.cwd();
  process.chdir(root);
  const npmInfo = checkNpmVersion(); // 检查npm版本

  if (!npmInfo.hasMinNpm) {
    if (npmInfo.npmVersion) {
      console.log(chalk.yellow(`You are using npm ${npmInfo.npmVersion} so the project will be bootstrapped with an old unsupported version of tools.\n\n` + `Please update to npm 6 or higher for a better, fully supported experience.\n`));
    }

    process.exit(1);
  }

  checkForLatestVersion(template).then(val => {
    if (version) {
      version = semver.gt(version, val) ? version : val;
    } else {
      version = val;
    }

    run(root, appName, version, verbose, originalDirectory, template);
  }).catch(err => {
    console.log(chalk.yellow(err));
    process.exit(1);
  });
} // 执行下载模板解析过程


async function run(root, appName, version, verbose, originalDirectory, template) {
  // console.log(root, appName, originalDirectory);
  let stream;

  try {
    console.log('Installing tempalte packages with ' + chalk.cyan(template) + ' options'); // stream = await getPakeageInfo(template, version);

    stream = hyperquest(`https://registry.npmjs.org/${template}/-/${template}-${version}.tgz`);
  } catch (err) {
    console.log(`Could not extract the package name from the archive: ${err}`);
    process.exit(1);
  }

  let templatePackageJson, desk;

  try {
    desk = await extractStream(stream, root);
    await sleep(1000);

    if (fs.existsSync(path.join(desk, 'package.json'))) {
      templatePackageJson = require(path.join(desk, 'package.json'));
    } else {
      throw new Error('Could not get the name from package.json');
    }
  } catch (err) {
    console.log(`Could not unpack the package from the stream: ${err}`);
    process.exit(1);
    destoryInstallDir(err, root, appName);
  }

  const packageJson = {
    name: appName,
    version: '0.1.0',
    private: true
  };
  const {
    main,
    scripts,
    devDependencies,
    dependencies,
    browserslist
  } = templatePackageJson;
  fs.writeFileSync(path.join(desk, 'package.json'), JSON.stringify({ ...packageJson,
    main,
    scripts,
    devDependencies,
    dependencies,
    browserslist
  }, null, 2) + os.EOL);
  fs.removeSync(path.join(desk, 'LICENSE'));
  console.log;
  console.log('Installing packages. This might take a couple of minutes.');
  console.log();
  install(root, verbose, [...Object.keys(dependencies), ...Object.keys(devDependencies)]).then(() => {
    console.log('完成');
    const displayedCommand = 'npm';
    const useYarn = false;
    console.log();
    console.log(`Success! Created ${appName} at ${root}`);
    console.log('Inside that directory, you can run several commands:');
    console.log();
    console.log(chalk.cyan(`  ${displayedCommand} start`));
    console.log('    Starts the development server.');
    console.log();
    console.log(chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}build`));
    console.log('    Bundles the app into static files for production.'); // console.log();
    // console.log(chalk.cyan(`  ${displayedCommand} test`));
    // console.log('    Starts the test runner.');
    // console.log();
    // console.log(chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}eject`));
    // console.log('    Removes this tool and copies build dependencies, configuration files');
    // console.log('    and scripts into the app directory. If you do this, you can’t go back!');

    console.log();
    console.log('We suggest that you begin by typing:');
    console.log();
    console.log(chalk.cyan('  cd'), appName);
    console.log(`  ${chalk.cyan(`${displayedCommand} start`)}`);
    console.log();
    console.log('Happy hacking!');
  }).catch(err => {
    destoryInstallDir(err, root, appName, ['package.json', 'yarn.lock', 'node_modules', 'config', 'public', 'src', 'LICENSE', 'README.md']);
  });
} // 安装过程


function install(root, verbose, allDependencies) {
  return new Promise((resolve, reject) => {
    let command;
    let args;
    command = 'npm';
    args = ['install', '--no-audit', '--save', '--save-exact', '--loglevel', 'error'];

    if (verbose) {
      args.push('--verbose');
    }

    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: root
    });
    child.on('close', code => {
      if (code !== 0) {
        reject({
          command: `${command} ${args.join(' ')}`
        });
        return;
      }

      resolve();
    });
  });
}

function isSafeToCreateProjectIn(root, name) {
  // 可以保留的文件类型
  const validFiles = ['.DS_Store', '.git', '.gitattributes', '.gitignore', '.gitlab-ci.yml', '.hg', '.hgcheck', '.hgignore', '.idea', '.npmignore', '.travis.yml', 'docs', 'LICENSE', 'README.md', 'mkdocs.yml', 'Thumbs.db']; // 安装失败需要删除的失败日志

  const errorLogFilePatterns = ['npm-debug.log', 'yarn-error.log', 'yarn-debug.log'];

  const isErrorLog = file => {
    return errorLogFilePatterns.some(pattern => file.startsWith(pattern));
  }; // console.log(fs.readdirSync(root));


  const conflicts = fs.readdirSync(root).filter(file => !validFiles.includes(file)) // IntelliJ IDEA creates module files before CRA is launched
  .filter(file => !/\.iml$/.test(file)) // Don't treat log files from previous installation as conflicts
  .filter(file => !isErrorLog(file));

  if (conflicts.length) {
    console.log(`The directory ${chalk.green(name)} contains files that could conflict:`);
    console.log();

    for (const file of conflicts) {
      try {
        const stats = fs.lstatSync(path.join(root, file));

        if (stats.isDirectory()) {
          console.log(`  ${chalk.blue(`${file}/`)}`);
        } else {
          console.log(`  ${file}`);
        }
      } catch (e) {
        console.log(`  ${file}`);
      }
    }

    console.log();
    console.log('Either try using a new directory name, or remove the files listed above.');
    return false;
  } // Remove any log files from a previous installation.


  fs.readdirSync(root).forEach(file => {
    if (isErrorLog(file)) {
      fs.removeSync(path.join(root, file));
    }
  });
  return true;
}

function checkNpmVersion() {
  let hasMinNpm = false;
  let npmVersion = null;

  try {
    npmVersion = execSync('npm --version').toString().trim();
    hasMinNpm = semver.gte(npmVersion, '6.0.0');
  } catch (err) {// ignore
  }

  return {
    hasMinNpm: hasMinNpm,
    npmVersion: npmVersion
  };
}

function getInitConfig() {
  let config; // console.log(process.cwd(), __dirname);

  try {
    config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.cscfg'), 'utf8').toString());
  } catch (e) {
    console.log();
    console.log(`${chalk.yellow('can not find this fill .cscfg')}`);
    console.log();
    process.exit(1);
  } // console.log(config);


  return config;
}

function setProjectTemplate(value) {
  // console.log(value);
  let {
    templates
  } = projectConfig;

  if (!templates.includes(value)) {
    console.log();
    console.log(chalk.yellow('The template name you entered does not exist'));
    console.log(`Run ${chalk.cyan('create-react-cs config get template')} to see all options`);
    console.log();
    process.exit(1);
  }

  template = value;
}

function checkForLatestVersion(installPackage) {
  return new Promise((resolve, reject) => {
    https.get(`https://registry.npmjs.org/-/package/${installPackage}/dist-tags`, res => {
      if (res.statusCode === 200) {
        let body = '';
        res.on('data', data => body += data);
        res.on('end', () => {
          resolve(JSON.parse(body).latest);
        });
      } else {
        reject();
      }
    }).on('error', () => {
      reject();
    });
  });
}

function getPakeageInfo(installPackage, version) {
  // https://registry.npmjs.org/chs-react/-/chs-react-0.0.1.tgz
  console.log(`https://registry.npmjs.org/${installPackage}/-/${installPackage}-${version}.tgz`);
  return new Promise((resolve, reject) => {
    https.get(`https://registry.npmjs.org/${installPackage}/-/${installPackage}-${version}.tgz`, res => {
      console.log(res);

      if (res.statusCode === 200) {
        let chunk = '';
        res.on('data', data => chunk += data);
        res.on('end', () => {
          resolve(chunk);
        });
      } else {
        reject();
      }
    }).on('error', err => {
      reject(err);
    });
  });
}

function extractStream(tarSm, dest) {
  return new Promise((resolve, reject) => {
    const pack = unpack(dest, err => {
      if (err) {
        reject(err);
      } else {
        resolve(dest);
      }
    });
    tarSm.pipe(pack);
  });
}

function destoryInstallDir(reason, root, appName, removePath) {
  console.log();
  console.log('Aborting installation.');

  if (reason.command) {
    console.log(`  ${chalk.cyan(reason.command)} has failed.`);
  } else {
    console.log(chalk.red('Unexpected error. Please report it as a bug:'));
    console.log(reason);
  }

  console.log(); // On 'exit' we will delete these files from target directory.

  const knownGeneratedFiles = removePath || ['package.json', 'yarn.lock', 'node_modules'];
  const currentFiles = fs.readdirSync(path.join(root));
  currentFiles.forEach(file => {
    knownGeneratedFiles.forEach(fileToMatch => {
      // This removes all knownGeneratedFiles.
      if (file === fileToMatch) {
        console.log(`Deleting generated file... ${chalk.cyan(file)}`);
        fs.removeSync(path.join(root, file));
      }
    });
  });
  const remainingFiles = fs.readdirSync(path.join(root));

  if (!remainingFiles.length) {
    // Delete target folder if empty
    console.log(`Deleting ${chalk.cyan(`${appName}/`)} from ${chalk.cyan(path.resolve(root, '..'))}`);
    process.chdir(path.resolve(root, '..'));
    fs.removeSync(path.join(root));
  }

  console.log('Done.');
  process.exit(1);
}

function sleep(time) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

module.exports = {
  init
};