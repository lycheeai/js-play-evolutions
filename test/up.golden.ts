import { PrismaClient, EvolutionsMeta } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from 'testcontainers';

import { EvolutionsClient } from '../src';

// yarn test:golden -i test/up.golden.ts
describe('js-play-evolutions', () => {
    const OLD_ENV = process.env;
    let container: StartedPostgreSqlContainer;
    let prisma: PrismaClient;

    beforeEach(async () => {
        container = await new PostgreSqlContainer()
            .withExposedPorts(5432)
            .withDatabase('evolutions_test')
            .withUsername('root')
            .withPassword('root')
            .start();
        
        // set DATABASE_URL
        process.env = { ...OLD_ENV };
        process.env.DATABASE_URL = `postgresql://root:root@${container.getHost()}:${container.getMappedPort(5432)}/evolutions_test?schema=public`;

        prisma = new PrismaClient();
    });

    afterEach(async() => {
        container.stop();
        prisma.$disconnect();
        process.env = OLD_ENV;
    });

    jest.setTimeout(30000);

    // yarn test:golden -i test/up.golden.ts -t 'ups'
    it('ups', async() => {
        /**
         * Settings
         */
        const client = new EvolutionsClient();

        try {
            await client.runEvolutionsUp(
                'hello',
                'test_evolutions',
                'test/examples/test/v0'
            );

            const evos = await prisma.$queryRaw<EvolutionsMeta[]>`SELECT * FROM hello.test_evolutions`

            const data = await prisma.$queryRaw`SELECT * FROM hello.world;`

            console.warn(evos, data);

            // run database ups again

            await client.runEvolutionsUp(
                'hello',
                'test_evolutions',
                'test/examples/test/v1'
            );

            const evos2 = await prisma.$queryRaw<EvolutionsMeta[]>`SELECT * FROM hello.test_evolutions`;

            const data2 = await prisma.$queryRaw`SELECT * FROM hello.world;`

            console.warn(evos2, data2);

            // this one is broken
            await expect(client.runEvolutionsUp(
                'hello',
                'test_evolutions',
                'test/examples/test/v2'
            )).rejects.toThrow('db error: ERROR: syntax error at or near "MEEP"')

            const evos3 = await prisma.$queryRaw<EvolutionsMeta[]>`SELECT * FROM hello.test_evolutions`;

            console.warn(evos3);

            // run manual

            // should throw evolution 3 is in bad state
            await expect(client.runEvolutionsUp(
                'hello',
                'test_evolutions',
                'test/examples/test/v3'
            )).rejects.toThrow('Invalid database state. Need to repair.');

            await client.clearErrors('hello', 'test_evolutions');

            await client.runEvolutionsUp(
                'hello',
                'test_evolutions',
                'test/examples/test/v3'
            );

            // revert to 1
            await expect(client.runEvolutionsDown(
                'hello',
                'test_evolutions',
                1
            )).rejects.toThrow('db error: ERROR: syntax error at or near "MEEP"');

            await client.repairDown('hello', 'test_evolutions', 'test/examples/test/v4');

            const evos4 = await prisma.$queryRaw<EvolutionsMeta[]>`
                SELECT * FROM hello.test_evolutions
            `;

            console.warn(evos4);

        } finally {
            client.close();
        }
    });

    // yarn test:golden -i test/up.golden.ts -t 'hasura'
    it('hasura', async() => {
        const client = new EvolutionsClient(true);

        await client.runEvolutionsUp(
            'hello',
            'test_evolutions',
            'test/examples/hasura/v0'
        );

        const evos = await prisma.$queryRaw<EvolutionsMeta[]>`SELECT * FROM hello.test_evolutions`;

        evos.forEach((i) => (console.warn(i)))
        
        await client.runEvolutionsDown(
            'hello',
            'test_evolutions',
            1660255437760 - 1 // this is bad form
        );

        const evos2 = await prisma.$queryRaw<EvolutionsMeta[]>`SELECT * FROM hello.test_evolutions`;

        evos2.forEach((i) => (console.warn(i)));

        await client.runEvolutionsUp(
            'hello',
            'test_evolutions',
            'test/examples/hasura/v0'
        );

        const evos3 = await prisma.$queryRaw<EvolutionsMeta[]>`SELECT * FROM hello.test_evolutions`;

        evos3.forEach((i) => (console.warn(i)))        
    });
});
