import { app } from 'electron';

const hasha = require('hasha');
const fsAsync = require('fs').promises;
const fs = require('fs');

const commit = async (args: any[], db: any) => {
  const vmAndDisk = args[5];
  const vmName = vmAndDisk.split('/')[0];
  const diskName = vmAndDisk.split('/')[1];
  const layersPath = `${app.getPath('userData')}/layers`;
  const driveFile = `${app.getPath(
    'userData'
  )}/user_layers/${vmName}/${diskName}.qcow2`;
  const fileHash = await hasha.fromFile(driveFile, { algorithm: 'sha256' });
  const layerFile = `${layersPath}/${fileHash}.qcow2`;

  try {
    await fsAsync.access(layersPath);
  } catch (error) {
    await fsAsync.mkdir(layersPath, {
      recursive: true,
    });
  }

  fs.copyFileSync(driveFile, layerFile);
  fs.unlinkSync(driveFile);

  const row = db.prepare('SELECT * FROM layer_v1 WHERE hash = ?').get(fileHash);
  if (!row) {
    const sql = `INSERT INTO layer_v1 (hash, format) VALUES (?, ?)`;
    await db.prepare(sql).run(fileHash, 'qcow2');
  }
};

export default async (args: any[], db: any) => {
  return Promise.resolve(await commit(args, db));
};
