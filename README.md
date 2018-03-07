# pipe2jpeg
###### [![Build Status](https://travis-ci.org/kevinGodell/pipe2jpeg.svg?branch=master)](https://travis-ci.org/kevinGodell/pipe2jpeg) [![Build status](https://ci.appveyor.com/api/projects/status/jbqs74nnvc1x7v9u/branch/master?svg=true)](https://ci.appveyor.com/project/kevinGodell/pipe2jpeg/branch/master) [![GitHub issues](https://img.shields.io/github/issues/kevinGodell/pipe2jpeg.svg)](https://github.com/kevinGodell/pipe2jpeg/issues) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/kevinGodell/pipe2jpeg/master/LICENSE)
Parse individual jpegs from an ffmpeg pipe when output codec(**-c:v**) is set to ***mjpeg*** and format(**-f**) is set to ***image2pipe***, ***singlejpeg***, ***mjpeg***, or ***mpjpeg***. All jpegs will be found regardless of size or fps. See [testing](https://www.npmjs.com/package/pipe2jpeg#testing) instructions for verification.
### installation:
``` 
npm install pipe2jpeg --save
```
### usage:
The following [example](https://github.com/kevinGodell/pipe2jpeg/blob/master/examples/example.js) uses ffmpeg's **testsrc** to simulate a video input and generate 100 downscaled jpeg images at a rate of 1 per second. The jpeg images are piped in from ffmpeg's stdout and parsed for the start of image(SOI) and end of image(EOI) file markers. Pipe2Jpeg dispatches a "jpeg" event that contains a complete jpeg image:
```
const P2J = require('pipe2jpeg');

const spawn = require('child_process').spawn;

let jpegCounter = 0;

const params = [
    /* log info to console */
    '-loglevel',
    'quiet',
    
    /* use an artificial video input */
    '-re',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=1920x1080:rate=15',

    /* set output flags */
    '-an',
    '-c:v',
    'mjpeg',
    '-pix_fmt',
    'yuvj422p',
    '-f',
    'image2pipe',//image2pipe, singlejpeg, mjpeg, or mpjpeg
    '-vf',
    'fps=1,scale=640:360',
    '-q',
    '1',
    '-frames',
    '100',
    'pipe:1'
];

const p2j = new P2J();

p2j.on('jpeg', (jpeg) => {
    console.log('received jpeg', ++jpegCounter);
});

const ffmpeg = spawn('ffmpeg', params, {stdio : ['ignore', 'pipe', 'ignore']});

ffmpeg.on('error', (error) => {
    console.log(error);
});

ffmpeg.on('exit', (code, signal) => {
    console.log('exit', code, signal);
});

ffmpeg.stdout.pipe(p2j);
```
### testing:
Clone the repository
```
git clone https://github.com/kevinGodell/pipe2jpeg.git
```
Change into the directory
```
cd pipe2jpeg
```
Initialize with npm
```
npm install
```
Start the tests
```
npm test
```