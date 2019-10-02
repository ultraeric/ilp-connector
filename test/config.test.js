'use strict';

const _ = require('lodash');
const Config = require('../src/services/config').default;
const expect = require('chai').expect;
const assert = require('chai').assert;
const logger = require('../src/common/log');
const logHelper = require('./helpers/log');
const env = _.cloneDeep(process.env);

describe('Config', function () {
  logHelper(logger);

  describe('parseConnectorConfig', function () {
    beforeEach(function () {
      process.env.CONNECTOR_ACCOUNTS = JSON.stringify({
        'usd-ledger': {
          relation: 'peer',
          assetCode: 'USD',
          assetScale: 4,
          plugin: 'ilp-plugin-mock',
          options: {}
        },
        'eur-ledger': {
          relation: 'peer',
          assetCode: 'EUR',
          assetScale: 4,
          plugin: 'ilp-plugin-mock',
          options: {}
        },
        'aud-ledger': {
          relation: 'peer',
          assetCode: 'AUD',
          assetScale: 4,
          plugin: 'ilp-plugin-mock',
          options: {}
        }
      });
      process.env.CONNECTOR_PAIRS = ''
    });

    afterEach(() => {
      process.env = _.cloneDeep(env)
    });

    describe('connector routes', () => {
      beforeEach(function () {
        this.routes = [{
          targetPrefix: 'a.',
          peerId: 'example.a'
        }]
      });

      afterEach(() => {
        process.env = _.cloneDeep(env)
      });

      it('parses routes correctly', function () {
        process.env.CONNECTOR_ROUTES = JSON.stringify(this.routes);
        const config = new Config();
        config.loadFromEnv();
        expect(config.get('routes'))
          .to.deep.equal(this.routes)
      });

      it('won\'t parse routes with invalid ledger', function () {
        this.routes[0].peerId = 'garbage!';
        process.env.CONNECTOR_ROUTES = JSON.stringify(this.routes);
        const config = new Config();
        assert.throws(() => {
          config.loadFromEnv()
        }, 'config failed to validate. error=should match pattern "^[a-zA-Z0-9._~-]+$" dataPath=.routes[0].peerId')
      });

      it('should not parse routes missing prefix', function () {
        this.routes[0].targetPrefix = undefined;
        process.env.CONNECTOR_ROUTES = JSON.stringify(this.routes);
        const config = new Config();
        assert.throws(() => {
          config.loadFromEnv()
        }, 'config failed to validate. error=should have required property \'targetPrefix\' dataPath=.routes[0]')
      });

      it('should not parse routes missing ledger', function () {
        this.routes[0].peerId = undefined;
        process.env.CONNECTOR_ROUTES = JSON.stringify(this.routes);

        const config = new Config();
        assert.throws(() => {
          config.loadFromEnv()
        }, 'config failed to validate. error=should have required property \'peerId\' dataPath=.routes[0]')
      })
    });

    describe('ledger credentials', () => {
      it('should parse ledger credentials', async function () {
        const accountCredentialsEnv = {
          'cad-ledger': {
            relation: 'peer',
            assetCode: 'CAD',
            assetScale: 9,
            plugin: 'ilp-plugin-mock',
            options: {
              account: 'http://cad-ledger.example:1000/accounts/mark',
              username: 'mark',
              password: 'mark'
            }
          },
          'usd-ledger': {
            relation: 'peer',
            assetCode: 'USD',
            assetScale: 9,
            plugin: 'ilp-plugin-mock',
            options: {
              account: 'http://cad-ledger.example:1000/accounts/mark',
              username: 'mark',
              cert: 'test/data/client1-crt.pem',
              key: 'test/data/client1-key.pem',
              ca: 'test/data/ca-crt.pem'
            }
          }
        };

        process.env.CONNECTOR_ACCOUNTS = JSON.stringify(accountCredentialsEnv);
        const config = new Config();
        config.loadFromEnv();

        const accountCredentials = {
          'cad-ledger': {
            relation: 'peer',
            assetCode: 'CAD',
            assetScale: 9,
            plugin: 'ilp-plugin-mock',
            options: {
              account: 'http://cad-ledger.example:1000/accounts/mark',
              username: 'mark',
              password: 'mark'
            }
          },
          'usd-ledger': {
            relation: 'peer',
            assetCode: 'USD',
            assetScale: 9,
            plugin: 'ilp-plugin-mock',
            options: {
              account: 'http://cad-ledger.example:1000/accounts/mark',
              username: 'mark',
              cert: 'test/data/client1-crt.pem',
              key: 'test/data/client1-key.pem',
              ca: 'test/data/ca-crt.pem'
            }
          }
        };

        expect(config.accounts)
          .to.deep.equal(accountCredentials)
      });

      it('should parse another type of ledger\'s credentials', async function () {
        const accountCredentialsEnv = {
          'cad-ledger': {
            relation: 'peer',
            assetCode: 'USD',
            assetScale: 9,
            plugin: 'ilp-plugin-mock',
            options: {
              token: 'iv8qhtm9qcmjmo8tcmjo4a',
              account: 'mark',
              type: 'other'
            }
          },
          'usd-ledger': {
            relation: 'peer',
            assetCode: 'USD',
            assetScale: 9,
            plugin: 'ilp-plugin-mock',
            options: {
              token: 'iv8qhtm9qcmjmo8tcmjo4a',
              account: 'mark',
              type: 'other'
            }
          }
        };

        process.env.CONNECTOR_ACCOUNTS = JSON.stringify(accountCredentialsEnv);
        const config = new Config();
        config.loadFromEnv();

        const accountCredentials = {
          'cad-ledger': {
            relation: 'peer',
            assetCode: 'USD',
            assetScale: 9,
            plugin: 'ilp-plugin-mock',
            options: {
              token: 'iv8qhtm9qcmjmo8tcmjo4a',
              account: 'mark',
              type: 'other'
            }
          },
          'usd-ledger': {
            relation: 'peer',
            assetCode: 'USD',
            assetScale: 9,
            plugin: 'ilp-plugin-mock',
            options: {
              token: 'iv8qhtm9qcmjmo8tcmjo4a',
              account: 'mark',
              type: 'other'
            }
          }
        };

        expect(config.accounts)
          .to.deep.equal(accountCredentials)
      })
    })
  })
});
