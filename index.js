const https = require('follow-redirects').https;
const fs = require('fs');
const path = require('path');
const md5 = require('md5');
const readline = require('readline');
const HumanFileSize = require('./lib/HumanFileSize');

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
function addZ(n){return n<10? '0'+n:''+n;}

function trackProgress(response, out, dataCb) {
  const pkgSize = parseInt(response.headers['content-length'], 10);
  const pkgSizeHuman = HumanFileSize.auto(pkgSize);
  let totalSent = 0;
  const maxDots = out.columns / 2 || 20;
  response.on('data', (chunk) => {
    totalSent += chunk.length;
    readline.clearLine(out, 0);
    readline.cursorTo(out, 0);
    out.write(`${ Math.round((totalSent / pkgSize) * 100) }%  ${HumanFileSize.humanize(totalSent, pkgSizeHuman.unit).value} / ${pkgSizeHuman} `);
    Array(Math.round((totalSent / pkgSize) * maxDots)).fill(0).forEach(() => { process.stdout.write('.'); })
    if(dataCb != null) dataCb(chunk);
  });
}

/**
 * Download utility for OpenGApps
 * @module opengapps-download
 */
class OpenGAppsDownload {
  /**
   * @typedef {string} Arch
   * @property {string} arm "arm"
   * @property {string} arm64 "arm64"
   * @property {string} x86 "x86"
   * @property {string} x86_64 "x86_64"
   */

  /**
   * @enum {Arch}
   */
  static get Arch() {
    return {
      arm: 'arm',
      arm64: 'arm64',
      x86: 'x86',
      x86_64: 'x86_64'
    }
  }
  /**
   * Initializes the download utility
   * @param {Object} config
   * @param {Arch} config.arch    - The microarchitecture of the device you
   * are downloading OpenGApps for, e.g. 'arm'.
   * @param {string} config.api - The Android version of the device you are
   * downloading OpenGApps for, e.g. '7.1'.
   * @param {string} config.variant - The variant of the OpenGApps package you
   * want to download, e.g. 'stock'. More information can be found on the
   * OpenGApps website (https://opengapps.org).
   * @param {WriteableStream} [output=process.stdout] The stream to output logging to.
   */
  constructor(config, output=process.stdout) {
    this.config = config;
    this.output = output;
    this.baseUrl = `https://github.com/opengapps/${this.config.arch}/releases/download`;
    console.log('Using configuration', config);
  }

  downloadLatest() {
    // Get latest release tag from GitHub
    https.get({
      hostname: 'api.github.com',
      path: `/repos/opengapps/${this.config.arch}/releases/latest?per_page=1`,
      headers: {
        'User-Agent': 'Node.js download script for OpenGApps'
      }
    }, (res) => {
      console.log('Querying latest release metadata from GitHub...');
      if (res.statusCode === 200) {
        let releaseData = '';
        res.on('data', (chunk) => {
          releaseData += chunk;
        });
        res.on('end', () => {
          const latestReleaseTag = JSON.parse(releaseData).tag_name;
          this.downloadGApps(latestReleaseTag);
        });
      } else {
        throw new DownloadError(`Query failed ${response.statusCode} https://api.github.com/repos/opengapps/${this.config.arch}/releases/latest?per_page=1`,
          { code: 1 });
      }
    });
  }

  downloadGApps(release) {
    const dldir = this.config.dir || release;
    if(!fs.existsSync(dldir)) fs.mkdirSync(dldir);
    console.log(`Downloading OpenGApps from release ${release} to directory ${dldir}/`);

    this.downloadSum(dldir, release, (checksum) => {
      this.downloadPackage(dldir, release, (filename) => {
        fs.readFile(dldir + path.sep + filename, (err, buf) => {
          if (err == null) {
            console.log('Verifying integrity with MD5 checksums...');
            console.log(checksum, '..........', md5(buf));
            if(checksum == md5(buf)) {
              console.log('Matches - verified');
            } else {
              console.warn('WARN: MD5 checksums do not match.');
              throw new DownloadError('WARN: MD5 checksums do not match.', { code: 1 });
            }
          } else {
            throw new DownloadError(err.message, { code: 1 });
          }
        });
      });
    });
  }

  downloadSum(dldir, release, cb) {
    const md5FileName = `open_gapps-${this.config.arch}-${this.config.api}-${this.config.variant}-${release}.zip.md5`;

    let md5File = fs.createWriteStream(`${dldir}/${md5FileName}`);
    let md5sum = '';
    const md5Request = https.get(`${this.baseUrl}/${release}/${md5FileName}`, (response) => {
      console.log(`Downloading MD5 checksum to ${dldir}/${md5FileName}...`);
      if (response.statusCode === 200) {
        let incoming = '';
        response.pipe(md5File);
        trackProgress(response, this.output, (chunk) => { incoming += chunk; });
        response.on('end', () => {
          md5sum = incoming.split(' ')[0];
          console.log('');
          console.log('MD5 checksum downloaded to ', dldir, '/', md5FileName);
          process.removeAllListeners('SIGINT');
          if (cb != null) cb(md5sum);
        });
      } else {
        md5Request.abort();
        md5File.close();
        fs.unlinkSync(`${dldir}/${md5FileName}`);
        throw new DownloadError(`Request failed ${response.statusCode} ${md5FileName}`, { code: 1 });
      }
    });
    process.on('SIGINT', () => {
      md5Request.abort();
      md5File.close();
      fs.unlinkSync(`${dldir}/${md5FileName}`);
      process.exit(1);
    });
  }

  downloadPackage(dldir, release, cb) {
    const packageFileName = `open_gapps-${this.config.arch}-${this.config.api}-${this.config.variant}-${release}.zip`;

    let packageFile = fs.createWriteStream(`${dldir}/${packageFileName}`);
    const pkgRequest = https.get(`${this.baseUrl}/${release}/${packageFileName}`, (response) => {
      console.log(`Downloading OpenGApps package to ${dldir}/${packageFileName}...`);
      if (response.statusCode === 200) {
        response.pipe(packageFile);
        trackProgress(response, this.output);
        response.on('end', () => {
          console.log('');
          console.log(
            `${this.config.variant} OpenGApps package for Android ${this.config.api} ${this.config.arch} downloaded to `,
            dldir, '/', packageFileName
          );
          process.removeAllListeners('SIGINT');
          if (cb != null) cb(packageFileName);
        });
      } else {
        pkgRequest.abort();
        packageFile.close();
        fs.unlinkSync(`${dldir}/${packageFileName}`);
        throw new DownloadError(`Request failed ${response.statusCode} ${packageFileName}`, {code: 1});
      }
    });
    process.on('SIGINT', () => {
      pkgRequest.abort();
      packageFile.close();
      fs.unlinkSync(`${dldir}/${packageFileName}`);
      process.exit(1);
    });
  }
}

class DownloadError extends Error {
  constructor(message, data) {
    super(message);
    this.data = data;
  }
}

module.exports = OpenGAppsDownload;
