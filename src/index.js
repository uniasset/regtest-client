'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const assert = require('assert');
const rng = require('randombytes');
const bs58check = require('bs58check');
const dhttpCallback = require('dhttp/200');
let RANDOM_ADDRESS;
class RegtestUtils {
  constructor(_opts) {
    this.canlog =
      _opts && typeof _opts.log_requests !== undefined
        ? _opts.log_requests
        : false;
    this._APIURL =
      (_opts || {}).APIURL || process.env.APIURL || 'http://127.0.0.1:8080/1';
    this._APIPASS = (_opts || {}).APIPASS || process.env.APIPASS || 'satoshi';
    // regtest network parameters
    this.network =
      _opts && _opts.network
        ? _opts.network
        : {
            messagePrefix: '\x18Bitcoin Signed Message:\n',
            bech32: 'bcrt',
            bip32: {
              public: 0x043587cf,
              private: 0x04358394,
            },
            pubKeyHash: 0x6f,
            scriptHash: 0xc4,
            wif: 0xef,
          };
  }
  get RANDOM_ADDRESS() {
    if (RANDOM_ADDRESS === undefined) {
      RANDOM_ADDRESS = this.randomAddress();
    }
    return RANDOM_ADDRESS;
  }
  // use Promises
  async dhttp(options) {
    const self = this ? this : options.self;
    if (self && self.canlog) {
      console.log('regtest_client.dhttp() requested: ', {
        url: options.url,
        network: self.network,
      });
    }
    return new Promise((resolve, reject) => {
      return dhttpCallback(options, (err, data) => {
        if (err) {
          console.error('dhttp callback received error from server', {
            url: options.url,
            network: self ? self.network : undefined,
            err,
            response_data: data,
          });
          return reject(err);
        }
        return resolve(data);
      });
    });
  }
  async broadcast(txHex) {
    return this.dhttp({
      method: 'POST',
      url: this._APIURL + '/t/push',
      body: txHex,
    });
  }
  async mine(count) {
    return this.dhttp({
      method: 'POST',
      url: `${this._APIURL}/r/generate?count=${count}&key=${this._APIPASS}`,
    });
  }
  async height() {
    return this.dhttp({
      method: 'GET',
      url: this._APIURL + '/b/best/height',
    });
  }
  async fetch(txId) {
    return this.dhttp({
      method: 'GET',
      url: `${this._APIURL}/t/${txId}/json`,
    });
  }
  async unspents(address) {
    return this.dhttp({
      method: 'GET',
      url: `${this._APIURL}/a/${address}/unspents`,
    });
  }
  async faucet(address, value) {
    const requester = _faucetRequestMaker(
      'faucet',
      'address',
      this.dhttp,
      this._APIURL,
      this._APIPASS,
      this,
    );
    const faucet = _faucetMaker(this, requester);
    return faucet(address, value);
  }
  async faucetComplex(output, value) {
    const outputString = output.toString('hex');
    const requester = _faucetRequestMaker(
      'faucetScript',
      'script',
      this.dhttp,
      this._APIURL,
      this._APIPASS,
      this,
    );
    const faucet = _faucetMaker(this, requester);
    return faucet(outputString, value);
  }
  async verify(txo) {
    const tx = await this.fetch(txo.txId);
    const txoActual = tx.outs[txo.vout];
    if (txo.address) assert.strictEqual(txoActual.address, txo.address);
    if (txo.value) assert.strictEqual(txoActual.value, txo.value);
  }
  randomAddress() {
    // Fake P2PKH address with regtest/testnet version byte
    return bs58check.encode(Buffer.concat([Buffer.from([0x6f]), rng(20)]));
  }
}
exports.RegtestUtils = RegtestUtils;
function _faucetRequestMaker(name, paramName, dhttp, url, pass, utils) {
  return async (address, value) =>
    dhttp({
      utils,
      method: 'POST',
      url: `${url}/r/${name}?${paramName}=${address}&value=${value}&key=${pass}`,
      self: utils,
    });
}
function _faucetMaker(self, _requester) {
  return async (address, value) => {
    let count = 0;
    let _unspents = [];
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const randInt = (min, max) =>
      min + Math.floor((max - min + 1) * Math.random());
    while (_unspents.length === 0) {
      if (count > 0) {
        if (count >= 5) throw new Error('Missing Inputs');
        console.log('Missing Inputs, retry #' + count);
        await sleep(randInt(150 * 3, 250 * 3));
      }
      const txId = await _requester(address, value).then(
        v => v, // Pass success value as is
        async err => {
          // Bad Request error is fixed by making sure height is >= 432
          const currentHeight = await self.height();
          if (err.message === 'Bad Request' && currentHeight < 432) {
            if (self.canlog) {
              console.log('Facetmaker: waiting to mine up to 432 block');
            }
            await self.mine(432 - currentHeight);
            return _requester(address, value);
          }
          if (err.message === 'Bad Request' && currentHeight >= 432) {
            if (self.canlog) {
              console.log('Facetmaker: done mining up to 432 block');
            }
            return _requester(address, value);
          }
          console.error('Facetmaker error', err);
          throw err;
        },
      );
      await self.mine(1);
      await sleep(randInt(250, 750));
      const results = await self.unspents(address);
      if (self.canlog) {
        console.log('Facetmaker: UNfiltered results', {
          len: results.length,
          results,
        });
      }
      _unspents = results.filter(
        x => x.txId === txId && (x.height ? x.height >= 0 : false),
      );
      if (self.canlog) {
        console.log('Facetmaker: FILTERED results', {
          len: _unspents.length,
          _unspents,
        });
      }
      count++;
    }
    return _unspents.pop();
  };
}
