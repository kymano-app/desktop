/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import 'regenerator-runtime/runtime';
import { pids } from './global';
import { init } from './ipcMainHandle';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

// const appData = app.getPath('appData');
// app.setPath('userData', path.join(appData, build.productName));

// function checkIfCalledViaCLI(args: any[]) {
//   if (args && args.length > 1) {
//     if (args.length === 4 && args[3] === './src/main/main.ts') {
//       return false;
//     }
//     return true;
//   }
//   return false;
// }

export default class AppUpdater {
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

// ipcMain.on('asynchronous-message', (event, arg) => {
//   event.reply('asynchronous-reply', app.getPath('userData'));
// });

// ipcMain.on('electron-store-get', async (event, val) => {
//   event.returnValue = '123123';
// });

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
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
  if (isDevelopment) {
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
    width: 1080,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const ret = globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow!.webContents.toggleDevTools();
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  //   mainWindow.webContents.executeJavaScript(`
  //   var path = require('path');
  //   module.paths.push(path.resolve('node_modules'));
  //   module.paths.push(path.resolve('../node_modules'));
  //   module.paths.push(path.resolve(__dirname, '..', '..', 'node_modules'));
  //   module.paths.push(path.resolve(__dirname, '..', '..', '..', 'app.asar.unpacked', 'node_modules'));
  //   path = undefined;
  // `);
  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
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

app
  .whenReady()
  .then(async () => {
    await createWindow();
    console.log('mainWindow:::', mainWindow);
    init(mainWindow);
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
    app.on('window-all-closed', async () => {
      console.log('window-all-closed');
      app.quit();
    });

    app.on('will-quit', async () => {
      console.log('will-quit');
    });

    app.on('before-quit', async (event) => {
      console.log('before-quit', pids);
      event.preventDefault();
      await Promise.all(
        pids.map((pid) => {
          // eslint-disable-next-line no-new
          new Promise((resolve) => {
            resolve(process.kill(pid));
          });
        })
      );
      console.log('before-quit1');
      process.exit(0);
    });

    app.on('quit', async (event) => {
      console.log('quit');
    });
    process.on('uncaughtException', function (err) {
      console.log(':::::::::::::::uncaughtException:::::::::::::::::::', err);
    });
    process.on('warning', (e) => console.warn('warn:::', e.stack));
  })
  .catch(console.log);
