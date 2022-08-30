import {Command, flags} from '@oclif/command'
import { calculateSchemaTable } from '../lib/files'
import { EvolutionsClient  } from '../lib/run'

export default class Up extends Command {
  static description = 'describe the command here'

  static examples = [
    `$ evolutions up ./evolutions/my_app postgresql://root:root@localhost:5433/evolutions_test`,
  ]

  static flags = {
    help: flags.help({char: 'h'}),
    // flag with a value (-n, --name=VALUE)
    // db: flags.string({char: 'd', description: 'database connection string', required: true}),
    schema: flags.string({char: 's', description: 'schema for evolutions table. default public.', default: 'public'}),
    table: flags.string({char: 't', description: 'evolutions table name. defaults to file folder.'}),
    // flag with no value (-f, --force)
    // files: flags.string({char: 'f', description: 'evolutions files', required: true}),
  }

  static args = [
    {
      name: 'files',
      required: true,
      description: 'evolutions files',
    },
    {
      name: 'db',
      required: true,
      description: 'database connection string',
    },
    {
      name: 'id',
      required: true,
      description: 'revert to this id',
      parse: (i: string) => parseInt(i)
    }
  ]

  async run() {
    const { flags, args } = this.parse(Up);
    // From my understanding this is the best way to pass this in
    process.env.DATABASE_URL = args.db;

    const { defaultedSchema, defaultedTable } = calculateSchemaTable(args.files, flags.schema, flags.table);

    const client = new EvolutionsClient()
    try {
        this.log(`Running evolutions on ${defaultedSchema}.${defaultedTable} using ${args.files}`);
        await client.runEvolutionsDown(defaultedSchema, defaultedTable, args.id)
        this.log('Successfully ran evolutions');
    } finally {
        client.close();
    }
  }
}
