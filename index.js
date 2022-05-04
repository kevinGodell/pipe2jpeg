'use strict';

const { Transform } = require('stream');

const _SOI = Buffer.from([0xff, 0xd8]); // jpeg start of image ff08
const _EOI = Buffer.from([0xff, 0xd9]); // jpeg end of image ff09

/**
 * @fileOverview Creates a stream transform for parsing piped jpegs from ffmpeg.
 * @requires stream.Transform
 */
class Pipe2Jpeg extends Transform {
  /**
   *
   * @param [options] {Object}
   * @returns {Pipe2Jpeg}
   */
  constructor(options) {
    super(options);
    this._chunks = [];
    this._size = 0;

    this._lastJpegSize = 0;
    this._lastByte = null;
  }

  /**
   * @readonly
   * @property {Buffer} jpeg
   * - Returns the latest Jpeg as a Buffer.
   * <br/>
   * - Returns <b>Null</b> if requested before Jpeg parsed from stream.
   * @returns {Buffer}
   */
  get jpeg() {
    return this._jpeg || null;
  }

  /**
   * @readonly
   * @property {Number} timestamp
   * - Returns the timestamp of the latest Jpeg as an Integer(milliseconds).
   * <br/>
   * - Returns <b>-1</b> if requested before Jpeg parsed from stream.
   * @returns {Number}
   */
  get timestamp() {
    return this._timestamp || -1;
  }

  /**
   *
   * @private
   */
  _sendJpeg() {
    this._timestamp = Date.now();
    if (this._readableState.pipesCount > 0) {
      this.push(this._jpeg);
    }
    this.emit('jpeg', this._jpeg);
    this._lastJpegSize = this._jpeg.length;
  }

  /**
   *
   * @param chunk
   * @param encoding
   * @param callback
   * @private
   */
  _transform(chunk, encoding, callback) {
    let chunkLength = chunk.length;
    let pos = 0;
    while (true) {
      if (this._size) {
        const lastChunk = this._chunks[this._chunks.length - 1];
        const lastByte = lastChunk[lastChunk.length - 1];
        if (lastByte === _EOI[0] && chunk[0] === _EOI[1]) {
          // EOI was split across chunks, remove it from the previous chunk and add it to this one
          this._chunks[this._chunks.length - 1] = lastChunk.slice(0, lastChunk.length - 1);
          this._size -= 1;
          const startByte = Buffer.from([_EOI[0]]);
          chunk = Buffer.concat([startByte, chunk]);
          chunkLength += 1;
        }
        const eoi = chunk.indexOf(_EOI);
        if (eoi === -1) {
          this._chunks.push(chunk);
          this._size += chunkLength;
          break;
        } else {
          pos = eoi + 2;
          const sliced = chunk.slice(0, pos);
          this._chunks.push(sliced);
          this._size += sliced.length;
          this._jpeg = Buffer.concat(this._chunks, this._size);
          this._chunks = [];
          this._size = 0;
          this._sendJpeg();
          if (pos === chunkLength) {
            break;
          }
        }
      } else {
        if (pos > 0 && this._lastByte === _SOI[0] && chunk[0] === _SOI[1]) {
          // SOI was split across chunks
          const startByte = Buffer.from([_SOI[0]]);
          chunk = Buffer.concat([startByte, chunk]);
          chunkLength += 1;
          pos -= 1;
        }
        const soi = chunk.indexOf(_SOI, pos);
        if (soi === -1) {
          // save the last byte in case the soi is broken across chunks
          this._lastByte = chunk[chunkLength - 1];
          break;
        } else {
          // as an optimization, jump forward half of the previous jpeg size
          const stepForward = Math.floor(this._lastJpegSize / 2);
          pos = soi + stepForward;
        }
        const eoi = chunk.indexOf(_EOI, pos);
        if (eoi === -1) {
          const sliced = chunk.slice(soi);
          this._chunks = [sliced];
          this._size = sliced.length;
          break;
        } else {
          pos = eoi + 2;
          this._jpeg = chunk.slice(soi, pos);
          this._sendJpeg();
          if (pos === chunkLength) {
            break;
          }
        }
      }
    }
    callback();
  }

  /**
   * Clear cached values.
   */
  resetCache() {
    this._chunks = [];
    this._size = 0;
    delete this._jpeg;
    delete this._timestamp;
  }
}

module.exports = Pipe2Jpeg;
