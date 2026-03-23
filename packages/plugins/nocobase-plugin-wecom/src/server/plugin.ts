import { Plugin } from '@nocobase/server';
import { WecomAuth } from './auth/WecomAuth';
import { wecomActions } from './actions/wecomActions';
import { AuthName, ResoureName } from './constants';

export class NocobasePluginWecomServer extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    this.app.authManager.registerTypes(AuthName, {
      title: '企业微信登录(社区)',
      auth: WecomAuth,
    });

    this.app.resourceManager.define({
      name: ResoureName,
      actions: wecomActions,
    })
    this.app.acl.allow(ResoureName, '*');
  }

  async install() {}

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default NocobasePluginWecomServer;
