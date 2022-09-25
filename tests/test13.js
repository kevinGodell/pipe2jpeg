'use strict';

const assert = require('assert');

const { basename } = require('path');

const Pipe2Jpeg = require('..');

const soi = Buffer.from([0xff, 0xd8]);

const eoi = Buffer.from([0xff, 0xd9]);

const size = 8192; // 65536 for linux, 8192 for mac

const fill = 0xee;

const buf0 = Buffer.alloc(size, fill);

const filler = Buffer.alloc(size, fill);

buf0[0] = soi[0];

buf0[1] = soi[1];

buf0[size - 2] = eoi[0];

buf0[size - 1] = eoi[1];

const buf1 = buf0.subarray(0, size / 2);

const buf2 = buf0.subarray(size / 2);

let totalJpegs = 0;

const iterations = 100000;

const p2j = new Pipe2Jpeg({ readableObjectMode: true, byteOffset: 500 });

let samples = [];

const calcByteOffset = ({ totalLength }) => {
  samples.push(totalLength);
  if (samples.length === 10) {
    let average = 0;
    samples.forEach(sampleSize => {
      average += sampleSize;
    });
    average = average / 10;
    p2j.byteOffset = average * 0.75;
    p2j.removeListener('data', calcByteOffset);
  }
};

p2j.on('data', calcByteOffset);

p2j.on('data', ({ list, totalLength }) => {
  ++totalJpegs;
  // verify size, soi, and eoi
  assert(totalLength === size * 30, `${totalLength} !== ${size * 30}`);
  // assert(jpeg.indexOf(soi) === jpeg.lastIndexOf(soi));
  // assert(jpeg.indexOf(eoi) === jpeg.lastIndexOf(eoi));
});

const consoleTime = basename(__filename);

console.time(consoleTime);

// each iteration pushes 1 fake jpegs
for (let i = 0; i < iterations; ++i) {
  p2j.write(buf1); // + 0.5                  0.5
  for (let i = 0; i < 29; ++i) {
    p2j.write(filler); // + 0                0.5
  }
  p2j.write(buf2); // + 0.5                  1.0
}

process.on('exit', code => {
  console.timeEnd(consoleTime);
  console.log({ totalJpegs, iterations });
  assert(totalJpegs === iterations);
  console.log('exit', { code });
});
