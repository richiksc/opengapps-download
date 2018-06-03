#!/usr/bin/env node
const OpenGAppsDownload = require('../');
const info = require('../package.json')

if (process.argv.indexOf('--help') > -1) {
  console.log(info.name, info.version);
  console.log('Usage:', 'opengapps-downloader [options]');
  console.log('');
  console.log('Options:');
  console.log('\t', '--help', '\t\t', 'Show this help screen');
  console.log('\t', '--arch=[arch]', '\t\t', "Specify the architecture of the OpenGApps package downloaded. By default 'arm'");
  console.log('\t', '--api=[api]', '\t\t', "Specify the Android version the OpenGApps package downloaded is for. By default '7.1'");
  console.log('\t', '--variant=[variant]', '\t', "Specify the variant of the OpenGApps package downloaded. By default 'stock'");
  console.log('\t', '--this-dir', '\t\t', "Don't create a directory to download packages to. Download to this folder");
  console.log('\t', '--output-dir=[dir]', '\t', 'Specify the output directory to download GApps packages to.');
} else {

  // Parse command line arguments
  let options = {};
  process.argv.forEach(arg => {
    if (arg.startsWith('--')) {
      let kv = arg.split('=');
      let key = kv[0].substring(2).replace(/-([a-z])/g, g => g[1].toUpperCase());
      if (key == 'thisDir') options[key] = true;
      else options[key] = kv[1];
    };
  });

  const config = {
    arch: (OpenGAppsDownload.Arch.hasOwnProperty(options.arch) ? options.arch : OpenGAppsDownload.Arch.arm),
    api: options.api || '7.1',
    variant: options.variant || 'stock',
    dir: (options.thisDir ? '.' : (options.outputDir || null))
  };

  const downloader = new OpenGAppsDownload(config, process.stdout);

  if (options.release && options.release.length == 8 && !isNaN(options.release)) {
    try {
      downloader.downloadGApps(options.release);
    } catch (err) {
      console.error(err.message);
      process.exitCode = err.data.code || 1;
    }
  } else {
    try {
      downloader.downloadLatest();
    } catch (err) {
      console.error(err.message);
      process.exitCode = err.data.code || 1;
    }
  }
}
