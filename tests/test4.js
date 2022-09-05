'use strict';

console.time('==========> single jpeg packed into single piped chunk');

const assert = require('assert');

const { Writable } = require('stream');

const Pipe2Jpeg = require('..');

const soi = Buffer.from([0xff, 0xd8]);

const eoi = Buffer.from([0xff, 0xd9]);

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const { spawn } = require('child_process');

const jpegCount = 10;

const fps = 1;

const scale = 1 / 50;

let jpegCounter = 0;

const params = [
  /* log info to console */
  '-loglevel',
  'error',
  '-nostats',

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
  'pipe:1',
];

const p2j = new Pipe2Jpeg();

const myStream = new Writable();

myStream._write = (jpeg, encoding, callback) => {
  jpegCounter++;
  const length = jpeg.length;
  assert(jpeg[0] === 0xff, 'jpeg[0] not equal to 0xFF');
  assert(jpeg[1] === 0xd8, 'jpeg[1] not equal to 0xD8');
  assert(jpeg[length - 2] === 0xff, 'jpeg[length - 1] not equal to 0xFF');
  assert(jpeg[length - 1] === 0xd9, 'jpeg[length - 1] not equal to 0xD9');
  assert(jpeg.indexOf(soi) === jpeg.lastIndexOf(soi));
  assert(jpeg.indexOf(eoi) === jpeg.lastIndexOf(eoi));
  callback();
};

const ffmpeg = spawn(ffmpegPath, params, { stdio: ['ignore', 'pipe', 'inherit'] });

ffmpeg.on('error', error => {
  console.log(error);
});

ffmpeg.on('exit', (code, signal) => {
  assert(code === 0, `FFMPEG exited with code ${code} and signal ${signal}`);
  assert(jpegCounter === jpegCount, `did not get ${jpegCount} jpegs`);
  console.timeEnd('==========> single jpeg packed into single piped chunk');
});

ffmpeg.stdout.pipe(p2j);

p2j.pipe(myStream);
