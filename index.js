'use strict';

const { Transform } = require('stream');

const { deprecate } = require('util');

const _SOI = Buffer.from([0xff, 0xd8]); // jpeg start of image ffd8
const _EOI = Buffer.from([0xff, 0xd9]); // jpeg end of image ffd9

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
    this._byteOffset = 200;
    this._markerSplit = false;
    this._findStart = true;
    this.on('newListener', event => {
      if (event === 'jpeg') {
        deprecate(() => {}, '"jpeg" event will be removed in version 0.4.0. Please use "data" event.')();
      }
    });
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
    this.emit('jpeg', this._jpeg);
    this.emit('data', this._jpeg);
  }

  /**
   *
   * @param chunk
   * @param encoding
   * @param callback
   * @private
   */
  _transform(chunk, encoding, callback) {
    const chunkLen = chunk.length;
    let pos = 0;
    let soi = -1;
    let eoi = -1;
    while (true) {
      if (this._findStart === true) {
        // searching for soi
        if (this._markerSplit === true && chunk[0] === _SOI[1]) {
          pos = 1 + this._byteOffset;
          this._chunks.push(_SOI.subarray(0, 1));
          this._size = 1;
          this._findStart = false;
          this._markerSplit = false;
          continue;
        }
        soi = chunk.indexOf(_SOI, pos);
        if (soi !== -1) {
          pos = soi + 2 + this._byteOffset;
          this._findStart = false;
          this._markerSplit = false;
          continue;
        }
        this._markerSplit = chunk[chunkLen - 1] === _SOI[0];
        break;
      } else {
        // searching for eoi
        if (this._markerSplit === true && chunk[0] === _EOI[1]) {
          pos = 1;
          const cropped = pos === chunkLen ? chunk : chunk.subarray(0, pos);
          this._chunks.push(cropped);
          this._size += cropped.length;
          this._jpeg = Buffer.concat(this._chunks, this._size);
          this._sendJpeg();
          this._size = 0;
          this._chunks = [];
          this._markerSplit = false;
          this._findStart = true;
          if (pos === chunkLen) {
            break;
          }
          continue;
        }
        eoi = chunk.indexOf(_EOI, pos);
        if (eoi !== -1) {
          pos = eoi + 2;
          if (this._size) {
            const cropped = pos === chunkLen ? chunk : chunk.subarray(0, pos);
            this._chunks.push(cropped);
            this._size += cropped.length;
            this._jpeg = Buffer.concat(this._chunks, this._size);
            this._sendJpeg();
            this._size = 0;
            this._chunks = [];
          } else {
            this._jpeg = soi === 0 && pos === chunkLen ? chunk : chunk.subarray(soi, pos);
            this._sendJpeg();
          }
          this._markerSplit = false;
          this._findStart = true;
          if (pos === chunkLen) {
            break;
          }
          continue;
        }
        const cropped = soi <= 0 ? chunk : chunk.subarray(soi);
        this._chunks.push(cropped);
        this._size += cropped.length;
        this._markerSplit = chunk[chunkLen - 1] === _EOI[0];
        break;
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
    this._markerSplit = false;
    this._findStart = true;
    delete this._jpeg;
    delete this._timestamp;
  }
}

module.exports = Pipe2Jpeg;
