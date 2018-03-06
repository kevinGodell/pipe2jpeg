'use strict';

const {Transform} = require('stream');

const _SOI = new Buffer([0xff, 0xd8]);
const _EOI = new Buffer([0xff, 0xd9]);

class Pipe2Jpeg extends Transform {

    /**
     *
     * @param options
     */
    constructor(options) {
        super(options);
        this._chunks = [];
        this._size = 0;
    }

    /**
     *
     * @return {*|null}
     */
    get jpeg() {
        return this._jpeg || null;
    }

    /**
     *
     * @return {number | *}
     */
    get timestamp() {
        return this._timestamp || -1;
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
                    this._timestamp = Date.now();
                    this._chunks = [];
                    this._size = 0;
                    if (this._readableState.pipesCount > 0) {
                        this.push(this._jpeg);
                    }
                    if (this.listenerCount('jpeg') > 0) {
                        this.emit('jpeg', this._jpeg);
                    }
                    if (pos === chunkLength) {
                        break;
                    }
                }
            } else {
                const soi = chunk.indexOf(_SOI, pos);
                if (soi === -1) {
                    break;
                } else {
                    //todo might add option or take sample average / 2 to jump position for small gain
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
                    this._timestamp = Date.now();
                    if (this._readableState.pipesCount > 0) {
                        this.push(this._jpeg);
                    }
                    if (this.listenerCount('jpeg') > 0) {
                        this.emit('jpeg', this._jpeg);
                    }
                    if (pos === chunkLength) {
                        break;
                    }
                }
            }
        }
        callback();
    }
}

/**
 *
 * @type {Pipe2Jpeg}
 */
module.exports = Pipe2Jpeg;