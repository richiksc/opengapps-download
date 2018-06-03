#!/usr/bin/env node
const OpenGAppsDownload = require('../');
const info = require('../package.json')

if (process.argv.indexOf('--help') > -1) {
  console.log('download-gapps ', info.version);
  console.log('Usage: ', 'download-gapps [options]');
  console.log('');
  console.log('Options:');
  console.log('\t', '--help', '\t\t', 'Show this help screen');
  console.log('\t', '--arch=[arch]', '\t\t', "Specify the architecture of the OpenGApps package downloaded. By default 'arm'");
  console.log('\t', '--api=[api]', '\t\t', "Specify the Android version the OpenGApps package downloaded is for. By default '7.1'");
  console.log('\t', '--variant=[variant]', '\t', "Specify the variant of the OpenGApps package downloaded. By default 'stock'");
  process.exit();
}

let options = {};
process.argv.forEach(arg => {
  if (arg.indexOf('=') > -1 && arg.startsWith('--')) {
    let kv = arg.split('=');
    options[kv[0].substring(2)] = kv[1];
  };
});

const config = {
  arch: (OpenGAppsDownload.Arch.hasOwnProperty(options.arch) ? options.arch : OpenGAppsDownload.Arch.arm),
  api: options.api || '7.1',
  variant: options.variant || 'stock'
};

const downloader = new OpenGAppsDownload(config, process.stdout);

if (options.release && options.release.length == 8 && !isNaN(options.release)) {
  downloader.downloadGApps(options.release);
} else {
  downloader.downloadLatest();
}
