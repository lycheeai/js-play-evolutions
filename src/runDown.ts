import { runDatabaseDowns  } from './lib/run';
import { runSingleDowns } from './lib/run';

//runDatabaseUps
const SCHEMA = 'blah';

(async function() {
    await runSingleDowns('/examples/snapshots/GoldenCorporations.sql')

    await runDatabaseDowns(SCHEMA, 'givinga_evolutions', '/examples/givinga');
    await runDatabaseDowns(SCHEMA, 'jaroop_core_evolutions', '/examples/jaroop_core');
    await runDatabaseDowns(SCHEMA, 'basic_auth_evolutions', '/examples/basic_auth');
    // await runDatabaseDowns(SCHEMA, 'jaroop_core_evolutions', '/examples/jaroop_core');
})();
