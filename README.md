# pipe2jpeg
Parse individual jpegs from an ffmpeg pipe when output codec(-c:v) is set to ***mjpeg*** and format(-f) is set to ***image2pipe***, ***singlejpeg***, ***mjpeg***, or ***mpjpeg***. All jpegs will be found regardless of size or fps. See tests for verification.

### installation:
``` 
npm install pipe2jpeg --save
```
### usage:
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