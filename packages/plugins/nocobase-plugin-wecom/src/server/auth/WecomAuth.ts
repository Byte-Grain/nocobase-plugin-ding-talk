import { BaseAuth, AuthConfig } from '@nocobase/auth';
import { AuthModel } from '@nocobase/plugin-auth';
import { WecomApi } from '../openapi/wecomApi';

export type AuthConfigOptions = {
  public: {
    autoSignup: boolean;
  }
  internal: {
    userCheckType: 'orgEmail' | 'personalEmail' | 'mobile';
    emailDomains: string[];
    appKey?: string;
    agentId?: string;
    appSecret?: string;
  }
}

export class WecomAuth extends BaseAuth {

  #authConfigOptions: AuthConfigOptions;
  #wecomApi: WecomApi;

  constructor(config: AuthConfig) {
    // 设置用户数据表
    const userCollection = config.ctx.db.getCollection('users');
    super({ ...config, userCollection });
    this.#authConfigOptions = config.options as AuthConfigOptions;
    this.#wecomApi = new WecomApi(this.#authConfigOptions.internal.appKey, this.#authConfigOptions.internal.appSecret, this.#authConfigOptions.internal.agentId)
    this.#authConfigOptions = {
      ...this.#authConfigOptions,
      internal: {
        ...this.#authConfigOptions.internal,
        userCheckType: this.#authConfigOptions.internal.userCheckType,
        emailDomains: config.options.internal.emailDomain?.split(/\s*,\s*/) || [],
      }
    }
  }

  async validate() {
    const ctx = this.ctx;
    const { authenticator: authenticatorName, code, authCode, state }  = ctx.action.params;
    if (!authenticatorName) {
      ctx.throw(400, '认证器不能为空');
    }
    const loginCode = code || authCode;
    if (!loginCode) {
      ctx.throw(400, '临时授权码不存在');
    }

    const auth = this;

    const userInfo = await auth.wecomApi.getUserInfo(loginCode);
    const userId = userInfo.userid || userInfo.openid;
    
    if (!userId) {
      ctx.throw(400, '获取用户身份失败');
    }

    const authenticator = this.authenticator as AuthModel;
    let au = await authenticator.findUser(userId);
    if (au) {
      // 用户存在
      return au;
    }

    // 尝试获取用户详情（外部联系人可能获取不到完整信息，视具体权限而定）
    let userDetail: any = {};
    if (userInfo.userid) {
       try {
         userDetail = await auth.wecomApi.getUserDetail(userInfo.userid);
       } catch (e) {
         console.warn('获取企业微信用户详情失败:', e);
       }
    }

    const user = {
      userId: userId,
      mobile: userDetail.mobile,
      email: userDetail.biz_mail || userDetail.email, // 企业微信有企业邮箱biz_mail和个人邮箱email
      name: userDetail.name || userId,
      orgEmail: userDetail.biz_mail,
      personalEmail: userDetail.email,
    }

    let filter: any;
    if (this.#authConfigOptions.internal.userCheckType === 'personalEmail') {
      if (!user.personalEmail) {
        ctx.throw(400, '用户邮箱未配置');
      }
      if (this.#authConfigOptions.internal.emailDomains.length > 0 && !this.#authConfigOptions.internal.emailDomains.some(a => user.personalEmail.endsWith(a))) {
        ctx.throw(400, `邮箱域名未启用 ${user.personalEmail}`);
      }
      filter = {
        email: user.personalEmail,
      }
    } else if (this.#authConfigOptions.internal.userCheckType === 'orgEmail') {
      if (!user.orgEmail) {
        ctx.throw(400, '用户企业邮箱未配置');
      }
      if (this.#authConfigOptions.internal.emailDomains.length > 0 && !this.#authConfigOptions.internal.emailDomains.some(a => user.orgEmail.endsWith(a))) {
        ctx.throw(400, `邮箱域名未启用 ${user.orgEmail}`);
      }
      filter = {
        email: user.orgEmail,
      }
    } else {
      if (!user.mobile) {
        ctx.throw(400, '用户手机号未配置，或未授权');
      }
      filter = {
        phone: user.mobile
      }
    }

    // 已有用户，则进行绑定
    let ncUser = await this.userRepository.findOne({ filter });
    if (ncUser) {
      await this.authenticator.addUser(user, {
        through: {
          uuid: userId,
        },
      });
      return await authenticator.findUser(userId);
    }

    // 新用户
    if (this.#authConfigOptions.public.autoSignup) {
      return await authenticator.findOrCreateUser(userId, {
        nickname: user.name,
        username: filter.email?.split('@')?.[0] || user.mobile || userId,
        email: filter.email,
        phone: user.mobile,
        meta: JSON.stringify(user),
      });
    }

    return null;
  }

  get wecomApi() {
    return this.#wecomApi;
  }

  get authConfigOptions() {
    return this.#authConfigOptions;
  }
}
