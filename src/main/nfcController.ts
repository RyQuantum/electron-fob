import { WebContents } from 'electron';
import { NFC } from 'nfc-pcsc';
import EventEmitter from 'events';

import Encryption from './encryption';
import { alert } from './util';
import { Fob } from './db';

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

export default class NfcController extends EventEmitter {
  private webContents: WebContents;

  private nfc;

  private reader;

  private started = false;

  constructor(webContents: WebContents) {
    super();
    this.webContents = webContents;
  }

  initNfc = () => {
    this.nfc = new NFC();

    this.nfc.on('reader', async (reader) => {
      this.reader = reader;
      console.log(`device attached`, reader.reader.name);
      reader.autoProcessing = false;

      reader.on('card', async (card) => {
        const fobNumber = card.atr
          .slice(-5, -1)
          .reduce((prev: string, num: number) => num.toString(16) + prev, '');
        console.log(`card detected: ${fobNumber}`);
        this.webContents.send('card', fobNumber);
        if (!this.started) return;
        let fob = await Fob.findOne({ where: { fobNumber } });
        if (fob?.secret) {
          alert('error', 'The fob has been initialized');
          return;
        }
        if (!fob) {
          fob = await Fob.create({ fobNumber });
        }

        // let res = await this.selectFob(fob);
        await delay(120); // TODO find reset function if possible
        let res = await this.doExternalAuthentication(fob); // TODO test to check all error
        if (res === '6984') {
          res = await this.doExternalAuthentication(fob);
        }
        if (res === '6a88') {
          res = await this.createFile(fob);
          if (res !== '6a86' && res !== '9000') {
            alert('error', `Create File error: ${res}`);
            return;
          }
          res = await this.addSecret(fob);
          if (res !== '9000') {
            alert('error', `Add Secret error: ${res}`);
          }
        } else if (res !== '9000') {
          alert('error', `External authentication error: ${res}`);
        } else {
          res = await this.cleanData(fob);
          if (res !== '9000') {
            alert('error', `Clean data error: ${res}`);
            return;
          }
          res = await this.createFile(fob);
          if (res !== '9000') {
            alert('error', `Create file error: ${res}`);
            return;
          }
          res = await this.addSecret(fob); // TODO if not complete, add column to save secret to revert back
          if (res !== '9000') {
            alert('error', `Add Secret error: ${res}`);
          }
        }
      });

      reader.on('card.off', (card) => {
        console.log(
          `card removed:`,
          card.atr
            .slice(-5, -1)
            .reduce((prev: string, num: number) => num.toString(16) + prev, '')
        );
        this.webContents.send('card', '');
      });

      reader.on('error', (err: Error) => {
        console.log(`an error occurred`, reader.reader.name, err);
      });

      reader.on('end', () => {
        console.log(`device removed`, reader.reader.name);
      });
    });

    this.nfc.on('error', (err: Error) => {
      console.log(`an error occurred`, err);
    });
  };

  selectFob = async (fob: Fob) => {
    return this.transmit(fob, 'Select MF', '00A40000023F00');
  };

  doExternalAuthentication = async (fob: Fob) => {
    const res = await this.transmit(
      fob,
      'Get random numbers',
      '008400000400000000'
    );
    if (res.slice(-4) !== '9000') {
      return res;
    }
    const encryption = new Encryption('FFFFFFFFFFFFFFFF'); // TODO update to random 3DES key
    const randomStr = res.slice(0, 8);
    const encrypted = encryption.encryptDes(`${randomStr}00000000`);
    return this.transmit(
      fob,
      'External Authentication',
      `0082000008${encrypted}`
    );
  };

  cleanData = async (fob: Fob) => {
    return this.transmit(fob, 'Clean data', '800E000000');
  };

  createFile = async (fob: Fob) => {
    return this.transmit(fob, 'Create file', '80E00000073F005001F1FFFF');
  };

  addSecret = async (fob: Fob) => {
    const secret = 'FFFFFFFFFFFFFFFF';
    const res = await this.transmit(
      fob,
      'Add secret',
      `80D401000D39F0F1AAFF${secret}`
    );
    if (res === '9000') {
      await fob.update({ secret });
    }
    return res;
  };

  start = () => {
    this.started = true;
  };

  stop = () => {
    this.started = false;
  };

  transmit = async (fob: Fob, state: string, req: string) => {
    const reqBuffer = Buffer.from(req, 'hex');
    await this.display(fob, state, 'req', req);
    const res: string = (await this.reader.transmit(reqBuffer, 50)).toString(
      'hex'
    );
    await this.display(fob, state, 'res', res);
    return res;
  };

  display = async (
    fob: Fob,
    state: string,
    direction: 'req' | 'res',
    cmd: string
  ) => {
    if (direction === 'req') {
      console.log(`-- ${state} --`);
    }
    console.log(direction, cmd);
    if (direction === 'req') {
      await fob.update({ state: `${state}...` });
    } else {
      await fob.update({ state: `${state} - ${cmd.slice(-4)}` });
    }
    this.webContents.send('log', fob.toJSON(), direction);
  };
}
