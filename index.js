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


internals.readConfig = (file, cb) => Markdownlint.readConfig(
  file,
  (err, config) => cb(null, (!err && config) || { default: true })
);


internals.readIgnore = (file, cb) => Fs.exists(file, exists => {
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


internals.hasKnownExtension = fname => [
  'markdown',
  'mdown',
  'mkdn',
  'mkd',
  'md'
].indexOf(fname.split('.').pop()) >= 0;


internals.readFiles = (paths, opts, cb) => Async.map(
  paths.map(p => Path.join(process.cwd(), p)),
  (path, mapCb) => Fs.stat(path, (err, stats) => {
    if (err) {
      return mapCb(err);
    }
    if (stats.isDirectory()) {
      // TODO: only add `/**` if is dir??
      return Glob(Path.join(path, '**', '**'), {
        ignore: opts.ignore.map(i => Path.join(path, i + '/**'))
      }, mapCb);
    }
    return mapCb(null, path);
  }),
  (err, results) => err
    ? cb(err)
    : cb(null, [].concat(...results).filter(internals.hasKnownExtension))
);


internals.sortResults = (a, b) =>
  (a.lineNumber > b.lineNumber && 1) || (a.lineNumber < b.lineNumber && -1) || 0;


internals.printResults = (results, verbose) => {
  const rulesUrl = 'https://github.com/DavidAnson/markdownlint/blob/master/doc/Rules.md';
  const stats = { files: 0, total: 0 };
  Object.keys(results).forEach(key => {
    if (!results[key].length) {
      return;
    }
    stats.files++;
    console.log(Chalk.underline(key));
    results[key].sort(internals.sortResults).forEach(result => {
      stats.total++;
      stats[result.ruleAlias] = (stats[result.ruleAlias] + 1) || 1;
      console.log([
        Chalk.grey(`  ${result.lineNumber}`),
        (result.errorRange && Chalk.grey(`:${result.errorRange[0]}`)) || '',
        Chalk.yellow(` ${result.ruleNames[1]} [${result.ruleNames[0]}]`),
        Chalk.bold.blue(` ${result.ruleDescription}`),
        (result.errorDetail && ` [${result.errorDetail}]`) || '',
        (result.errorContext && Chalk.italic(` "${result.errorContext}"`) || ''),
        (verbose && Chalk.dim(` ${rulesUrl}#${result.ruleNames[0].toLowerCase()}`))
      ].join(''));
    });
  });
  console.log('\nSummary:')
  console.log(`${stats.total} issues in ${stats.files} file(s)`);
  Object.keys(stats)
    .filter(k => ['total', 'files'].indexOf(k) < 0)
    .forEach(k => console.log(` - ${Chalk.yellow(k)} ${stats[k]}`));

  (stats.total && process.exit(1)) || process.exit(0);
};


internals.printError = err => {
  console.error(err);
  process.exit(1);
};


internals.help = () => console.log(`Usage:

  mdlint [path1] [path2] ...

Options:

  -c, --config   Path to config file. Default: '.mdlintrc'
  -i, --ignore   Path to file with patterns to ignore. Default: '.mdlintignore'
  -v, --verbose  Show verbose output.
  -h, --help     Show this help.
  -V, --version  Show ${Pkg.name} version.

${Pkg.author.name} ${(new Date()).getFullYear()}`);


module.exports = (paths, opts, cb) => internals.readFiles(
  paths,
  opts,
  (err, files) => err ? cb(err) : Markdownlint({ files, config: opts.config }, cb),
);


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
    config: Async.apply(internals.readConfig, args.c || args.config || '.mdlintrc'),
    ignore: Async.apply(internals.readIgnore, args.i || args.ignore || '.mdlintignore'),
  }, (err, opts) => {
    if (err) {
      return internals.printError(err);
    }

    module.exports(args._, opts, (err, results) =>
      err
        ? internals.printError(err)
        : internals.printResults(results, args.v || args.verbose));
  });
}
