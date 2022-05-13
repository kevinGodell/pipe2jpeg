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
  }

  /**
   *
   * @param chunk
   * @param encoding
   * @param callback
   * @private
   */
  _transform(chunk, encoding, callback) {
    const chunkLength = chunk.length;
    let pos = 0;
    while (true) {
      if (this._size) {
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
        const soi = chunk.indexOf(_SOI, pos);
        if (soi === -1) {
          break;
        } else {
          // todo might add option or take sample average / 2 to jump position for small gain
          pos = soi + 500;
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
    if(this.isPaused()){
      this.once("resume", callback)
    }
    else{
        callback()
    }
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
