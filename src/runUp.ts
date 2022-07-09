import { runDatabaseUps  } from './lib/run';
import { runSingleUps  } from './lib/run';
const SCHEMA = 'blah';

(async function() {
    await runDatabaseUps(SCHEMA, 'basic_auth_evolutions', '/examples/basic_auth');
    await runDatabaseUps(SCHEMA, 'jaroop_core_evolutions', '/examples/jaroop_core');
    await runDatabaseUps(SCHEMA, 'givinga_evolutions', '/examples/givinga');
    // run sample

    await runSingleUps('/examples/snapshots/GoldenCorporations.sql');
})();
