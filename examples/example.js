'use strict';

const Pipe2Jpeg = require('..');

const { spawn } = require('child_process');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

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
  'testsrc=size=320x240:rate=25',

  /* set output flags */
  '-an',
  '-c:v',
  'mjpeg',
  '-pix_fmt',
  'yuvj420p', // yuvj420p, yuvj422p, yuvj444p
  '-f',
  'image2pipe', // image2pipe, singlejpeg, mjpeg, or mpjpeg
  '-vf',
  'fps=25,scale=500:500', // 'fps=1,scale=640:360',
  '-q',
  '31', // 2 - 31
  '-huffman',
  '1', // 0 - 1
  '-frames',
  '100',
  'pipe:1',
];

const p2j = new Pipe2Jpeg();

p2j.on('data', jpeg => {
  console.log('received jpeg', ++jpegCounter, jpeg.length);
});

const ffmpeg = spawn(ffmpegPath, params, { stdio: ['ignore', 'pipe', 'inherit'] });

ffmpeg.on('error', error => {
  console.log(error);
});

ffmpeg.on('exit', (code, signal) => {
  console.log('exit', code, signal);
});

ffmpeg.stdout.pipe(p2j);
