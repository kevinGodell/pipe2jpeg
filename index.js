'use strict';

const Transform = require('stream').Transform;

class Pipe2Jpeg extends Transform {

    constructor(options) {
        super(options);
        this._buffer = null;
    }

    get jpeg() {
        return this._jpeg || null;
    }

    get timestamp() {
        return this._timestamp || -1;
    }

    _transform(chunk, encoding, callback) {
        for (let i = 0, soi, eoi, jpeg, length = chunk.length; i < length; i++) {
            if (this._buffer || chunk[soi = i] === 0xFF && chunk[i + 1] === 0xD8) {
                eoi = null;
                for (i; i < length; i++) {
                    if (chunk[i] === 0xFF && chunk[i + 1] === 0xD9) {
                        eoi = i + 2;
                        if (this._buffer) {
                            jpeg = Buffer.concat([this._buffer, chunk.slice(0, eoi)]);
                            this._buffer = null;
                        } else {
                            jpeg = chunk.slice(soi, eoi);
                        }
                        this._jpeg = jpeg;
                        this._timestamp = Date.now();
                        if (this._readableState.pipesCount > 0) {
                            this.push(jpeg);
                        }
                        if (this.listenerCount('jpeg') > 0) {
                            this.emit('jpeg', jpeg);
                        }
                        jpeg = null;
                        break;
                    }
                }
                if (!eoi) {
                    if (this._buffer) {
                        this._buffer = Buffer.concat([this._buffer, chunk]);
                    } else {
                        this._buffer = chunk.slice(soi);
                    }
                }
            }
        }
        callback();
    }

}

module.exports = Pipe2Jpeg;