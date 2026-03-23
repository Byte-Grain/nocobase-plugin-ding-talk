export type Res<T> = {
  errcode: number;
  errmsg: string;
} & T

export type UserInfoRes = {
  userid?: string;
  user_ticket?: string;
  openid?: string;
  external_userid?: string;
}

export type UserDetail = {
  userid: string;
  name: string;
  mobile?: string;
  email?: string;
  biz_mail?: string;
  avatar?: string;
}

export function checkResult<T>(res: Res<T>) {
  if (res.errcode !== 0) {
    throw new Error(JSON.stringify(res));
  }
  return res;
}

/**
 * 企业微信 API
 */
export class WecomApi {
  #appKey: string;
  #appSecret: string;
  #agentId: string;
  #accessToken: string;
  #nextGetAccessTokenTime: number;

  constructor(appKey: string, appSecret: string, agentId: string) {
    this.#appKey = appKey;
    this.#appSecret = appSecret;
    this.#agentId = agentId;
  }

  getLoginUrl(redirectUri: string) {
    // 构造企业微信扫码登录链接
    return `https://open.work.weixin.qq.com/wwopen/sso/qrConnect?appid=${this.#appKey}&agentid=${this.#agentId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${new Date().getTime()}`;
  }

  async getAccessToken() {
    if (!this.#accessToken || this.#nextGetAccessTokenTime < new Date().getTime()) {
      const data = await this.doRequest<{expires_in: number, access_token: string}>('GET', 'https://qyapi.weixin.qq.com/cgi-bin/gettoken', {
        corpid: this.#appKey,
        corpsecret: this.#appSecret
      });
      checkResult(data);
      this.#nextGetAccessTokenTime = new Date().getTime() + data.expires_in * 1000 - 100000;
      this.#accessToken = data.access_token;
    }
    return this.#accessToken;
  }

  /**
   * 获取访问用户身份
   * @param code 
   * @returns 
   */
  async getUserInfo(code: string) {
    const accessToken = await this.getAccessToken();
    const res = await this.doRequest<UserInfoRes>('GET', `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo`, {
      access_token: accessToken,
      code
    });
    return checkResult(res);
  }

  /**
   * 获取用户详情
   * @param userid 
   * @returns 
   */
  async getUserDetail(userid: string) {
    const accessToken = await this.getAccessToken();
    const res = await this.doRequest<UserDetail>('GET', `https://qyapi.weixin.qq.com/cgi-bin/user/get`, {
      access_token: accessToken,
      userid
    });
    return checkResult(res);
  }

  async doRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, params?: any, body?: any, headers?: any) {
    const url = `${path}${params ? '?' + toQueryString(params) : ''}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {})
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const r = {
      method,
      url,
      headers,
      params,
      body,
    };
    if (res.status < 200 || res.status >= 300) {
      const text = await res.text();
      console.error('fetch Wecom api error: ', r, text);
      throw new Error(text);
    }
    return (await res.json()) as Res<T>;
  }
}

function toQueryString(params: any) {
  return Object.keys(params)
    .map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
    .join('&');
}
