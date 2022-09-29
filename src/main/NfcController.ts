import { WebContents, ipcMain, IpcMainEvent } from 'electron';
import { NFC, Reader } from 'nfc-pcsc';
import { Op } from 'sequelize';
import crypto from 'crypto';

import * as api from './api';
import Encryption from './Encryption';
import {
  alert,
  alertWarning,
  alertUploadFailed,
  delay,
  convertNumberToDecimal,
} from './util';
import { Fob } from './db';
import i18n from '../i18n';
import ResponseError from './ResponseError';

export default class NfcController {
  private webContents: WebContents;

  private nfc: NFC = null;

  private reader: Reader = null;

  private isInitRunning = false;

  private isVerifying = false;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
    ipcMain.on('init', this.startInit);
    ipcMain.on('verify', this.startVerity);
    ipcMain.on('stop', this.stop);
  }

  startInit = (event: IpcMainEvent, args: [string]) => {
    const [fobNumber] = args;
    if (fobNumber !== '') {
      alert('error', i18n.t('removeFobMessage', { button: i18n.t('init') }));
      event.reply('init', false);
      return;
    }
    if (!this.reader) {
      alert('error', i18n.t('readerNotFoundMessage'));
      event.reply('init', false);
      return;
    }
    this.isInitRunning = true;
    event.reply('init', true);
  };

  startVerity = (event: IpcMainEvent, args: [string]) => {
    const [fobNumber] = args;
    if (fobNumber !== '') {
      alert('error', i18n.t('removeFobMessage', { button: i18n.t('verify') }));
      event.reply('verify', false);
      return;
    }
    if (!this.reader) {
      alert('error', i18n.t('readerNotFoundMessage'));
      event.reply('verify', false);
      return;
    }
    this.isVerifying = true;
    event.reply('verify', true);
  };

  stop = () => {
    this.isInitRunning = false;
    this.isVerifying = false;
    this.webContents.send('found', -1);
  };

  initNfc = () => {
    this.nfc = new NFC();

    this.nfc.on('reader', async (reader: Reader) => {
      this.reader = reader;
      console.log(`device attached`, reader.reader.name);
      reader.autoProcessing = false;

      reader.on('card', async (card) => {
        const fobNumber = card.atr
          .slice(-5, -1)
          .reduce((prev: string, num: number) => num.toString(16) + prev, '');
        console.log(`card detected: ${fobNumber}`);
        this.webContents.send('card', fobNumber);
        if (this.isVerifying) {
          const fob = await Fob.findOne({ where: { fobNumber } });
          if (fob) {
            const count = await Fob.count({
              where: { id: { [Op.lt]: fob.id } },
            });
            this.webContents.send('found', fob.id, count);
            if (!fob.initialized)
              alert('error', i18n.t('initializedIncorrectlyMessage'));
            else if (!fob.uploaded) {
              const num = convertNumberToDecimal(fob.fobNumber);
              const res = await alertWarning(
                i18n.t('uploadIncorrectlyMessage', { num })
              );
              if (res.response === 0) this.upload(fob);
            }
          } else alert('error', i18n.t('uninitializedMessage'));
        }
        if (!this.isInitRunning) return;
        this.webContents.send('initializing', true);

        try {
          let fob = await Fob.findOne({ where: { fobNumber } });
          if (fob?.uploaded) {
            alert('error', i18n.t('uploadedMessage'));
            return;
          }
          if (fob?.initialized) {
            const count = await Fob.count({
              where: { id: { [Op.lt]: fob.id } },
            });
            this.webContents.send('found', fob.id, count);
            const num = convertNumberToDecimal(fob.fobNumber);
            const res = await alertWarning(
              i18n.t('uploadIncorrectlyMessage', { num })
            );
            if (res.response === 0) this.upload(fob);
            return;
          }

          if (!fob) fob = await Fob.create({ fobNumber });

          await this.selectFolder(fob);
          await delay(150); // TODO find reset function if possible

          let res = await this.doExternalAuthentication(fob, fob.secret);
          if (res.slice(0, 3) === '63c') {
            // 63cx: Verify fail (0 <= x < 15, key invalid)
            alert(
              'error',
              `${i18n.t('externalAuthenticationError')}${i18n.t('res', {
                res: res === '' ? '""' : res,
              })}\n\n${i18n.t('reportBackMessage')}`
            );
          } else if (res === '6a88') {
            // 6a88: Referenced data not found (key not found)
            res = await this.createFile(fob);
            if (res !== '6a86' && res !== '9000') {
              // 6a86: Incorrect P1 or P2 parameter (the file has been created)
              alert(
                'error',
                `${i18n.t('createFileError')}${i18n.t('res', {
                  res: res === '' ? '""' : res,
                })}\n\n${i18n.t('reportBackMessage')}`
              );
              return;
            }
            await this.addSecret(fob);
            this.upload(fob);
          } else if (res !== '9000') {
            alert(
              'error',
              `${i18n.t('externalAuthenticationError')}${i18n.t('res', {
                res: res === '' ? '""' : res,
              })}\n\n${i18n.t('reportBackMessage')}`
            );
          } else {
            res = await this.cleanData(fob);
            res = await this.createFile(fob);
            if (res !== '9000') {
              alert(
                'error',
                `${i18n.t('createFileError')}${i18n.t('res', {
                  res: res === '' ? '""' : res,
                })}\n\n${i18n.t('reportBackMessage')}`
              );
              return;
            }
            await this.addSecret(fob);
            this.upload(fob);
          }
        } catch (err) {
          if (err instanceof ResponseError)
            alert(
              'error',
              `${i18n.t('unknownError')}${i18n.t('res', {
                res: err.res === '' ? '""' : err.res,
              })}\n\n${i18n.t('reportBackMessage')}`
            );
          else
            alert(
              'error',
              `${i18n.t('unknownError')}${JSON.stringify(err)}\n\n${i18n.t(
                'reportBackMessage'
              )}`
            );
        } finally {
          this.webContents.send('initializing', false);
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
        if (this.isVerifying) this.webContents.send('found', -1);
      });

      reader.on('error', (err: Error) => {
        console.log(`reader: an error occurred`, reader.reader.name, err);
        alert(
          'error',
          i18n.t('errorOccurredMessage', { name: reader.reader.name }) + err
        );
      });

      reader.on('end', () => {
        console.log(`device removed`, reader.reader.name);
        this.reader.removeAllListeners();
        this.reader = null;
        if (this.isInitRunning || this.isVerifying)
          alert('error', i18n.t('unplugReaderMessage'));
        this.isInitRunning = false;
        this.isVerifying = false;
        this.webContents.send('interrupt');
      });
    });

    this.nfc.on('error', (err: Error) => {
      console.log(`nfc: an error occurred`, err);
    });
  };

  selectFolder = async (fob: Fob) => {
    return this.transmit(fob, 'Select MF', '00A40000023F00');
  };

  doExternalAuthentication = async (fob: Fob, secret: string | null) => {
    const encryption = new Encryption(secret || 'FFFFFFFFFFFFFFFF');
    let times = 3;
    let res: string;
    /* eslint-disable no-await-in-loop */
    do {
      res = await this.transmit(fob, 'Get random number', '008400000400000000');
      const randomStr = res.slice(0, 8);
      const encrypted = encryption.encrypt(`${randomStr}00000000`);
      res = await this.transmit(
        fob,
        'External authentication',
        `0082000008${encrypted}`
      );
      times -= 1;
    } while (times > 0 && res === '6984'); // 6984: Reference data not usable (invalidated random number)
    /* eslint-enable no-await-in-loop */
    return res;
  };

  cleanData = async (fob: Fob) => {
    return this.transmit(fob, 'Clean data', '800E000000');
  };

  createFile = async (fob: Fob) => {
    return this.transmit(fob, 'Create file', '80E00000073F005001F1FFFF');
  };

  addSecret = async (fob: Fob) => {
    const secret = 'FFFFFFFFFFFFFFFF';
    // const secret = crypto.randomBytes(16).toString('hex').toUpperCase(); // TODO update it before release
    await fob.update({ secret });
    await this.transmit(fob, 'Add secret', `80D401000D39F0F1AAFF${secret}`);
    // await this.transmit(fob, 'Add secret', `80D401001539F0F1AAFF${secret}`);
    await fob.update({ initialized: true });
  };

  transmit = async (fob: Fob, state: string, req: string) => {
    const reqBuffer = Buffer.from(req, 'hex');
    await this.display(fob, state, 'req', req);
    const res: string = (await this.reader.transmit(reqBuffer, 50)).toString(
      'hex'
    );
    await this.display(fob, state, 'res', res);
    if (state === 'External authentication' || state === 'Create file')
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
      await fob.update({ state: `${state} - ${cmd.slice(-4) || '""'}` });
    }
    this.webContents.send('fob', fob.toJSON(), direction);
  };

  upload = async (fob: Fob) => {
    let resp = { response: 1 };
    /* eslint-disable no-await-in-loop */
    do {
      const res = await api.upload(fob);
      if (!res.success)
        resp = await alertUploadFailed(res.message, fob.fobNumber);
      else {
        await fob.update({ uploaded: true });
        const count = await Fob.count({
          where: { id: { [Op.lt]: fob.id } },
        });
        this.webContents.send('fob', fob.toJSON(), count);
      }
    } while (resp.response !== 1);
    /* eslint-enable no-await-in-loop */
  };
}
