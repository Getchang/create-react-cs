"use strict";

const currentNodeVersion = process.versions.node;
const semver = currentNodeVersion.split('.');
const major = semver[0];

if (major < 14) {
  console.error('You are running Node ' + currentNodeVersion + '.\n' + 'Create React App requires Node 14 or higher. \n' + 'Please update your version of Node.');
  process.exit(1);
}

const {
  init
} = require('./main.js');

init();
"use strict";

const fs = require('fs');

const path = require('path');

const commander = require('commander');

const packageJson = require('../package.json');

const init = () => {
  const program = new commander.Command(packageJson.name);
  console.log(packageJson);
};
