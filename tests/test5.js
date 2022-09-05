'use strict';

const assert = require('assert');

const Pipe2jpeg = require('..');

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

let totalJpegs = 0;

const iterations = 100000;

const p2j = new Pipe2jpeg();

p2j.on('data', jpeg => {
  ++totalJpegs;
  // verify size, soi, and eoi
  assert(jpeg.length === size, `${jpeg.length} !== ${size}`);
  assert(jpeg.indexOf(soi) === jpeg.lastIndexOf(soi));
  assert(jpeg.indexOf(eoi) === jpeg.lastIndexOf(eoi));
});

console.time('Pipe2jpeg');

// each iteration pushes 11 fake jpegs
for (let i = 0; i < iterations; ++i) {
  p2j.write(buf0); // + 1
  p2j.write(buf1); // + 2
  p2j.write(buf2); // + 0.5
  p2j.write(buf3); // + 0.5
  p2j.write(buf4); // + 1.5
  p2j.write(buf5); // + 1.5
  p2j.write(buf4); // + 1.5
  p2j.write(buf3); // + 0.5
  p2j.write(buf2); // + 0.5
  p2j.write(buf5); // + 1.5
}

process.on('exit', code => {
  console.timeEnd('Pipe2jpeg');
  console.log({ totalJpegs, iterations });
  assert(totalJpegs === iterations * 11);
  console.log('exit', { code });
});
