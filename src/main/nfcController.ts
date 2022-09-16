import { WebContents } from 'electron';
import { NFC } from 'nfc-pcsc';
import EventEmitter from 'events';

import Encryption from './encryption';
import { alert } from './util';
import { Fob } from './db';
import ResponseError from './ResponseError';

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
        try {
          let fob = await Fob.findOne({ where: { fobNumber } });
          if (fob?.uploaded) {
            alert('error', 'The fob has been uploaded');
            return;
          }

          if (!fob) fob = await Fob.create({ fobNumber });

          await this.selectFob(fob);
          await delay(200); // TODO find reset function if possible

          const secret = fob.secret && !fob.initialized ? fob.secret : null;
          let res = await this.doExternalAuthentication(fob, secret); // TODO test to check all error
          if (res.slice(0, 3) === '63c') {
            alert(
              'error',
              `External authentication error: res = ${res === '' ? '""' : res}`
            );
          } else if (res === '6a88') {
            // 6a88: key not found
            res = await this.createFile(fob);
            // 6a86: the param P1 or P2 is wrong (the file has been created)
            if (res !== '6a86' && res !== '9000') {
              alert(
                'error',
                `Create file error: res = ${res === '' ? '""' : res}`
              );
              return;
            }
            await this.addSecret(fob);
          } else if (res !== '9000') {
            alert(
              'error',
              `External authentication error: res = ${res === '' ? '""' : res}`
            );
          } else {
            res = await this.cleanData(fob);
            res = await this.createFile(fob);
            if (res !== '9000') {
              alert(
                'error',
                `Create file error: res = ${res === '' ? '""' : res}`
              );
              return;
            }
            await this.addSecret(fob);
            // TODO upload
          }
        } catch (err) {
          if (err instanceof ResponseError) {
            alert(
              'error',
              `${err.message}: res = ${err.res === '' ? '""' : err.res}`
            );
            return;
          }
          alert('error', JSON.stringify(err));
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
        console.log(`reader: an error occurred`, reader.reader.name, err);
      });

      reader.on('end', () => {
        console.log(`device removed`, reader.reader.name);
      });
    });

    this.nfc.on('error', (err: Error) => {
      console.log(`nfc: an error occurred`, err);
    });
  };

  selectFob = async (fob: Fob) => {
    return this.transmit(fob, 'Select MF', '00A40000023F00');
  };

  doExternalAuthentication = async (fob: Fob, secret: string | null) => {
    let res = await this.transmit(
      fob,
      'Get random numbers',
      '008400000400000000'
    );
    const encryption = new Encryption(secret || 'FFFFFFFFFFFFFFFF');
    let randomStr = res.slice(0, 8);
    let encrypted = encryption.encrypt(`${randomStr}00000000`);
    res = await this.transmit(
      fob,
      'External Authentication',
      `0082000008${encrypted}`
    );
    if (res === '6984') {
      res = await this.transmit(
        fob,
        'Get random numbers',
        '008400000400000000'
      );
      randomStr = res.slice(0, 8);
      encrypted = encryption.encrypt(`${randomStr}00000000`);
      return this.transmit(
        fob,
        'External Authentication',
        `0082000008${encrypted}`
      );
    }
    return res;
  };

  cleanData = async (fob: Fob) => {
    return this.transmit(fob, 'Clean data', '800E000000');
  };

  createFile = async (fob: Fob) => {
    return this.transmit(fob, 'Create file', '80E00000073F005001F1FFFF');
  };

  addSecret = async (fob: Fob) => {
    const secret = 'FFFFFFFFFFFFFFFF'; // TODO update to random 3DES key
    await fob.update({ secret });
    await this.transmit(fob, 'Add secret', `80D401000D39F0F1AAFF${secret}`);
    await fob.update({ initialized: true });
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
    if (state === 'External Authentication' || state === 'Create file')
      return res; // check the res in main func
    if (res === '') throw new ResponseError(`${state} error`, '""');
    if (res.slice(-4) !== '9000')
      throw new ResponseError(`${state} error`, res);
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
