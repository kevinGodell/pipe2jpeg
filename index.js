'use strict';

const { Transform } = require('stream');

const { deprecate } = require('util');

const _SOI = Buffer.from([0xff, 0xd8]); // jpeg start of image ffd8
const _EOI = Buffer.from([0xff, 0xd9]); // jpeg end of image ffd9

/**
 * @fileOverview Creates a stream transform for parsing piped JPEGs from [FFmpeg]{@link https://ffmpeg.org/}.
 * @requires stream.Transform
 */
class Pipe2Jpeg extends Transform {
  /**
   *
   * @param {Object} [options]
   * @param {Boolean} [options.readableObjectMode=false] - If true, output will be an object instead of a buffer.
   * @param {Boolean} [options.bufferConcat=false] - If true, concatenate array of buffers before output. <br/>(readableObjectMode must be true to have any effect)
   * @param {Number} [options.byteOffset=200] - Number of bytes to skip when searching for EOI. <br/>Default: 200, Min: 0, Max: 1000000
   * @returns {Pipe2Jpeg}
   */
  constructor(options) {
    options = options && typeof options === 'object' ? options : {};
    super({ readableObjectMode: options.readableObjectMode === true });
    this._buffers = [];
    this._size = 0;
    this._byteOffset = 200;
    this._markerSplit = false;
    this._findStart = true;
    this.on('newListener', event => {
      if (event === 'jpeg') {
        deprecate(() => {}, '"jpeg" event will be removed in version 0.4.0. Please use "data" event.')();
      }
    });
    this.byteOffset = options.byteOffset;
    if (options.readableObjectMode === true) {
      if (options.bufferConcat === true) {
        this._sendJpeg = this._sendJpegBufferObject;
      } else {
        this._sendJpeg = this._sendJpegListObject;
      }
    } else {
      this._sendJpeg = this._sendJpegBuffer;
    }
  }

  /**
   * @property {Number} byteOffset
   * - Number of bytes to skip when searching for EOI.
   * <br/>
   * - Default: 200, Min: 0, Max: 1000000.
   */
  get byteOffset() {
    return this._byteOffset;
  }

  set byteOffset(n) {
    this._byteOffset = Pipe2Jpeg._valInt(n, 200, 0, 1000000);
  }

  /**
   * @readonly
   * @property {Array|Null} list
   * - Returns the latest JPEG as an array of buffers.
   * <br/>
   * - Returns <b>Null</b> unless readableObjectMode is true and bufferConcat is false.
   * <br/>
   * - Returns <b>Null</b> if requested before first JPEG parsed from stream.
   * @returns {Array|Null}
   */
  get list() {
    return this._list || null;
  }

  /**
   * @readonly
   * @property {Number} totalLength
   * - Returns the total length of all the buffers in the list.
   * @returns {Number}
   */
  get totalLength() {
    return this._totalLength || 0;
  }

  /**
   * @readonly
   * @property {Buffer|Null} jpeg
   * - Returns the latest JPEG as a single buffer.
   * <br/>
   * - Returns <b>Null</b> if readableObjectMode is true and bufferConcat is false.
   * <br/>
   * - Returns <b>Null</b> if requested before first JPEG parsed from stream.
   * @returns {Buffer|Null}
   */
  get jpeg() {
    return this._jpeg || null;
  }

  /**
   * @readonly
   * @property {Number} timestamp
   * - Returns the timestamp of the latest JPEG as an Integer(milliseconds).
   * <br/>
   * - Returns <b>-1</b> if requested before first JPEG is parsed from stream.
   * @returns {Number}
   */
  get timestamp() {
    return this._timestamp || -1;
  }

  /**
   *
   * @private
   */
  _sendJpegBuffer() {
    this._jpeg = this._buffers.length > 1 ? Buffer.concat(this._buffers, this._size) : this._buffers[0];
    this.emit('data', this._jpeg);
    // support deprecated jpeg event until 0.4.0
    this.emit('jpeg', this._jpeg);
  }

  /**
   *
   * @private
   */
  _sendJpegBufferObject() {
    this._jpeg = this._buffers.length > 1 ? Buffer.concat(this._buffers, this._size) : this._buffers[0];
    this.emit('data', { jpeg: this._jpeg });
  }

  /**
   *
   * @private
   */
  _sendJpegListObject() {
    this._list = this._buffers;
    this._totalLength = this._size;
    this.emit('data', { list: this._list, totalLength: this._totalLength });
  }

  /**
   *
   * @param {Buffer} chunk
   * @param {Number} pos
   * @returns {{foundEOI:boolean,newPos:number}}
   * @private
   */
  _findEOI(chunk, pos) {
    if (this._markerSplit === true && chunk[0] === _EOI[1]) {
      return { foundEOI: true, newPos: 1 };
    }
    const eoi = chunk.indexOf(_EOI, pos);
    if (eoi !== -1) {
      return { foundEOI: true, newPos: eoi + 2 };
    }
    return { foundEOI: false, newPos: -1 };
  }

  /**
   *
   * @param {Buffer} chunk
   * @param encoding
   * @param callback
   * @private
   */
  _transform(chunk, encoding, callback) {
    const chunkLen = chunk.length;
    let pos = 0;
    let soi = 0;
    while (true) {
      if (this._findStart === true) {
        // searching for soi
        if (this._markerSplit === true && chunk[0] === _SOI[1]) {
          pos = 1 + this._byteOffset;
          this._buffers = [_SOI.subarray(0, 1)];
          this._size = 1;
          this._findStart = this._markerSplit = false;
          continue;
        }
        soi = chunk.indexOf(_SOI, pos);
        if (soi !== -1) {
          pos = soi + 2 + this._byteOffset;
          this._findStart = this._markerSplit = false;
          continue;
        }
        this._markerSplit = chunk[chunkLen - 1] === _SOI[0];
        break;
      } else {
        if (this._size + chunkLen >= this._byteOffset) {
          const { foundEOI, newPos } = this._findEOI(chunk, pos);
          if (foundEOI === true) {
            this._timestamp = Date.now();
            pos = newPos;
            const endOfBuf = pos === chunkLen;
            const cropped = (this._size > 0 || soi === 0) && endOfBuf === true ? chunk : chunk.subarray(soi, pos);
            this._buffers.push(cropped);
            this._size += cropped.length;
            this._sendJpeg();
            this._buffers = [];
            this._size = 0;
            this._markerSplit = false;
            this._findStart = true;
            if (endOfBuf) {
              break;
            }
            continue;
          }
        }
        const cropped = soi === 0 ? chunk : chunk.subarray(soi);
        this._buffers.push(cropped);
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
    this._buffers = [];
    this._size = 0;
    this._markerSplit = false;
    this._findStart = true;
    delete this._totalLength;
    delete this._list;
    delete this._jpeg;
    delete this._timestamp;
  }

  /**
   * Validate integer is in range.
   * @param {*} n
   * @param {Number} def
   * @param {Number} min
   * @param {Number} max
   * @returns {Number}
   * @private
   * @static
   */
  static _valInt(n, def, min, max) {
    n = Number.parseInt(n);
    return Number.isNaN(n) ? def : n < min ? min : n > max ? max : n;
  }
}

module.exports = Pipe2Jpeg;
