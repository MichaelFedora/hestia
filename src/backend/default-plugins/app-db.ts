import { Router, Request, Response, NextFunction, json } from 'express';
import { getLogger, Logger } from '@log4js-node/log4js-api';
import { PluginApiInterface, Plugin } from '../data/plugin';

import { ADDRESS_PATH_REGEX, wrapAsync, parseAddressPathRegex, ensureStream, validateBucket } from '../services/api/middleware';
import axios from 'axios';
import { AuthError } from '../data/hestia-errors';
import uuid = require('uuid');

interface AppDBPluginConfig {
  app_key: string;
}

class AppDBPlugin implements Plugin {

  private id: string;
  private config: AppDBPluginConfig;
  private api: PluginApiInterface;
  private logger: Logger;

  constructor() { }

  public async init(id: string, config: AppDBPluginConfig, api: PluginApiInterface) {
    this.id = id;
    this.config = config = Object.assign({ }, config);
    this.api = api;
    this.logger = getLogger('plugins.' + this.id);

    const authKey = function(req: Request, res: Response, next: NextFunction) {
      if(!req.query.authKey || req.query.authKey !== config.app_key)
        next(new AuthError('Missing or invalid auth key!'));
      else
        next();
    };

    const router = Router();
    router.use(authKey);

    router.get('tables', wrapAsync(async (req, res) => {
      res.json(await this.api.db.plugin.listTables());
    }));
    // POST { name: string }
    router.post('tables', json(), wrapAsync(async (req, res) => {
      await this.api.db.plugin.createTable(req.body.name);
      res.sendStatus(203);
    }));
    router.delete('tables/:table', wrapAsync(async (req, res) => {
      await this.api.db.plugin.dropTable(req.params.table);
      res.sendStatus(203);
    }));

    router.get('tables/:table/data', wrapAsync(async (req, res) => {
      res.json(await this.api.db.plugin.getTable(req.params.table).then(table => table.getAll()));
    }));
    router.get('tables/:table/data/:key', wrapAsync(async (req, res) => {
      res.json(await this.api.db.plugin.getTable(req.params.table).then(table => table.get(req.params.key)));
    }));
    // router.post('tables/:table/data'); INSERT instead of INSERT OR UPDATE
    router.put('tables/:table/data/:key', json(), wrapAsync(async (req, res) => {
      await this.api.db.plugin.getTable(req.params.table).then(table => table.set(req.params.key, req.body));
      res.sendStatus(203);
    }));
    // router.delete('tables/:table/data)
    router.delete('tables/:table/data/:key', wrapAsync(async (req, res) => {
      await this.api.db.plugin.getTable(req.params.table).then(table => table.delete(req.params.key));
      res.sendStatus(203);
    }));

    return { name: 'App DB', longId: 'io.github.michaelfedora.hestia.appDB', authedAny: router };
  }

}

export default new AppDBPlugin();
