import { expect, test } from '@salesforce/command/lib/test';
import { ensureJsonMap, ensureString } from '@salesforce/ts-types';

describe('dxload:start', () => {
  test
    .withOrg({ username: 'test@target.com' }, true)
    .withConnectionRequest(request => {
      //const requestMap = ensureJsonMap(request);
      return Promise.resolve({ records: [] });
    })
    .stdout()
    .command(['dxload:start', '--targetusername', 'test@org.com','--sourceusername','test@source.com'])
    .it('runs dxload:start --targetusername test@org.com', ctx => {
      expect(ctx.stdout).to.contain('');
    });
});
