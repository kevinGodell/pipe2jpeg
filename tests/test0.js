'use strict';

const { readFileSync } = require('fs');

const jpegs = [readFileSync('small.jpeg'), readFileSync('large.jpeg')];

jpegs.forEach(jpeg => {
  for (let i = 0; i < jpeg.length; ++i) {
    if (jpeg[i] === 0xff && jpeg[i + 1] !== 0x00) {
      console.log(`found ff${jpeg[i + 1].toString(16).padStart(2, '0')} at ${i}`);
    }
  }
});

/*

https://www.w3.org/Graphics/JPEG/itu-t81.pdf

0xff 0xd8 at 0    SOI Start of image
0xff 0xe0 at 2    APP0 Reserved for application segments
0xff 0xfe at 20   COM Comment
0xff 0xdb at 38   DQT Define quantization table(s)
0xff 0xc4 at 107  DCT Define Huffman table(s)
0xff 0xc0 at 269  SOF0 Baseline DCT
0xff 0xda at 288  SOS Start of scan
0xff 0x00 at 796
0xff 0x00 at 996
0xff 0x00 at 1185
0xff 0xd9 at 1363 EOI End of image

 */
