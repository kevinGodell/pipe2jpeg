'use strict';

console.time('==========> single jpeg split between multiple piped chunks');

const assert = require('assert');

const P2J = require('..');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const spawn = require('child_process').spawn;

const jpegCount = 10;

const fps = 10;

const scale = 4;

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
  assert(jpeg[0] === 0xff, 'jpeg[0] not equal to 0xFF');
  assert(jpeg[1] === 0xd8, 'jpeg[1] not equal to 0xD8');
  assert(jpeg[length - 2] === 0xff, 'jpeg[length - 1] not equal to 0xFF');
  assert(jpeg[length - 1] === 0xd9, 'jpeg[length - 1] not equal to 0xD9');
});

const ffmpeg = spawn(ffmpegPath, params, { stdio: ['ignore', 'pipe', 'inherit'] });

ffmpeg.on('error', (error) => {
  console.log(error);
});

ffmpeg.on('exit', (code, signal) => {
  assert(code === 0, `FFMPEG exited with code ${code} and signal ${signal}`);
  assert(jpegCounter === jpegCount, `did not get ${jpegCount} jpegs`);
  console.timeEnd('==========> single jpeg split between multiple piped chunks');
});

ffmpeg.stdout.pipe(p2j);
