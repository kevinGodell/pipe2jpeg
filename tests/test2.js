// jshint esversion: 6, globalstrict: true, strict: true
'use strict';

console.time('==========> multiple jpegs packed into single piped chunk');

const assert = require('assert');

const P2J = require('../index');

const spawn = require('child_process').spawn;

const jpegCount = 10;

const fps = 100;

const scale = 1 / 50;

let jpegCounter = 0;

const params = [
    /* log info to console */
    '-loglevel',
    'quiet',
    '-stats',

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
    'image2pipe',
    '-vf',
    `fps=${fps},scale=iw*${scale}:ih*${scale}`,
    '-q',
    '1',
    '-frames',
    jpegCount,
    'pipe:1'
];

const p2j = new P2J();

p2j.on('jpeg', (jpeg) => {
    jpegCounter++;
    const length = jpeg.length;
    assert(jpeg[0] === 0xFF, 'jpeg[0] not equal to 0xFF');
    assert(jpeg[1] === 0xD8, 'jpeg[1] not equal to 0xD8');
    assert(jpeg[length - 2] === 0xFF, 'jpeg[length - 1] not equal to 0xFF');
    assert(jpeg[length - 1] === 0xD9, 'jpeg[length - 1] not equal to 0xD9');
});

const ffmpeg = spawn('ffmpeg', params, {stdio: ['ignore', 'pipe', 'inherit']});

ffmpeg.on('error', (error) => {
    console.log(error);
});

ffmpeg.on('exit', (code, signal) => {
    assert(code === 0, `FFMPEG exited with code ${code} and signal ${signal}`);
    assert(jpegCounter === jpegCount, `did not get ${jpegCount} jpegs`);
    console.timeEnd('==========> multiple jpegs packed into single piped chunk');
});

ffmpeg.stdout.pipe(p2j);