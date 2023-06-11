'use strict';

console.time('🎉 =====> various_configs');

const assert = require('assert');

const { spawn } = require('child_process');

const ffmpegPath = require('../../lib/ffmpeg');

const Pipe2Jpeg = require('../../index');

const soi = Buffer.from([0xff, 0xd8]);

const eoi = Buffer.from([0xff, 0xd9]);

const frameLimit = 200;

const ffmpegConfigs = [
  { scale: 320, fps: 10 },
  { scale: 320, fps: 100 },
  { scale: 640, fps: 10 },
  { scale: 640, fps: 100 },
  { scale: 1280, fps: 10 },
  { scale: 1280, fps: 100 },
];

const pipe2jpegConfigs = [
  42,
  '42',
  undefined,
  null,
  {},
  { pool: 1 },
  { pool: 5 },
  { readableObjectMode: true },
  { readableObjectMode: true, bufferConcat: true },
  { readableObjectMode: true, bufferConcat: true, pool: 1 },
  { readableObjectMode: true, bufferConcat: true, pool: 5 },
];

(async () => {
  for (let i = 0, test = 0; i < pipe2jpegConfigs.length; ++i) {
    for (let j = 0; j < ffmpegConfigs.length; ++j, ++test) {
      const pipe2jpegConfig = pipe2jpegConfigs[i];

      const { fps, scale } = ffmpegConfigs[j];

      const consoleTime = `✅  test-${test}`;

      console.time(consoleTime);

      await new Promise((resolve, reject) => {
        let counter = 0;

        const params = [
          /* log info to console */
          '-loglevel',
          'quiet',
          '-nostats',

          /* use hardware acceleration if available */
          '-hwaccel',
          'auto',

          /* use an artificial video input */
          // '-re',
          '-f',
          'lavfi',
          '-i',
          'testsrc=size=1280x720:rate=20',

          /* set output flags */
          '-an',
          '-c:v',
          'mjpeg',
          '-f',
          'image2pipe',
          '-vf',
          `fps=${fps},scale=${scale}:-1,format=yuvj420p`,
          '-q', // quality
          '31', // 2 (high) to 31 (low)
          '-frames',
          frameLimit,
          'pipe:1',
        ];

        const pipe2jpeg = new Pipe2Jpeg(pipe2jpegConfig);

        pipe2jpeg.on('data', data => {
          counter++;

          const jpeg = Buffer.isBuffer(data) ? data : Buffer.isBuffer(data.jpeg) ? data.jpeg : Buffer.concat(data.list, data.totalLength);

          const length = jpeg.length;

          assert(jpeg[0] === 0xff, 'jpeg[0] not equal to 0xFF');

          assert(jpeg[1] === 0xd8, 'jpeg[1] not equal to 0xD8');

          assert(jpeg[length - 2] === 0xff, 'jpeg[length - 1] not equal to 0xFF');

          assert(jpeg[length - 1] === 0xd9, 'jpeg[length - 1] not equal to 0xD9');

          assert(jpeg.indexOf(soi) === jpeg.lastIndexOf(soi));

          assert(jpeg.indexOf(eoi) === jpeg.lastIndexOf(eoi));
        });

        pipe2jpeg.once('error', error => {
          reject(error);
        });

        const ffmpeg = spawn(ffmpegPath, params, {
          stdio: ['ignore', 'pipe', 'ignore'],
        });

        ffmpeg.once('error', error => {
          reject(error);
        });

        ffmpeg.once('exit', (code, signal) => {
          // console.log(pipe2jpeg.toJSON());

          assert(counter === frameLimit, `${counter} !== ${frameLimit}`);

          assert(code === 0, `FFMPEG exited with code ${code} and signal ${signal}`);

          resolve(i);
        });

        ffmpeg.stdio[1].pipe(pipe2jpeg, { end: true });
      });

      console.timeEnd(consoleTime);
    }
  }

  console.timeEnd('🎉 =====> various_configs');
})();

/*

ffmpeg -h encoder=mjpeg
Supported pixel formats: yuvj420p yuvj422p yuvj444p

ffmpeg -pix_fmts
FLAGS NAME            NB_COMPONENTS BITS_PER_PIXEL
IO... yuvj420p               3            12
IO... yuvj422p               3            16
IO... yuvj444p               3            24

*/
