/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

import i18n from '../i18n';
import MenuBuilder from './menu';
import * as db from './db';
import * as api from './api';
import { alertWarning, convertNumbersToDecimal, resolveHtmlPath } from './util';
import NfcController from './NfcController';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    minWidth: 1024,
    height: 660,
    minHeight: 660,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      sandbox: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  const nfcController = new NfcController(mainWindow.webContents);

  mainWindow.on('ready-to-show', async () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
    nfcController.initNfc();
    const fobs = await db.load();
    mainWindow.webContents.send('fobs', fobs);
  });

  mainWindow.on('close', async (e) => {
    e.preventDefault();
    const fobs = await db.Fob.findAll({ where: { uploaded: false } });
    if (fobs.length === 0) {
      mainWindow!.hide();
      await db.upload(0);
      app.exit();
      return;
    }
    // TODO if the user clicks the exit button before login, it would be impossible to upload
    const fobNumbers = convertNumbersToDecimal(
      fobs.map((fob) => fob.fobNumber)
    ).join(', ');
    const message = `${i18n.t('fobsNotUploadMessage')}\n${fobNumbers}\n${i18n.t(
      'uploadBeforeExit'
    )}`;
    let resp = await alertWarning(message);
    let res = { remain: -1, success: false, message: '' };
    /* eslint-disable no-await-in-loop */
    while (resp.response === 0) {
      mainWindow!.webContents.send('uploadAll', true);
      res = await api.uploadMany(fobs);
      mainWindow!.webContents.send('uploadAll', false);
      if (res.success) {
        mainWindow!.hide();
        await db.upload(res.remain);
        app.exit();
        return;
      }
      resp = await alertWarning(
        `${i18n.t('someUploadFailedMessage')}\n${res.message}\n${i18n.t(
          'retryMessage'
        )}`
      );
    } // TODO test if exit or not as expected in success or failed cases
    /* eslint-enable no-await-in-loop */
    mainWindow!.hide();
    await db.upload(res.remain === -1 ? fobs.length : res.remain);
    app.exit();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
  ipcMain.on('login', api.login);
  ipcMain.on('language', async (_event, lang: string) =>
    i18n.changeLanguage(lang)
  );
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

db.setup();

// TODO single instance check
app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
