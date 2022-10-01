'use strict';

const { Transform } = require('stream');

const _SOI = Buffer.from([0xff, 0xd8]); // JPEG Start Of Image ffd8
const _EOI = Buffer.from([0xff, 0xd9]); // JPEG End Of Image ffd9
const _BYTE_OFFSET = { min: 0, max: 1000000, def: 200 }; // byteOffset limits

/**
 * @fileOverview Creates a stream transform for parsing piped JPEGs from [FFmpeg]{@link https://ffmpeg.org/}.
 * @requires stream.Transform
 */
class Pipe2Jpeg extends Transform {
  /**
   * @param {Object} [options]
   * @param {Boolean} [options.readableObjectMode=false] - If true, output will be an Object instead of a Buffer.
   * @param {Boolean} [options.bufferConcat=false] - If true, concatenate Array of Buffers before output. <br/>(readableObjectMode must be true to have any effect)
   * @param {Number} [options.byteOffset=200] - Number of bytes to skip when searching for the EOI. <br/>Min: 0, Max: 1000000, Default: 200
   */
  constructor(options) {
    options = options && typeof options === 'object' ? options : {};
    super({ writableObjectMode: false, readableObjectMode: options.readableObjectMode === true });
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
    this._buffers = [];
    this._size = 0;
    this._markerSplit = false;
    this._findStart = true;
  }

  /**
   * @property {Number} byteOffset
   * - Number of bytes to skip when searching for the EOI.
   * <br/>
   * - Min: 0, Max: 1000000, Default: 200.
   */
  get byteOffset() {
    return this._byteOffset;
  }

  set byteOffset(n) {
    this._byteOffset = Pipe2Jpeg._valInt(n, _BYTE_OFFSET.min, _BYTE_OFFSET.max, _BYTE_OFFSET.def);
  }

  /**
   * @readonly
   * @property {Array|Null} list
   * - Returns the latest JPEG as an Array of Buffers.
   * <br/>
   * - Returns <b>Null</b> unless readableObjectMode is true and bufferConcat is false.
   * <br/>
   * - Returns <b>Null</b> if requested before the first JPEG is parsed from the stream.
   * @returns {Array|Null}
   */
  get list() {
    return this._list || null;
  }

  /**
   * @readonly
   * @property {Number} totalLength
   * - Returns the total length of all the Buffers in the [list]{@link Pipe2Jpeg#list}.
   * @returns {Number}
   */
  get totalLength() {
    return this._totalLength || 0;
  }

  /**
   * @readonly
   * @property {Buffer|Null} jpeg
   * - Returns the latest JPEG as a single Buffer.
   * <br/>
   * - Returns <b>Null</b> if readableObjectMode is true and bufferConcat is false.
   * <br/>
   * - Returns <b>Null</b> if requested before the first JPEG is parsed from the stream.
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
   * - Returns <b>-1</b> if requested before the first JPEG is parsed from the stream.
   * @returns {Number}
   */
  get timestamp() {
    return this._timestamp || -1;
  }

  /**
   * Clears internally cached values.
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
   * @private
   */
  _sendJpegBuffer() {
    this._jpeg = this._buffers.length > 1 ? Buffer.concat(this._buffers, this._size) : this._buffers[0];
    this.emit('data', this._jpeg);
  }

  /**
   * @private
   */
  _sendJpegBufferObject() {
    this._jpeg = this._buffers.length > 1 ? Buffer.concat(this._buffers, this._size) : this._buffers[0];
    this.emit('data', { jpeg: this._jpeg });
  }

  /**
   * @private
   */
  _sendJpegListObject() {
    this._list = this._buffers;
    this._totalLength = this._size;
    this.emit('data', { list: this._list, totalLength: this._totalLength });
  }

  /**
   * @param {Buffer} chunk
   * @param {Number} pos
   * @returns {{foundEOI:Boolean,newPos:Number}}
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
   * @param {Buffer} chunk
   * @private
   */
  _parseJpeg(chunk) {
    const chunkLen = chunk.length;
    let pos = 0;
    let soi = 0;
    while (true) {
      if (this._findStart === true) {
        // searching for soi
        if (this._markerSplit === true && chunk[0] === _SOI[1]) {
          pos = this._byteOffset;
          this._buffers = [_SOI.subarray(0, 1)];
          this._size = 1;
          this._findStart = this._markerSplit = false;
          continue;
        }
        soi = chunk.indexOf(_SOI, pos);
        if (soi !== -1) {
          pos = soi + this._byteOffset;
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
  }

  /**
   * @param {Buffer} chunk
   * @param encoding
   * @param callback
   * @private
   */
  _transform(chunk, encoding, callback) {
    this._parseJpeg(chunk);
    callback();
  }

  /**
   * @param {*} n
   * @param {Number} min
   * @param {Number} max
   * @param {Number} def
   * @returns {Number}
   * @private
   * @static
   */
  static _valInt(n, min, max, def) {
    n = Number.parseInt(n);
    return Number.isNaN(n) ? def : n < min ? min : n > max ? max : n;
  }
}

/**
 * - Fires when a single JPEG is parsed from the stream.
 * <br/>
 * - Event payload will be different based on setting readableObjectMode and bufferConcat in the [constructor]{@link Pipe2Jpeg}.
 * @event Pipe2Jpeg#data
 * @type {Buffer|Object}
 * @property {Array} [list] - see [list]{@link Pipe2Jpeg#list}
 * @property {Number} [totalLength] - see [totalLength]{@link Pipe2Jpeg#totalLength}
 * @property {Buffer} [jpeg]- see [jpeg]{@link Pipe2Jpeg#jpeg}
 * @example
 * new Pipe2Jpeg({readableObjectMode: false})
 * // data event payload will be a single Buffer
 * @example new Pipe2Jpeg({readableObjectMode: true, bufferConcat: false})
 * // data event payload will be an Object {list:Array, totalLength:Number} containing an Array of Buffers and its total length
 * @example new Pipe2Jpeg({readableObjectMode: true, bufferConcat: true})
 * // data event payload will be an Object {jpeg:Buffer} containing a single Buffer
 */

module.exports = Pipe2Jpeg;
