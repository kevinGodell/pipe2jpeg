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
   * @param {Object} [options]
   * @param {Boolean} [options.readableObjectMode=false] - If true, output will be an object instead of a buffer.
   * @param {Boolean} [options.bufferConcat=false] - If true, concatenate array of buffers before output. (readableObjectMode must be true to have any effect)
   * @returns {Pipe2Jpeg}
   */
  constructor(options) {
    options = options && typeof options === 'object' ? options : {};
    super({ readableObjectMode: options.readableObjectMode === true });
    this._list = [];
    this._totalLength = 0;
    this._byteOffset = 200;
    this._markerSplit = false;
    this._findStart = true;
    this.on('newListener', event => {
      if (event === 'jpeg') {
        deprecate(() => {}, '"jpeg" event will be removed in version 0.4.0. Please use "data" event.')();
      }
    });
    if (this.readableObjectMode === true) {
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
   * @readonly
   * @property {Array} list
   * - Returns a reference to the array of buffers.
   * @returns {Array}
   */
  get list() {
    return this._list || [];
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
   * - Returns the latest Jpeg as a buffer.
   * <br/>
   * - Returns <b>Null</b> if readableObjectMode is true and bufferConcat is false.
   * <br/>
   * - Returns <b>Null</b> if requested before first Jpeg parsed from stream.
   * @returns {Buffer|Null}
   */
  get jpeg() {
    return this._jpeg || null;
  }

  /**
   * @readonly
   * @property {Number} timestamp
   * - Returns the timestamp of the latest Jpeg as an Integer(milliseconds).
   * <br/>
   * - Returns <b>-1</b> if requested before first Jpeg is parsed from stream.
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
    this._jpeg = this._list.length > 1 ? Buffer.concat(this._list, this._totalLength) : this._list[0];
    this.emit('data', this._jpeg);
    // support deprecated jpeg event until 0.4.0
    this.emit('jpeg', this._jpeg);
  }

  /**
   *
   * @private
   */
  _sendJpegBufferObject() {
    this._jpeg = this._list.length > 1 ? Buffer.concat(this._list, this._totalLength) : this._list[0];
    this.emit('data', { jpeg: this._jpeg });
  }

  /**
   *
   * @private
   */
  _sendJpegListObject() {
    this.emit('data', { list: this._list, totalLength: this._totalLength });
  }

  /**
   *
   * @private
   */
  _findEOI(pos, chunk) {
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
          this._list = [_SOI.subarray(0, 1)];
          this._totalLength = 1;
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
        // searching for eoi
        const { foundEOI, newPos } = this._findEOI(pos, chunk);
        if (foundEOI === true) {
          this._timestamp = Date.now();
          pos = newPos;
          const endOfBuf = pos === chunkLen;
          const cropped = (this._totalLength > 0 || soi === 0) && endOfBuf === true ? chunk : chunk.subarray(soi, pos);
          this._list.push(cropped);
          this._totalLength += cropped.length;
          this._sendJpeg();
          this._list = [];
          this._totalLength = 0;
          this._markerSplit = false;
          this._findStart = true;
          if (endOfBuf) {
            break;
          }
          continue;
        }
        const cropped = soi === 0 ? chunk : chunk.subarray(soi);
        this._list.push(cropped);
        this._totalLength += cropped.length;
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
    this._list = [];
    this._totalLength = 0;
    this._markerSplit = false;
    this._findStart = true;
    delete this._jpeg;
    delete this._timestamp;
  }
}

module.exports = Pipe2Jpeg;
