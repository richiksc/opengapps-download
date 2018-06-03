const https = require('follow-redirects').https;
const fs = require('fs');
const path = require('path');
const md5 = require('md5');
const HumanFileSize = require('./lib/HumanFileSize');

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
function addZ(n){return n<10? '0'+n:''+n;}

function trackProgress(response, dataCb) {
  const pkgSize = parseInt(response.headers['content-length'], 10);
  const pkgSizeHuman = HumanFileSize.auto(pkgSize);
  let totalSent = 0;
  const maxDots = process.stdout.columns / 2;
  response.on('data', (chunk) => {
    totalSent += chunk.length;
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout
      .write(`${ Math.round((totalSent / pkgSize) * 100) }%  ${HumanFileSize.humanize(totalSent, pkgSizeHuman.unit).value} / ${pkgSizeHuman} `);
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
   */
  constructor(config) {
    this.config = config;
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
      let releaseData = '';
      res.on('data', (chunk) => {
        releaseData += chunk;
      });
      res.on('end', () => {
        const latestReleaseTag = JSON.parse(releaseData).tag_name;
        this.downloadGApps(latestReleaseTag);
      });
    });
  }

  downloadGApps(release) {
    const today = new Date();
    const dldir = `${today.getFullYear()}${months[today.getMonth()]}_${addZ(today.getDate())}`;
    if(!fs.existsSync(dldir)) fs.mkdirSync(dldir);
    console.log(`Downloading OpenGApps from release ${release} to directory ${dldir}/`);

    this.downloadSum(dldir, release, (checksum) => {
      this.downloadPackage(dldir, release, (filename) => {
        fs.readFile(dldir + path.sep + filename, (err, buf) => {
          if (err == null) {
            console.log('Verifying integrity with MD5 checksums...');
            console.log(checksum, '..........', md5(buf));
            console.log(checksum )
          } else console.error(err);
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
        trackProgress(response, (chunk) => { incoming += chunk; });
        response.on('end', () => {
          md5sum = incoming.split(' ')[0];
          console.log('\nMD5 checksum downloaded to ', dldir, '/', md5FileName);
          console.log('Checksum: ', md5sum);
          process.removeAllListeners('SIGINT');
          if (cb != null) cb(md5sum);
        });
      } else {
        console.error('Request failed ', response.statusCode, ' ', md5FileName);
      }
    });
    process.on('SIGINT', () => {
      md5Request.abort();
      md5File.close();
      process.exit();
    });
  }

  downloadPackage(dldir, release, cb) {
    const packageFileName = `open_gapps-${this.config.arch}-${this.config.api}-${this.config.variant}-${release}.zip`;

    let packageFile = fs.createWriteStream(packageFileName);
    const pkgRequest = https.get(`${this.baseUrl}/${release}/${packageFileName}`, (response) => {
      console.log(`Downloading OpenGApps package to ${dldir}/${packageFileName}...`);
      if (response.statusCode === 200) {
        response.pipe(packageFile);
        trackProgress(response);
        response.on('end', () => {
          console.log(
            `\n${this.config.variant} OpenGApps package for Android ${this.config.api} ${this.config.arch} downloaded to `,
            dldir, '/', packageFileName
          );
          process.removeAllListeners('SIGINT');
          if (cb != null) cb(packageFileName);
        });
      } else {
        console.error('Request failed ', response.statusCode, ' ', packageFileName);
      }
    });
    process.on('SIGINT', () => {
      pkgRequest.abort();
      packageFile.close();
      process.exit();
    });
  }
}

module.exports = OpenGAppsDownload;
