#! /usr/bin/env node
'use strict';


const Fs = require('fs');
const Path = require('path');
const Async = require('async');
const Minimist = require('minimist');
const Glob = require('glob');
const Chalk = require('chalk');
const Markdownlint = require('markdownlint');
const Pkg = require('./package.json');


const internals = {};



internals.readConfig = (file, cb) => {
  Markdownlint.readConfig(file, (err, config) => {
    cb(null, (!err && config) || { default: true });
  });
};


internals.readIgnore = (file, cb) => {
  Fs.exists(file, exists => {
    if (!exists) {
      return cb(null, []);
    }
    Fs.readFile(file, 'utf8', (err, data) => {
      if (err) {
        return cb(null, []);
      }
      cb(null, data.trim().split('\n'));
    });
  });
};


internals.hasKnownExtension = fname => [
  'markdown',
  'mdown',
  'mkdn',
  'mkd',
  'md'
].indexOf(fname.split('.').pop()) >= 0;


internals.readFiles = (paths, opts, cb) => {
  Async.map(paths.map(p => Path.join(process.cwd(), p)), (path, mapCb) => {
    Fs.stat(path, (err, stats) => {
      if (err) {
        return mapCb(err);
      }
      else if (stats.isDirectory()) {
        // TODO: only add `/**` if is dir??
        Glob(Path.join(path, '**', '**'), {
          ignore: opts.ignore.map(i => Path.join(path, i + '/**'))
        }, mapCb);
      }
      else {
        mapCb(null, path);
      }
    });
  }, (err, results) => {
    if (err) {
      return cb(err);
    }
    cb(null, [].concat(...results).filter(internals.hasKnownExtension));
  });
};


internals.printResults = (results, verbose) => {
  const rulesUrl = 'https://github.com/DavidAnson/markdownlint/blob/master/doc/Rules.md';
  Object.keys(results).forEach(key => {
    if (results[key].length) {
      console.log(Chalk.underline(key));
      results[key].forEach(result => {
        console.log([
          Chalk.grey(`  ${result.lineNumber}`),
          (result.errorRange && Chalk.grey(`:${result.errorRange[0]}`)) || '',
          Chalk.blueBright(` ${result.ruleAlias}`),
          Chalk.bold(` ${result.ruleDescription}`),
          (result.errorDetail && ` [${result.errorDetail}]`) || '',
          (result.errorContext && Chalk.italic(` "${result.errorContext}"`) || ''),
          (verbose && Chalk.dim(` ${rulesUrl}#${result.ruleName.toLowerCase()}`))
        ].join(''));
      });
    }
  });
};


internals.printError = err => {
  console.error(err);
  process.exit(1);
};


internals.help = () => console.log(`Usage:

  mdlint [path1] [path2] ...

Options:

  -h, --help
  -v, --verbose
  -V, --version

${Pkg.author.name} ${(new Date()).getFullYear()}`);


module.exports = (paths, opts, cb) => {

  internals.readFiles(paths, opts, (err, files) => {
    if (err) {
      return cb(err);
    }

    Markdownlint({ files, config: opts.config }, cb);
  });
};


if (require.main === module) {
  const args = Minimist(process.argv.slice(2));

  if (!args._.length || args.h || args.help) {
    internals.help();
    process.exit(0);
  }
  else if (args.V || args.version) {
    console.log(Pkg.version);
    process.exit(0);
  }

  Async.auto({
    config: Async.apply(internals.readConfig, args.config || '.mdlintrc'),
    ignore: Async.apply(internals.readIgnore, args.ignore || '.mdlintignore'),
  }, (err, opts) => {
    if (err) {
      return internals.printError(err);
    }
    module.exports(args._, opts, (err, results) => {
      if (err) {
        internals.printError(err);
      }
      else {
        internals.printResults(results, args.v || args.verbose);
        process.exit(0);
      }
    });
  });
}
