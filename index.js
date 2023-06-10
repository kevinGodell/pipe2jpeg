'use strict';

const BufferPool = require('./lib/buffer-pool');

const { Transform } = require('stream');

/**
 * @fileOverview Creates a stream transform for parsing piped JPEGs from [FFmpeg]{@link https://ffmpeg.org/}.
 * @requires stream.Transform
 */
class Pipe2Jpeg extends Transform {
  /* ----> static private fields <---- */
  static #SOI = Pipe2Jpeg.#markerFrom([0xff, 0xd8]); // JPEG Start Of Image ffd8
  static #EOI = Pipe2Jpeg.#markerFrom([0xff, 0xd9]); // JPEG End Of Image ffd9
  static #BYTE_OFFSET = { min: 0, max: 1000000, def: 200 }; // byteOffset limits

  /* ----> private method placeholders <---- */
  #bufferConcat = Buffer.concat;
  #sendData = this.#sendAsBuffer;

  /* ----> private fields <---- */
  #bufferPool = undefined;
  #chunks = [];
  #chunksTotalLength = 0;
  #markerSplit = false;
  #findStart = true;

  /* ----> private fields with getter (readonly) <---- */
  #poolLength;
  #timestamp;
  #jpeg;
  #list;
  #totalLength;

  /* ----> private fields with getter and setter <---- */
  #byteOffset;

  /**
   * @param {object} [options]
   * @param {boolean} [options.readableObjectMode=false] - If true, output will be an Object instead of a Buffer.
   * @param {boolean} [options.bufferConcat=false] - If true, concatenate Array of Buffers before output. <br/>(readableObjectMode must be true to have any effect)
   * @param {number} [options.byteOffset=200] - Number of bytes to skip when searching for the EOI. <br/>Min: 0, Max: 1000000, Default: 200
   * @param {number} [options.pool=0] - Experimental buffer pool
   */
  constructor(options) {
    options = options instanceof Object ? options : {};
    super({ writableObjectMode: false, readableObjectMode: options.readableObjectMode === true });
    this.byteOffset = options.byteOffset;
    if (options.pool > 0 && (options.readableObjectMode !== true || options.bufferConcat === true)) {
      this.#poolLength = 2; // todo currently fixed count while experimental // options.pool + 1;
      this.#bufferPool = new BufferPool({ length: this.#poolLength });
      this.#bufferConcat = this.#bufferPool.concat.bind(this.#bufferPool);
    }
    if (options.readableObjectMode === true) {
      if (options.bufferConcat === true) {
        this.#sendData = this.#sendAsBufferObject;
      } else {
        this.#sendData = this.#sendAsListObject;
      }
    }
  }

  /**
   * @property {number} byteOffset
   * - Number of bytes to skip when searching for the EOI.
   * <br/>
   * - Min: 0, Max: 1000000, Default: 200.
   */
  get byteOffset() {
    return this.#byteOffset;
  }

  /**
   *
   * @param {number|string} n
   */
  set byteOffset(n) {
    this.#byteOffset = Pipe2Jpeg.#validateInt(n, Pipe2Jpeg.#BYTE_OFFSET.def, Pipe2Jpeg.#BYTE_OFFSET.min, Pipe2Jpeg.#BYTE_OFFSET.max);
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
    return this.#list || null;
  }

  /**
   * @readonly
   * @property {number} totalLength
   * - Returns the total length of all the Buffers in the [list]{@link Pipe2Jpeg#list}.
   * <br/>
   * - Returns <b>-1</b> if requested before the first JPEG is parsed from the stream.
   * @returns {number}
   */
  get totalLength() {
    return this.#totalLength || -1;
  }

  /**
   * @readonly
   * @property {number} poolLength
   * - Returns the number of array buffers in pool
   * <br/>
   * - Returns <b>-1</b> if pool not in use.
   * @returns {number}
   */
  get poolLength() {
    return this.#poolLength || -1;
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
    return this.#jpeg || null;
  }

  /**
   * @readonly
   * @property {number} timestamp
   * - Returns the timestamp of the latest JPEG as an Integer(milliseconds).
   * <br/>
   * - Returns <b>-1</b> if requested before the first JPEG is parsed from the stream.
   * @returns {number}
   */
  get timestamp() {
    return this.#timestamp || -1;
  }

  /**
   * Clears internally cached values.
   * @fires Pipe2Jpeg#reset
   */
  resetCache() {
    /*
    todo after version 0.5.0
    deprecate
    */
    this.reset();
  }

  /**
   * Clears internally cached values.
   * @fires Pipe2Jpeg#reset
   */
  reset() {
    this.emit('reset');
    this.#timestamp = undefined;
    this.#jpeg = undefined;
    this.#list = undefined;
    this.#totalLength = undefined;
    this.#chunks = [];
    this.#chunksTotalLength = 0;
    this.#markerSplit = false;
    this.#findStart = true;
  }

  /**
   *
   * @returns {object}
   */
  toJSON() {
    return {
      poolLength: this.poolLength,
      timestamp: this.timestamp,
      jpeg: this.jpeg,
      list: this.list,
      totalLength: this.totalLength,
    };
  }

  /**
   * @private
   */
  #sendAsBuffer() {
    this.#jpeg = this.#chunks.length > 1 ? this.#bufferConcat(this.#chunks, this.#chunksTotalLength) : this.#chunks[0];
    this.emit('data', this.#jpeg, { totalLength: this.#totalLength });
  }

  /**
   * @private
   */
  #sendAsBufferObject() {
    this.#jpeg = this.#chunks.length > 1 ? this.#bufferConcat(this.#chunks, this.#chunksTotalLength) : this.#chunks[0];
    this.emit('data', { jpeg: this.#jpeg, totalLength: this.#totalLength });
  }

  /**
   * @private
   */
  #sendAsListObject() {
    this.#list = this.#chunks;
    this.emit('data', { list: this.#list, totalLength: this.#totalLength });
  }

  /**
   * @param {Buffer} chunk
   * @param {number} pos
   * @returns {{foundEOI:boolean,newPos:number}}
   * @private
   */
  #findEOI(chunk, pos) {
    if (this.#markerSplit === true && chunk[0] === Pipe2Jpeg.#EOI[1]) {
      return { foundEOI: true, newPos: 1 };
    }
    const eoi = chunk.indexOf(Pipe2Jpeg.#EOI, pos);
    if (eoi !== -1) {
      return { foundEOI: true, newPos: eoi + 2 };
    }
    return { foundEOI: false, newPos: -1 };
  }

  /**
   * @param {Buffer} chunk
   * @private
   */
  #parseChunk(chunk) {
    const chunkLen = chunk.length;
    let pos = 0;
    let soi = 0;
    while (true) {
      if (this.#findStart === true) {
        // searching for soi
        if (this.#markerSplit === true && chunk[0] === Pipe2Jpeg.#SOI[1]) {
          pos = this.#byteOffset;
          this.#chunks = [Pipe2Jpeg.#SOI.subarray(0, 1)];
          this.#chunksTotalLength = 1;
          this.#findStart = this.#markerSplit = false;
          continue;
        }
        soi = chunk.indexOf(Pipe2Jpeg.#SOI, pos);
        if (soi !== -1) {
          pos = soi + this.#byteOffset;
          this.#findStart = this.#markerSplit = false;
          continue;
        }
        this.#markerSplit = chunk[chunkLen - 1] === Pipe2Jpeg.#SOI[0];
        break;
      } else {
        if (this.#chunksTotalLength + chunkLen >= this.#byteOffset) {
          const { foundEOI, newPos } = this.#findEOI(chunk, pos);
          if (foundEOI === true) {
            this.#timestamp = Date.now();
            pos = newPos;
            const endOfBuf = pos === chunkLen;
            const cropped = (this.#chunksTotalLength > 0 || soi === 0) && endOfBuf === true ? chunk : chunk.subarray(soi, pos);
            this.#chunks.push(cropped);
            this.#totalLength = this.#chunksTotalLength += cropped.length;
            this.#sendData();
            this.#chunks = [];
            this.#chunksTotalLength = 0;
            this.#markerSplit = false;
            this.#findStart = true;
            if (endOfBuf) {
              break;
            }
            continue;
          }
        }
        const cropped = soi === 0 ? chunk : chunk.subarray(soi);
        this.#chunks.push(cropped);
        this.#chunksTotalLength += cropped.length;
        this.#markerSplit = chunk[chunkLen - 1] === Pipe2Jpeg.#EOI[0];
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
    this.#parseChunk(chunk);
    callback();
  }

  /**
   * Validate number is in range.
   * @param {number|string} n
   * @param {number} def
   * @param {number} min
   * @param {number} max
   * @returns {number}
   * @private
   * @static
   */
  static #validateInt(n, def, min, max) {
    n = Number.parseInt(n);
    return Number.isNaN(n) ? def : n < min ? min : n > max ? max : n;
  }

  /**
   * Create marker Buffer.
   * @param {number[]} arr
   * @returns {Buffer}
   * @private
   * @static
   */
  static #markerFrom(arr) {
    const buffer = Buffer.allocUnsafeSlow(2);
    for (let i = 0; i < 2; ++i) {
      buffer[i] = arr[i];
    }
    return buffer;
  }
}

/**
 * - Fires when [resetCache]{@link Pipe2Jpeg#resetCache} is called.
 * @event Pipe2Jpeg#reset
 */

/**
 * - Fires when a single JPEG is parsed from the stream.
 * <br/>
 * - Event payload will be different based on setting readableObjectMode and bufferConcat in the [constructor]{@link Pipe2Jpeg}.
 * @event Pipe2Jpeg#data
 * @type {Buffer|object}
 * @property {Array} [list] - see [list]{@link Pipe2Jpeg#list}
 * @property {number} [totalLength] - see [totalLength]{@link Pipe2Jpeg#totalLength}
 * @property {Buffer} [jpeg]- see [jpeg]{@link Pipe2Jpeg#jpeg}
 * @example
 * new Pipe2Jpeg({readableObjectMode: false})
 * // data event payload will be a single Buffer
 * @example new Pipe2Jpeg({readableObjectMode: true, bufferConcat: false})
 * // data event payload will be an Object {list:Array, totalLength:number} containing an Array of Buffers and its total length
 * @example new Pipe2Jpeg({readableObjectMode: true, bufferConcat: true})
 * // data event payload will be an Object {jpeg:Buffer, totalLength:number} containing a single Buffer
 */

module.exports = Pipe2Jpeg;
