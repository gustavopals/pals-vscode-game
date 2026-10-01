/**
 * GitHub de mentira para os testes: a API (`GET /user`) e as duas rotas do *device flow*
 * (`/login/device/code` e `/login/oauth/access_token`). Não toca a rede.
 */
export type GithubCall = { url: string; method: string; headers: Headers; body: string };

type Device = {
  userCode: string;
  clientId: string;
  state: 'pending' | 'authorized' | 'denied' | 'expired';
  token: string | null;
  /** A próxima consulta responde `slow_down`. */
  slowDown: boolean;
};

export type FakeGithub = ReturnType<typeof fakeGithub>;

export function fakeGithub(urls: { api: string; oauth: string }) {
  const users = new Map<string, number>();
  const devices = new Map<string, Device>();
  const calls: GithubCall[] = [];
  let nextId = 5_000_001;
  let nextDevice = 1;
  let down = false;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  const newUser = () => {
    const id = nextId;
    nextId += 1;
    const token = `gho_teste_${id}`;
    users.set(token, id);
    return { id, token };
  };

  /** Um usuário com identificador escolhido: o mesmo GitHub em dois navegadores. */
  const userWithId = (id: number) => {
    const token = `gho_teste_${id}`;
    users.set(token, id);
    return { id, token };
  };

  const byUserCode = (userCode: string): Device => {
    const device = [...devices.values()].find((entry) => entry.userCode === userCode);
    if (device === undefined) {
      throw new Error(`Código de dispositivo desconhecido: ${userCode}`);
    }
    return device;
  };

  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? init.body : '';
    calls.push({ url, method, headers: new Headers(init?.headers), body });
    if (down) {
      throw new TypeError('fetch failed');
    }
    const form = new URLSearchParams(body);

    if (url === `${urls.api}/user`) {
      const token = new Headers(init?.headers).get('authorization')?.replace(/^Bearer /, '') ?? '';
      const id = users.get(token);
      return id === undefined ? json({ message: 'Bad credentials' }, 401) : json({ id });
    }
    if (url === `${urls.oauth}/login/device/code` && method === 'POST') {
      const number = nextDevice;
      nextDevice += 1;
      const deviceCode = `dispositivo-${number}`;
      const userCode = `LOTG-${String(number).padStart(4, '0')}`;
      devices.set(deviceCode, {
        userCode,
        clientId: form.get('client_id') ?? '',
        state: 'pending',
        token: null,
        slowDown: false,
      });
      return json({
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: `${urls.oauth}/login/device`,
        expires_in: 900,
        interval: 5,
      });
    }
    if (url === `${urls.oauth}/login/oauth/access_token` && method === 'POST') {
      const device = devices.get(form.get('device_code') ?? '');
      if (device === undefined) {
        return json({ error: 'incorrect_device_code' });
      }
      if (device.slowDown) {
        device.slowDown = false;
        return json({ error: 'slow_down', interval: 10 });
      }
      switch (device.state) {
        case 'pending':
          return json({ error: 'authorization_pending' });
        case 'denied':
          return json({ error: 'access_denied' });
        case 'expired':
          return json({ error: 'expired_token' });
        case 'authorized':
          return json({ access_token: device.token, token_type: 'bearer', scope: 'read:user' });
      }
    }
    return json({ message: 'Not Found' }, 404);
  };

  return {
    fetch: fetchFn,
    calls,
    devices,
    newUser,
    userWithId,
    /** O jogador digitou o código no GitHub e confirmou, como o usuário dado (ou um novo). */
    approve: (userCode: string, user = newUser()) => {
      const device = byUserCode(userCode);
      device.state = 'authorized';
      device.token = user.token;
      return user;
    },
    deny: (userCode: string) => {
      byUserCode(userCode).state = 'denied';
    },
    expire: (userCode: string) => {
      byUserCode(userCode).state = 'expired';
    },
    slowDownNext: (userCode: string) => {
      byUserCode(userCode).slowDown = true;
    },
    /** Simula o GitHub fora do ar. */
    setDown: (value: boolean) => {
      down = value;
    },
    reset: () => {
      users.clear();
      devices.clear();
      calls.length = 0;
      down = false;
    },
  };
}
