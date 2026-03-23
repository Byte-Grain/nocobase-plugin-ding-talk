import { Plugin } from '@nocobase/client';
import AuthPlugin from '@nocobase/plugin-auth/client';
import { WecomAuthAdminSettingsForm, WecomAuthButton } from './auth/WecomAuthComponent';

export class NocobasePluginWecomClient extends Plugin {
  async afterAdd() {
    // await this.app.pm.add()
  }

  async beforeLoad() {}

  // You can get and modify the app instance here
  async load() {
    const auth = this.app.pm.get(AuthPlugin);
    auth.registerType('community-wecom-auth', {
      components: {
        SignInButton: WecomAuthButton,
        AdminSettingsForm: WecomAuthAdminSettingsForm,
      },
    });
  }
}

export default NocobasePluginWecomClient;
