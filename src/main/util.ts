/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';
import { BrowserWindow, dialog } from 'electron';

import i18n from '../i18n';

export function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export function convertNumberToDecimal(fobNumber: string) {
  return parseInt(fobNumber, 16).toString().padStart(10, '0');
}

export function convertNumbersToDecimal(fobNumbers: string[]) {
  return fobNumbers.map((fobNumber) => convertNumberToDecimal(fobNumber));
}

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

export async function alert(type: string, message: string) {
  const title = type[0].toUpperCase() + type.slice(1);
  return dialog.showMessageBox(
    new BrowserWindow({
      show: false,
      alwaysOnTop: true,
    }),
    {
      type,
      title,
      message,
    }
  );
}

export async function alertUploadFailed(
  message: string,
  fobNumber: string
): Promise<{ response: number }> {
  const num = convertNumberToDecimal(fobNumber);
  return dialog.showMessageBox(
    new BrowserWindow({
      show: false,
      alwaysOnTop: true,
    }),
    {
      type: 'error',
      title: i18n.t('error'),
      message: `${i18n.t('uploadFailedMessage', { num })} ${message}\n${i18n.t(
        'retryMessage'
      )}`,
      buttons: [i18n.t('retry'), i18n.t('cancel')],
    }
  );
}

export async function alertWarning(
  message: string
): Promise<{ response: number }> {
  return dialog.showMessageBox(
    new BrowserWindow({
      show: false,
      alwaysOnTop: true,
    }),
    {
      type: 'warning',
      title: i18n.t('warning'),
      message,
      buttons: [i18n.t('yes'), i18n.t('cancel')],
    }
  );
}
