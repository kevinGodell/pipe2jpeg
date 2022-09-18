'use strict';

const assert = require('assert');

const Pipe2Jpeg = require('..');

const soi = Buffer.from([0xff, 0xd8]);

const eoi = Buffer.from([0xff, 0xd9]);

const size = 8192; // 65536 for linux, 8192 for mac

const fill = 0xee;

const buf0 = Buffer.alloc(size, fill);

buf0[0] = soi[0];

buf0[1] = soi[1];

buf0[size - 2] = eoi[0];

buf0[size - 1] = eoi[1];

const buf1 = Buffer.concat([buf0, buf0]);

const buf2 = buf0.subarray(0, size / 2);

const buf3 = buf0.subarray(size / 2);

const buf4 = Buffer.concat([buf0, buf2]);

const buf5 = Buffer.concat([buf3, buf0]);

const buf6 = buf0.slice(0, 1); // split soi

const buf7 = buf0.slice(1); // split soi

const buf8 = buf0.slice(0, size - 1); // split eoi

const buf9 = buf0.slice(size - 1); // split eoi

const buf10 = Buffer.concat([buf0, buf6]);

const buf11 = Buffer.concat([buf7, buf0]);

const buf12 = Buffer.concat([buf0, buf8]);

const buf13 = Buffer.concat([buf9, buf0]);

let totalJpegs = 0;

const iterations = 100000;

const p2j = new Pipe2Jpeg({ readableObjectMode: true, bufferConcat: true });

p2j.on('data', ({ jpeg }) => {
  ++totalJpegs;
  // verify size, soi, and eoi
  assert(jpeg.length === size, `${jpeg.length} !== ${size}`);
  // assert(jpeg.indexOf(soi) === jpeg.lastIndexOf(soi));
  // assert(jpeg.indexOf(eoi) === jpeg.lastIndexOf(eoi));
});

console.time('pipe2jpeg');

// each iteration pushes 11 fake jpegs
for (let i = 0; i < iterations; ++i) {
  p2j.write(buf0); // + 1                    1
  p2j.write(buf1); // + 2                    3
  p2j.write(buf2); // + 0.5                  3.5
  p2j.write(buf3); // + 0.5                  4
  p2j.write(buf4); // + 1.5                  5.5
  p2j.write(buf5); // + 1.5                  7
  p2j.write(buf4); // + 1.5                  8.5
  p2j.write(buf3); // + 0.5                  9
  p2j.write(buf2); // + 0.5                  9.5
  p2j.write(buf5); // + 1.5                  11

  p2j.write(buf6); // 0.1 split soi          11.1
  p2j.write(buf7); // 0.9 split soi          12

  p2j.write(buf8); // + 0.9 split eoi        12.9
  p2j.write(buf9); // + 0.1 split eoi        13

  p2j.write(buf10); // + 1 + 0.1 split soi   14.1
  p2j.write(buf11); // + 0.9 + 1 split soi   16

  p2j.write(buf12); // + 1 + 0.9 split eoi   17.9
  p2j.write(buf13); // + 0.1 + 1 split eoi   19
}

process.on('exit', code => {
  console.timeEnd('pipe2jpeg');
  console.log({ totalJpegs, iterations });
  assert(totalJpegs === iterations * 19);
  console.log('exit', { code });
});
