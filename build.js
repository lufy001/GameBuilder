/* eslint-env node */

const appId = '1760394977391942';
const token = 'EAAYsfZAxiFmMBAKZCd7vqub0ldXs5HV8vbrZBIHryrxnbIqBM02j9u4qZAa7r0Nk9azwXZAtYyOZAbEgCZBOsgQSKEJBGrVy0Vl2H7s86qXhlKBlzYW15eIvJPSZACxZBLdcjuat7HFUkB1uuYxFnGDZCjST9ffB54C5V0MRgonJbXeQZDZD';
const chalk = require('chalk'),
      Promise = require('bluebird'),
      fs = require('fs-extra'),
      path = require('path'),
      dateFormat = require('dateformat'),
      execFile = require('child_process').execFile,
      walk = require('walk-promise'),
      pngquant = require('pngquant-bin'),
      //childProcess = require('child_process'),
      request = require('request-promise'),
      zipdir = require('zip-dir');
const argv = require('minimist')(process.argv.slice(2));
let gamePath = path.resolve(__dirname + '/../', argv._[0]);

let name = dateFormat(new Date(), 'yyyymmdd-hhmmss');
let basePath = `${gamePath}/build/${name}`;

fs.mkdirs(basePath)
  .then(() => {
    return copyGame(gamePath, name);
  })

  .then(() => {
    return walk(basePath);
  })
  .then((files) => {
    // Perform PNG compression
    let imageFiles = files.filter((file) => {
      return file.name.match(/\.png$/);
    });

    //const compressionBlacklist = config.has('postbuild.compression_blacklist') ? config.get('postbuild.compression_blacklist') : [];
    const compressionBlacklist = [];
    return handlePNGFiles(basePath, imageFiles, compressionBlacklist);
  })
  .then(() => {
    let src = basePath;
    let dest = `${basePath}.zip`;
    return zipFileAsync(src, dest);
  })
  .then(() => {
    return upload(appId, token, `${basePath}.zip`);
  });

/*function getPackageName(platform, environment) {
  return platform + '-' + environment + '-' + dateFormat(new Date(), 'yyyymmdd-hhmmss') + '.zip';
}*/
function copyGame(gamePath, name) {
  let files = ['index.html'];
  let dirs = [
    'src',
    'plugin',
    'resources'
  ];
  let promises = [];
  files.forEach((file) => {
    let src = `${gamePath}/${file}`;
    let dest = `${basePath}/${file}`;
    let promise = fs.copyFile(src, dest);
    promises.push(promise);
  });
  dirs.forEach((dir) => {
    let src = `${gamePath}/${dir}`;
    let dest = `${basePath}/${dir}`;
    let promise = fs.copy(src, dest);
    promises.push(promise);
  });
  return Promise.all(promises);
}
function zipFileAsync(src, dest) {
  return new Promise((resolve, reject) => {
    zipdir(src, { saveTo: dest }, function(err, buffer) {
      if (err) {
        reject();
      } else {
        resolve(dest);
      }
    });
  });
}
function handlePNGFiles(basePath, files, compressionBlacklist) {
  return Promise.mapSeries(
    files, 
    function handleFile(fileInfo) {

      let fullPath = path.join(fileInfo.root, fileInfo.name);
      let relativePath = fullPath.replace(basePath, '');
  
      if (compressionBlacklist[relativePath] === 'none') {
        return Promise.resolve();
      } else {
        return fs.stat(fullPath)
          .then((stat) => {
            let options = ['--ext=.png', '--force', fullPath];
            let blacklistItem = compressionBlacklist[relativePath];
            if (blacklistItem) {
              let matches = blacklistItem.match(/^[0-9]{1,3}$/);
              if (matches) {
                options.push(blacklistItem);
              } else {
                console.log(chalk.red('Warning: Compression option incorrect : ' + relativePath));
              }
            }
            options.push(fullPath);
            return new Promise((resolve, reject) => {
              execFile(pngquant, ['--ext=.png', '--force', fullPath], (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            });
          })
          .then(() => {
            return fs.stat(fullPath);
          });
      }
    });
}
/*
function getGitHash() {
  return new Promise((resolve, reject) => {
    childProcess.exec('git rev-parse HEAD', (err, stdout) => {
      if (!err) {
        resolve(stdout);
      } else {
        reject(err);
      }
    });
  });
}*/
function upload(appId, facebookUploadAccessToken, file) {
  return Promise.resolve()
    .then((commitHash) => {
      let stream = fs.createReadStream(file);
  
      let options = {
        method: 'POST',
        uri: `https://graph-video.facebook.com/${appId}/assets`,
        formData: {
          asset: {
            value: stream,
            options: {
              contentType: 'application/octet-stream',
            },
          },
          access_token: facebookUploadAccessToken,
          type: 'BUNDLE',
          comment: '',
        },
      };
  
      return request(options);
    });
}