# pipe2jpeg
Parse individual jpegs from an ffmpeg pipe when output codec is set to mjpeg and format is set to image2pipe, singlejpeg, mjpeg, or mpjeg.
###installation:
``` 
npm install pipe2jpeg --save
```
###usage:
```
const spawn = require('child_process').spawn;

const P2j = require('pipe2jpeg');

const ffmpegParams = [
    '-loglevel',
    'quiet',
    '-max_delay',
    '0',
    '-f',
    'rtsp',
    '-rtsp_transport',
    'udp',
    '-stimeout',
    '10000000',
    '-i',
    'rtsp://192.168.1.8:554/user=admin_password=pass_channel=1_stream=0.sdp',
    '-an',
    '-c:v',
    'mjpeg',//mjpeg is default codec for jpeg
    '-f',
    'image2pipe',//image2pipe, singlejpeg, mjpeg, or mpjpeg
    '-r',
    '5',
    '-s',
    '640x360',
    'pipe:1'//output must be a pipe
];

const ffmpeg = spawn('ffmpeg', ffmpegParams);

const p2j = new P2j().on('jpeg', (jpeg) => {
    //will log size of jpeg and also show the SOI(0xFF, 0xD8) and EOI(0xFF, 0xD9) markers to verify 
    console.log('found jpeg', jpeg.length, jpeg[0], jpeg[1], jpeg[jpeg.length -2], jpeg[jpeg.length]);
});
    
ffmpeg.stdout.pipe(p2j);//target the pipe that was used in ffmpegParams, pipe:1 is stdout